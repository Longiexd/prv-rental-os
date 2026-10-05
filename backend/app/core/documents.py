"""Private document tracking on native Odoo attachments, scoped to their parent."""
import base64
import binascii
from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.record_metadata import read_metadata, write_metadata
from app.odoo_client import odoo

MAX_FILE_BYTES = 600 * 1024  # Base64 plus metadata stays below the existing 1 MiB proxy limit.
KEY = "document"


class DocumentUpload(BaseModel):
    kind: str = Field(min_length=1, max_length=40)
    content: str = Field(min_length=1, max_length=819200)
    filename: str = Field(min_length=1, max_length=200)
    number: str = Field(default="", max_length=100)
    expiry_date: date | None = None


class DocumentUpdate(BaseModel):
    number: str = Field(default="", max_length=100)
    expiry_date: date | None = None
    verified: bool = False


def file_type(content: bytes):
    if content.startswith(b"%PDF-"):
        return "application/pdf", "pdf"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    raise HTTPException(415, "Choose a PDF, PNG or JPEG document.")


def parent(model, record_id):
    records = odoo.execute(model, "search_read", [[["id", "=", record_id]]],
                           {"fields": ["id"], "limit": 1})
    if not records:
        raise HTTPException(404, "Document owner not found.")


def metadata(attachment):
    value = read_metadata(attachment.get("description"), KEY)
    if not value or value.get("version") != 1:
        return None
    if (not isinstance(value.get("kind"), str) or not isinstance(value.get("number"), str)
            or len(value["number"]) > 100 or not isinstance(value.get("verified"), bool)):
        return None
    try:
        if value.get("expiry_date"):
            date.fromisoformat(value["expiry_date"])
    except (ValueError, TypeError):
        return None
    return value


def tracked_attachment(model, record_id, attachment_id, kinds):
    parent(model, record_id)
    records = odoo.execute("ir.attachment", "search_read", [[
        ["id", "=", attachment_id], ["res_model", "=", model], ["res_id", "=", record_id],
        ["type", "=", "binary"], ["public", "=", False],
    ]], {"fields": ["id", "name", "description"], "limit": 1})
    if not records or not (value := metadata(records[0])) or value.get("kind") not in kinds:
        raise HTTPException(404, "Tracked document not found for this record.")
    return records[0], value


def document_checklist(model, record_id, kinds):
    parent(model, record_id)
    records = odoo.execute("ir.attachment", "search_read", [[
        ["res_model", "=", model], ["res_id", "=", record_id], ["type", "=", "binary"],
        ["public", "=", False], ["description", "ilike", "[Klynx metadata:document:"],
    ]], {"fields": ["id", "name", "description"], "order": "id desc"})
    latest = {}
    for attachment in records:
        value = metadata(attachment)
        if value is None:
            raise HTTPException(409, "A tracked document has invalid metadata. Review its attachment in Odoo.")
        if value.get("kind") in kinds:
            latest.setdefault(value["kind"], (attachment, value))
    documents = []
    for kind, label in kinds.items():
        item = {"kind": kind, "label": label, "status": "missing", "id": None,
                "filename": None, "number": "", "expiry_date": None, "verified": False}
        if kind in latest:
            attachment, value = latest[kind]
            expired = bool(value.get("expiry_date") and value["expiry_date"] < date.today().isoformat())
            item.update(id=attachment["id"], filename=attachment["name"], number=value["number"],
                        expiry_date=value.get("expiry_date"), verified=value["verified"],
                        status="expired" if expired else "verified" if value["verified"] else "uploaded")
        documents.append(item)
    return {"documents": documents, "ready": all(item["status"] == "verified" for item in documents)}


def document_router(model: Literal["res.partner", "fleet.vehicle"], kinds: dict[str, str]):
    """Reuse the same workflow under customers and the fleet without exposing arbitrary models."""
    router = APIRouter(prefix="/{record_id}/documents", tags=["Documents"])

    @router.get("")
    def checklist(record_id: int):
        return document_checklist(model, record_id, kinds)

    @router.post("")
    def upload(record_id: int, data: DocumentUpload):
        parent(model, record_id)
        if data.kind not in kinds:
            raise HTTPException(422, "Choose an available document type.")
        try:
            content = base64.b64decode(data.content, validate=True)
        except (ValueError, binascii.Error):
            raise HTTPException(422, "Invalid document content.") from None
        if not content or len(content) > MAX_FILE_BYTES:
            raise HTTPException(413, "Document must be at most 600 KiB. Compress the scan before uploading.")
        mime, extension = file_type(content)
        value = {"version": 1, "kind": data.kind, "number": data.number.strip(),
                 "expiry_date": data.expiry_date.isoformat() if data.expiry_date else None, "verified": False}
        attachment_id = odoo.execute("ir.attachment", "create", [{
            "name": f"{data.kind}.{extension}", "type": "binary", "datas": data.content,
            "mimetype": mime, "res_model": model, "res_id": record_id, "public": False,
            "description": write_metadata("", KEY, value),
        }])
        if not attachment_id:
            raise HTTPException(502, "The document could not be saved.")
        return {"success": True, "attachment_id": attachment_id}

    @router.patch("/{attachment_id}")
    def update(record_id: int, attachment_id: int, data: DocumentUpdate):
        attachment, value = tracked_attachment(model, record_id, attachment_id, kinds)
        value.update(number=data.number.strip(), verified=data.verified,
                     expiry_date=data.expiry_date.isoformat() if data.expiry_date else None)
        if data.verified and data.expiry_date and data.expiry_date < date.today():
            raise HTTPException(422, "An expired document cannot be marked verified.")
        if not odoo.execute("ir.attachment", "write", [[attachment_id],
                            {"description": write_metadata(attachment["description"], KEY, value)}]):
            raise HTTPException(502, "Document changes could not be saved.")
        return {"success": True}

    @router.get("/{attachment_id}/download")
    def download(record_id: int, attachment_id: int):
        tracked_attachment(model, record_id, attachment_id, kinds)
        records = odoo.execute("ir.attachment", "read", [[attachment_id]], {"fields": ["datas"]})
        try:
            content = base64.b64decode(records[0].get("datas") or "", validate=True)
        except (ValueError, IndexError, binascii.Error):
            raise HTTPException(409, "The stored document is unavailable.") from None
        if not content or len(content) > MAX_FILE_BYTES:
            raise HTTPException(409, "The stored document is unavailable.")
        mime, extension = file_type(content)
        return {"content": base64.b64encode(content).decode(), "mime": mime,
                "filename": f"document-{attachment_id}.{extension}"}

    return router
