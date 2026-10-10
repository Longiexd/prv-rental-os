"""Per-company plans, dependency resolution and backend enforcement."""
import secrets
from types import SimpleNamespace
from unittest.mock import patch
import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException
from app.control import Control, Settings
from app.features import resolve, check_path
from test_tenancy import control, client, headers, issue
from app.odoo_client import current_client
from app.verticals.car_rental.eligibility import fleet_eligibility

@pytest.fixture
def store(tmp_path):
    control = Control(Settings("test", tmp_path, Fernet.generate_key(), secrets.token_urlsafe(48)))
    control.initialize()
    with control.db(True) as db:
        for code in ("atlas", "bravo"):
            db.execute("INSERT INTO companies VALUES (?,?,?,?,?)", (code, code, "http://odoo:8069", code, "active"))
    return control

def test_existing_clients_keep_premium_and_settings_are_isolated(store):
    assert all(store.features("atlas")["features"].values())
    store.set_features("atlas", "starter")
    assert not any(store.features("atlas")["features"].values())
    assert all(store.features("bravo")["features"].values())
    assert store.features("atlas")["plan"] == "starter"
    with store.db() as db:
        assert db.execute("SELECT count(*) FROM audit WHERE event='features'").fetchone()[0] == 1

def test_dependency_override_and_reset(store):
    store.set_features("atlas", "premium", {"fleet_care": False})
    assert not store.features("atlas")["features"]["fleet_compliance"]
    assert store.features("atlas")["features"]["analytics"]
    store.set_features("atlas", overrides={"fleet_care": True})
    assert store.features("atlas")["features"]["fleet_compliance"]
    store.set_features("atlas", overrides={"analytics": False})
    store.set_features("atlas", reset=True)
    assert store.features("atlas")["features"]["analytics"]
    store.set_features("atlas", "starter")
    assert not store.features("atlas")["overrides"]

@pytest.mark.parametrize("value", [{"fake": True}, {"analytics": "off"}, {"analytics": 1}])
def test_invalid_switches_are_atomic(store, value):
    with pytest.raises(ValueError): store.set_features("atlas", "starter", value)
    assert store.features("atlas")["plan"] == "premium"

def test_unknown_company_and_plan_rejected(store):
    with pytest.raises(ValueError): store.set_features("missing", "starter")
    with pytest.raises(ValueError): store.set_features("atlas", "made-up")

@pytest.mark.parametrize("path", ["/cars/care", "/cars/1/documents", "/cars/1/documents/5/content", "/cars/1/maintenance-plan", "/cars/1/contracts/link", "/cars/1/services/2/complete", "/analytics", "/analytics/dashboard/"])
def test_starter_blocks_direct_module_requests(path):
    with pytest.raises(HTTPException) as error: check_path(path, resolve("starter"))
    assert error.value.status_code == 403
    check_path(path, resolve("premium"))

@pytest.mark.parametrize("path", ["/cars", "/cars/sync", "/cars/1/return", "/cars/1/mark-available", "/activities", "/auth/session", "/sales/3/documents", "/customers/2/documents"])
def test_core_routes_stay_accessible(path):
    check_path(path, resolve("starter"))

def test_starter_skips_document_reads_but_keeps_vehicles():
    token = current_client.set(SimpleNamespace(profile={"features": resolve("starter")}))
    try:
        with patch("app.verticals.car_rental.eligibility.odoo.execute", side_effect=AssertionError("No document reads for Starter")):
            assert fleet_eligibility([4, 7]) == {4: {"eligible": True, "blocking_reasons": []}, 7: {"eligible": True, "blocking_reasons": []}}
    finally: current_client.reset(token)


def test_private_panel_auth_origin_and_feature_update(store):
    import io
    import json
    import sys
    from pathlib import Path
    from contextlib import nullcontext
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "deploy"))
    from admin_panel import make_handler
    admin = SimpleNamespace(environment="test", control=lambda:store, lock=nullcontext)
    handler_type = make_handler(admin, "a"*43, 8899)
    def call(method,path,headers=None,body=None):
        handler = object.__new__(handler_type)
        payload = json.dumps(body).encode() if body is not None else b""
        handler.path=path
        handler.headers={"Host":"localhost:8899", "Content-Length":str(len(payload)), **(headers or {})}
        handler.rfile=io.BytesIO(payload); handler.wfile=io.BytesIO()
        result={"headers":{}}
        handler.send_response=lambda code:result.update(status=code)
        handler.send_header=lambda k,v:result["headers"].update({k:v})
        handler.end_headers=lambda:None
        getattr(handler,"do_"+method)()
        result["body"]=handler.wfile.getvalue()
        return result
    assert call("GET","/companies")["status"] == 403
    launch=call("GET","/?key="+"a"*43)
    assert launch["status"] == 303 and launch["headers"]["Location"] == "/"
    auth={"Cookie":"klynx_owner="+"a"*43}
    assert call("GET","/companies",{**auth,"Host":"evil.example"})["status"] == 403
    data=call("GET","/companies",auth)
    assert data["status"] == 200 and data["headers"]["Cache-Control"] == "no-store"
    assert len(json.loads(data["body"])["companies"]) == 2
    body={"company":"atlas","plan":"starter","overrides":{}}
    assert call("POST","/features",auth,body)["status"] == 403
    headers={**auth,"Content-Type":"application/json","Origin":"http://localhost:8899","X-Klynx-CSRF":"a"*43}
    assert call("POST","/features",{**headers,"Origin":"http://evil.example"},body)["status"] == 403
    assert call("POST","/features",headers,body)["status"] == 200
    assert store.features("atlas")["plan"] == "starter"
    assert store.features("bravo")["plan"] == "premium"
    assert call("POST","/features",headers,{**body,"overrides":{"analytics":"yes"}})["status"] == 400

def test_switches_apply_to_existing_sessions_and_stay_private(client, control):
    first, second = issue(control), issue(control, "bravo")
    control.set_features("atlas", "starter")
    assert client.get("/cars/care", headers=headers(control, first)).status_code == 403
    assert client.get("/analytics", headers=headers(control, first)).status_code == 403
    with patch("app.auth.OdooClient.check", return_value=None):
        assert client.get("/auth/session", headers=headers(control, first)).json()["plan"] == "starter"
        assert client.get("/auth/session", headers=headers(control, second)).json()["plan"] == "premium"
        control.set_features("atlas", "premium")
        assert client.get("/auth/session", headers=headers(control, first)).json()["features"]["fleet_care"]
    assert client.post("/admin/features", headers=headers(control, first), json={"plan":"enterprise"}).status_code == 404
