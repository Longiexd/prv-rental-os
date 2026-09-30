"""Run inside the disposable CI API container; never prints credentials."""
from concurrent.futures import ThreadPoolExecutor
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
    for path in ("/cars", "/customers", "/crm/leads", "/sales", "/invoices", "/rentals/options", "/calendar", "/analytics", "/activities"):
        result = request("GET", path, token)
        expect(result, 200, f"company {index + 1} business route {path}")
    expect(request("POST", "/admin/users", token, json={}), 404, f"company {index + 1} private admin route")


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
