"""Run inside the disposable CI API container; never prints credentials."""
from concurrent.futures import ThreadPoolExecutor
import base64
from datetime import date, timedelta
import json
from pathlib import Path
import statistics
import time

import requests

data = json.loads(Path("/checks/credentials.json").read_text())
proxy = Path("/run/klynx/proxy.key").read_text().strip()
base = "http://127.0.0.1:8000"


def request(method, path, token=None, **kwargs):
    headers = {"X-Klynx-Proxy-Key": proxy}
    if token: headers["X-Klynx-Session"] = token
    response = requests.request(method, base + path, headers=headers, timeout=60, **kwargs)
    return response


def expect(response, status, operation):
    """Report only the operation and HTTP status; response bodies can contain private data."""
    if response.status_code != status:
        raise RuntimeError(f"{operation}: expected HTTP {status}, got HTTP {response.status_code}")


def phase(message):
    print(f"smoke: {message}", flush=True)


tokens = []
phase("authenticating both isolated company users")
for index, account in enumerate(data, start=1):
    response = request("POST", "/auth/login", json=account)
    expect(response, 200, f"company {index} login")
    tokens.append(response.json()["token"])
expect(request("POST", "/auth/login", json={"username": data[0]["username"], "password": data[1]["password"]}), 401, "cross-company password rejection")
expect(requests.get(base+"/cars", timeout=10), 401, "request without proxy credentials")

phase("creating tenant A data and checking tenant B isolation")
created = request("POST", "/customers", tokens[0], json={"name": "Tenant A private customer", "phone": "123", "email": "test@example.invalid", "description": "CI isolation check"})
expect(created, 200, "tenant A customer creation")
for index, token in enumerate(tokens):
    response = request("GET", "/customers/search?q=Tenant%20A%20private%20customer&db=wrong", token)
    expect(response, 200, f"company {index + 1} customer search")
    if bool(response.json()["matches"]) != (index == 0):
        raise RuntimeError(f"company {index + 1} customer isolation check failed")
    phase(f"checking company {index + 1} business routes")
    for path in ("/cars", "/customers", "/crm/leads", "/sales", "/invoices", "/rentals/options", "/calendar?start=2026-01-01&end=2026-12-31", "/analytics", "/activities"):
        result = request("GET", path, token)
        expect(result, 200, f"company {index + 1} business route {path}")
    expect(request("POST", "/admin/users", token, json={}), 404, f"company {index + 1} private admin route")


phase("checking native Fleet contracts, services and odometer as the company operator")
response = request("GET", "/cars/care", tokens[0])
expect(response, 200, "Fleet overview")
vehicle = response.json()["vehicles"][0]
vehicle_id = vehicle["id"]
assert any(alert["kind"] == "maintenance" for alert in vehicle["alerts"])
expiry = (date.today() + timedelta(days=10)).isoformat()
response = request("POST", f"/cars/{vehicle_id}/documents", tokens[0], json={"kind":"insurance", "filename":"ci.pdf",
    "content":base64.b64encode(b"%PDF-1.7\nCI Fleet scan").decode(), "number":"CI-POLICY", "expiry_date":expiry})
expect(response, 200, "Fleet insurance upload")
assert response.json()["fleet_sync"]["linked"] is True
response = request("PUT", f"/cars/{vehicle_id}/maintenance-plan", tokens[0], json={"next_odometer":10000,"next_date":expiry})
expect(response, 200, "Native oil-change plan")
service_id = response.json()["service_id"]
response = request("GET", "/cars/care", tokens[0])
expect(response, 200, "Native Fleet records readback")
current = next(row for row in response.json()["vehicles"] if row["id"] == vehicle_id)
assert current["odometer"] == vehicle["odometer"], "Planning changed the actual odometer"
assert any(row["expiration_date"] == expiry for row in current["contracts"])
assert any(alert["kind"] == "insurance" and alert["reason"] == "renewal" for alert in current["alerts"])
assert any(alert["kind"] == "registration" and alert["reason"] == "missing" for alert in current["alerts"])
expect(request("POST", f"/cars/{vehicle_id}/services/{service_id}/complete", tokens[1], json={"odometer":25}), 404, "cross-company service isolation")
expect(request("POST", f"/cars/{vehicle_id}/services/{service_id}/complete", tokens[0], json={"odometer":25}), 200, "Native service completion")
response = request("GET", "/cars/care", tokens[0])
expect(response, 200, "Completed service readback")
current = next(row for row in response.json()["vehicles"] if row["id"] == vehicle_id)
assert current["odometer"] == 25 and any(row["id"] == service_id and row["state"] == "done" for row in current["services"])
assert not any(alert["kind"] == "oil_change" for alert in current["alerts"])


