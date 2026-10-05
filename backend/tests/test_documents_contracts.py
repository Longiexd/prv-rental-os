"""Document ownership, tracking, upload bounds and read-only contract regression tests."""
import base64
from copy import deepcopy
from datetime import date, timedelta
from unittest.mock import patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.core import documents
from app.core.record_metadata import write_metadata
from app.routes import sales

KINDS = {"cin": "CIN", "driving_license": "Driving licence"}


class Store:
    def __init__(self):
        self.attachments = []
        self.calls = []
        self.fail_write = False
        self.missing_parent = False

    def execute(self, model, method, args, kwargs=None):
        self.calls.append((model, method, deepcopy(args), kwargs))
        if model in ("res.partner", "fleet.vehicle"):
            return [] if self.missing_parent else [{"id": 3}]
        if model == "ir.attachment":
            if method == "create":
                record = {"id": len(self.attachments) + 1, **deepcopy(args[0])}
                self.attachments.append(record)
                return record["id"]
            if method == "search_read":
                def matches(record):
                    for field, operator, value in args[0]:
                        if operator == "=" and record.get(field) != value:
                            return False
                        if operator == "ilike" and value not in record.get(field, ""):
                            return False
                    return True
                return [deepcopy(item) for item in reversed(self.attachments) if matches(item)]
            if method == "read":
                return [deepcopy(item) for item in self.attachments if item["id"] in args[0]]
            if method == "write":
                if self.fail_write:
                    return False
                for item in self.attachments:
                    if item["id"] in args[0]:
                        item.update(args[1])
                return True
        raise AssertionError((model, method))


@pytest.fixture
def client():
    store = Store()
    app = FastAPI()
    app.include_router(documents.document_router("res.partner", KINDS), prefix="/customers")
    app.include_router(documents.document_router("fleet.vehicle", {"insurance": "Assurance"}), prefix="/cars")
    with patch.object(documents.odoo, "execute", side_effect=store.execute), TestClient(app) as test_client:
        yield test_client, store


def upload(client, **changes):
    data = {"kind": "cin", "filename": "../../identity.pdf", "content": base64.b64encode(b"%PDF-1.7\nscan").decode(),
            "number": "12345678", **changes}
    return client.post("/customers/3/documents", json=data)


def test_private_native_attachment_upload_download_and_checklist(client):
    http, store = client
    assert http.get("/customers/3/documents").json()["ready"] is False
    assert upload(http).status_code == 200
    attachment = store.attachments[0]
    assert attachment["public"] is False
    assert attachment["res_model"] == "res.partner" and attachment["res_id"] == 3
    assert attachment["name"] == "cin.pdf"
    item = http.get("/customers/3/documents").json()["documents"][0]
    assert item["status"] == "uploaded" and item["number"] == "12345678"
    result = http.get("/customers/3/documents/1/download").json()
    assert base64.b64decode(result["content"]) == b"%PDF-1.7\nscan"
    assert result["mime"] == "application/pdf"
    assert all(model != "ir.model" for model, *_ in store.calls)


def test_verification_expiry_and_replacement_do_not_delete_earlier_scans(client):
    http, store = client
    upload(http)
    upload(http, kind="driving_license")
    for attachment_id in (1, 2):
        assert http.patch(f"/customers/3/documents/{attachment_id}", json={"verified": True, "number": "456"}).status_code == 200
    assert http.get("/customers/3/documents").json()["ready"] is True
    upload(http)
    assert len(store.attachments) == 3
    assert http.get("/customers/3/documents").json()["documents"][0]["status"] == "uploaded"
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    assert http.patch("/customers/3/documents/3", json={"verified": True, "expiry_date": yesterday}).status_code == 422
    assert http.patch("/customers/3/documents/3", json={"expiry_date": yesterday}).status_code == 200
    assert http.get("/customers/3/documents").json()["documents"][0]["status"] == "expired"


@pytest.mark.parametrize("path", ["/customers/4/documents/1", "/cars/3/documents/1"])
def test_cannot_read_or_update_another_record_or_model_attachment(client, path):
    http, _ = client
    upload(http)
    assert http.get(path + "/download").status_code == 404
    assert http.patch(path, json={"verified": True}).status_code == 404


@pytest.mark.parametrize("content,status", [("garbage!", 422), (base64.b64encode(b"<svg onload=alert(1)>").decode(), 415),
                                          (base64.b64encode(b"%PDF-" + b"x" * documents.MAX_FILE_BYTES).decode(), 422)],
                         ids=["invalid-base64", "unsupported-file", "oversized-file"])
def test_invalid_unsupported_or_oversized_upload_is_rejected_before_create(client, content, status):
    http, store = client
    assert upload(http, content=content).status_code == status
    assert not store.attachments


@pytest.mark.parametrize("content,mime", [(b"%PDF-1.7", "application/pdf"), (b"\x89PNG\r\n\x1a\nscan", "image/png"),
                                         (b"\xff\xd8\xffscan", "image/jpeg")])
def test_supported_signature_controls_type_not_filename(client, content, mime):
    http, store = client
    assert upload(http, filename="scan.html", content=base64.b64encode(content).decode()).status_code == 200
    assert store.attachments[0]["mimetype"] == mime


def test_missing_parent_wrong_kind_and_failed_update_are_not_success(client):
    http, store = client
    assert upload(http, kind="insurance").status_code == 422
    store.missing_parent = True
    assert upload(http).status_code == 404
    store.missing_parent = False
    upload(http)
    store.fail_write = True
    assert http.patch("/customers/3/documents/1", json={"verified": True}).status_code == 502


