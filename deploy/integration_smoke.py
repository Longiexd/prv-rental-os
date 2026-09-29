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


tokens = []
for account in data:
    response = request("POST", "/auth/login", json=account)
    assert response.status_code == 200, f"Odoo login returned {response.status_code}"
    tokens.append(response.json()["token"])
assert request("POST", "/auth/login", json={"username": data[0]["username"], "password": data[1]["password"]}).status_code == 401
assert requests.get(base+"/cars", timeout=10).status_code == 401

created = request("POST", "/customers", tokens[0], json={"name": "Tenant A private customer", "phone": "123", "email": "test@example.invalid", "description": "CI isolation check"})
assert created.status_code == 200, f"Customer creation returned {created.status_code}"
for index, token in enumerate(tokens):
    response = request("GET", "/customers/search?q=Tenant%20A%20private%20customer&db=wrong", token)
    assert response.status_code == 200
    assert bool(response.json()["matches"]) == (index == 0), "Cross-company customer exposure"
    for path in ("/cars", "/customers", "/crm/leads", "/sales", "/invoices", "/rentals/options", "/calendar", "/analytics", "/activities"):
        result = request("GET", path, token)
        assert result.status_code == 200, f"Business role cannot access {path}: {result.status_code}"
    assert request("POST", "/admin/users", token, json={}).status_code == 404


def sample(index):
    started = time.monotonic()
    response = request("GET", "/cars", tokens[index % 2])
    assert response.status_code == 200
    return time.monotonic()-started


with ThreadPoolExecutor(max_workers=4) as pool:
    samples = sorted(pool.map(sample, range(20)))
assert samples[-1] < 15, "Small empty-company read exceeded the CI latency budget"
print(f"Concurrent two-company reads: median={statistics.median(samples):.3f}s p95={samples[18]:.3f}s")
assert request("DELETE", "/auth/session", tokens[0]).status_code == 200
assert request("GET", "/cars", tokens[0]).status_code == 401
assert request("GET", "/cars", tokens[1]).status_code == 200
print("Real Odoo login, business access, company separation, logout and bounded concurrency passed.")