phase("checking compliance gates and native unavailable state as the company operator")
expect(request("POST", f"/cars/{vehicle_id}/mark-available", tokens[0]), 409, "Missing required evidence blocks availability")
for kind in ("insurance", "registration", "technical_inspection", "vignette", "operating_permit"):
    expiry = (date.today() + timedelta(days=90)).isoformat() if kind not in {"registration", "operating_permit"} else None
    response = request("POST", f"/cars/{vehicle_id}/documents", tokens[0], json={"kind": kind, "filename": "ci.pdf",
        "content": base64.b64encode(b"%PDF-1.7\nCI legal evidence").decode(), "number": "CI-VALID", "expiry_date": expiry, "payment_confirmed": True})
    expect(response, 200, "Required Fleet evidence upload")
    document_id = response.json()["attachment_id"]
    expect(request("PATCH", f"/cars/{vehicle_id}/documents/{document_id}", tokens[0], json={
        "number": "CI-VALID", "expiry_date": expiry, "verified": True, "payment_confirmed": True}), 200, "Required Fleet evidence verification")
response = request("GET", "/cars/care", tokens[0])
expect(response, 200, "Eligible Fleet readback")
assert next(row for row in response.json()["vehicles"] if row["id"] == vehicle_id)["eligible"]
expect(request("POST", f"/cars/{vehicle_id}/mark-available", tokens[0]), 200, "Reviewed vehicle becomes available")
# A new expired policy must revoke availability, even though the older scan remains archived.
response = request("POST", f"/cars/{vehicle_id}/documents", tokens[0], json={"kind": "insurance", "filename": "ci.pdf",
    "content": base64.b64encode(b"%PDF-1.7\nCI expired policy").decode(), "number": "CI-EXPIRED", "expiry_date": (date.today() - timedelta(days=1)).isoformat()})
expect(response, 200, "Expired policy saved truthfully")
assert response.json()["fleet_sync"]["state_synced"]
response = request("GET", "/cars", tokens[0])
expect(response, 200, "Blocked Fleet readback")
assert next(row for row in response.json()["cars"] if row["id"] == vehicle_id)["status"] == "Indisponible"
expect(request("POST", f"/cars/{vehicle_id}/mark-available", tokens[0]), 409, "Expired coverage cannot be released")


def sample(index):
    started = time.monotonic()
    response = request("GET", "/cars", tokens[index % 2])
    expect(response, 200, f"concurrent read {index + 1}")
    return time.monotonic()-started


phase("checking bounded concurrent reads")
with ThreadPoolExecutor(max_workers=4) as pool:
    samples = sorted(pool.map(sample, range(20)))
if samples[-1] >= 15:
    raise RuntimeError("Small empty-company read exceeded the CI latency budget")
print(f"Concurrent two-company reads: median={statistics.median(samples):.3f}s p95={samples[18]:.3f}s")
phase("checking logout revocation and unaffected tenant session")
expect(request("DELETE", "/auth/session", tokens[0]), 200, "company 1 logout")
expect(request("GET", "/cars", tokens[0]), 401, "revoked company 1 session")
expect(request("GET", "/cars", tokens[1]), 200, "unaffected company 2 session")
print("Real Odoo login, business access, company separation, logout and bounded concurrency passed.")