def test_untracked_or_public_attachment_is_not_downloadable(client):
    http, store = client
    upload(http)
    store.attachments[0]["public"] = True
    assert http.get("/customers/3/documents/1/download").status_code == 404
    store.attachments[0]["public"] = False
    store.attachments[0]["description"] = "Other unrelated Odoo attachment"
    assert http.get("/customers/3/documents/1/download").status_code == 404


def contract_order(**changes):
    return {"id": 42, "name": "S0042", "booking_status": "confirmed", "customer": {"id": 3}, "vehicle_id": 4,
            "date_order": "2026-10-05", "commitment_date": "2026-10-08", "amount_total": 720,
            "amount_paid": 300, "amount_outstanding": 420, "return_record": None, **changes}


def test_contract_is_autofilled_escaped_and_never_mutates_booking_or_payments():
    def execute(model, method, args, kwargs):
        assert method == "read"
        return {"res.partner": [{"name": '<script>alert("x")</script>', "phone": "555"}],
                "fleet.vehicle": [{"name": "Car", "license_plate": "TN123", "model_id": [7, "Model"]}],
                "res.company": [{"name": "Agency", "phone": "111", "email": "agent@example.test"}]}[model]
    with patch.object(sales, "get_sale", return_value=contract_order()), \
         patch.object(sales, "sale_record", return_value={"company_id": [1, "Agency"], "currency_id": [1, "TND"]}), \
         patch.object(sales, "document_checklist", return_value={"documents": [{"kind": "cin", "number": "123"}, {"kind": "driving_license", "number": "456"}]}), \
         patch.object(sales.odoo, "execute", side_effect=execute):
        contract = sales.rental_contract(42)
    assert contract["fields"]["CIN"] == "123" and contract["fields"]["Permis de conduire"] == "456"
    assert contract["fields"]["Montant payé / acompte"] == 300
    assert contract["fields"]["Kilométrage au départ"] is None
    assert "<script>" not in contract["html"] and "&lt;script&gt;" in contract["html"]
    assert "default-src 'none'" in contract["html"] and "@media print" in contract["html"]


@pytest.mark.parametrize("changes", [{"booking_status": "cancelled"}, {"customer": None}, {"vehicle_id": None}])
def test_contract_rejects_incomplete_or_cancelled_booking(changes):
    with patch.object(sales, "get_sale", return_value=contract_order(**changes)), \
         patch.object(sales.odoo, "execute") as rpc, pytest.raises(HTTPException):
        sales.rental_contract(42)
    rpc.assert_not_called()


def test_document_endpoints_directly_preserve_ownership_and_verification():
    # Pure endpoint coverage also runs when Windows cannot create TestClient's socket pair.
    store = Store()
    routes = documents.document_router("res.partner", KINDS).routes
    checklist, create, update, download = [route.endpoint for route in routes]
    with patch.object(documents.odoo, "execute", side_effect=store.execute):
        assert not checklist(3)["ready"]
        result = create(3, documents.DocumentUpload(kind="cin", filename="scan.pdf",
                        content=base64.b64encode(b"%PDF-1.7").decode(), number="123"))
        assert result["attachment_id"] == 1
        update(3, 1, documents.DocumentUpdate(number="123", verified=True))
        assert checklist(3)["documents"][0]["status"] == "verified"
        assert base64.b64decode(download(3, 1)["content"]) == b"%PDF-1.7"
        with pytest.raises(HTTPException) as error:
            download(4, 1)
        assert error.value.status_code == 404
        with pytest.raises(HTTPException):
            update(3, 1, documents.DocumentUpdate(verified=True, expiry_date=date.today() - timedelta(days=1)))
        store.fail_write = True
        with pytest.raises(HTTPException) as error:
            update(3, 1, documents.DocumentUpdate(verified=False))
        assert error.value.status_code == 502


@pytest.mark.parametrize("content", [b"<svg>bad</svg>", b"", b"%PDF-" + b"x" * documents.MAX_FILE_BYTES],
                         ids=["unsupported", "empty", "too-large"])
def test_document_upload_guard_directly(content):
    store = Store()
    create = documents.document_router("res.partner", KINDS).routes[1].endpoint
    # Oversized encoded inputs are rejected by Pydantic before the endpoint as well.
    from pydantic import ValidationError
    with patch.object(documents.odoo, "execute", side_effect=store.execute), pytest.raises((HTTPException, ValidationError)):
        create(3, documents.DocumentUpload(kind="cin", filename="bad.pdf", content=base64.b64encode(content).decode()))
    assert not store.attachments


def test_invalid_new_document_cannot_fall_back_to_an_older_verified_scan():
    store = Store()
    checklist, create, update, _ = [route.endpoint for route in documents.document_router("res.partner", KINDS).routes]
    data = documents.DocumentUpload(kind="cin", filename="scan.pdf", content=base64.b64encode(b"%PDF-1.7").decode())
    with patch.object(documents.odoo, "execute", side_effect=store.execute):
        create(3, data)
        update(3, 1, documents.DocumentUpdate(verified=True))
        create(3, data)
        assert checklist(3)["documents"][0]["status"] == "uploaded"
        store.attachments[-1]["description"] = "[Klynx metadata:document:bad]"
        with pytest.raises(HTTPException) as error:
            checklist(3)
        assert error.value.status_code == 409
