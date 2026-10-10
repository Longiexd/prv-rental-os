"""Tenant-scoped fleet reminders; no customer activities or fleet states are mutated."""
import base64
from datetime import date
from collections import defaultdict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.odoo_client import odoo
from app.core.documents import checklist_from_records, parent
from app.core.record_metadata import read_metadata, write_metadata

router = APIRouter()
KINDS = {"insurance": "Insurance", "registration": "Registration", "technical_inspection": "Technical inspection",
         "lease": "Lease contract", "service_contract": "Service contract"}
OPTIONAL = {"lease", "service_contract"}
KEY = "fleet_care"


class MaintenancePlan(BaseModel):
    next_odometer: float | None = Field(default=None, ge=0, le=100000000, allow_inf_nan=False)
    next_date: date | None = None
    reminder_distance: float = Field(default=500, ge=0, le=1000000, allow_inf_nan=False)


def plan_from_record(record):
    value = read_metadata(record.get("description"), KEY)
    if not value or value.get("version") != 1:
        raise ValueError("Invalid maintenance plan")
    return MaintenancePlan.model_validate(value).model_dump(mode="json")


def vehicle_attention(vehicle, records, plan=None, today=None):
    today = today or date.today()
    alerts = []
    checklist = checklist_from_records(records, KINDS)
    for doc in checklist["documents"]:
        if doc["kind"] in OPTIONAL and not doc["id"]:
            continue
        state = doc["status"]
        if state in {"missing", "expired", "uploaded"}:
            alerts.append({"kind": doc["kind"], "reason": state, "severity": "warning" if state == "uploaded" else "danger",
                           "date": doc["expiry_date"]})
        elif doc["expiry_date"] and doc["reminder_date"] <= today.isoformat():
            alerts.append({"kind": doc["kind"], "reason": "renewal", "severity": "warning", "date": doc["expiry_date"]})
        if doc["id"] and doc["kind"] in {"insurance", "technical_inspection", *OPTIONAL} and not doc["expiry_date"]:
            alerts.append({"kind": doc["kind"], "reason": "date_missing", "severity": "warning", "date": None})
    odometer = vehicle.get("odometer") or 0
    if plan:
        remaining = None if plan["next_odometer"] is None else plan["next_odometer"] - odometer
        due = bool((remaining is not None and remaining <= 0) or (plan["next_date"] and plan["next_date"] <= today.isoformat()))
        soon = bool((remaining is not None and remaining <= plan["reminder_distance"]) or
                    (plan["next_date"] and (date.fromisoformat(plan["next_date"]) - today).days <= 30))
        if due or soon:
            alerts.append({"kind": "oil_change", "reason": "due" if due else "soon", "severity": "danger" if due else "warning",
                           "date": plan["next_date"], "remaining": remaining})
    return {"id": vehicle["id"], "name": vehicle.get("name") or "", "plate": vehicle.get("license_plate") or "",
            "state": vehicle["state_id"][1] if vehicle.get("state_id") else "", "odometer": odometer,
            "unit": vehicle.get("odometer_unit") or "kilometers", "plan": plan, "documents": checklist["documents"],
            "alerts": alerts, "missing_count": sum(doc["status"] == "missing" and doc["kind"] not in OPTIONAL for doc in checklist["documents"])}


@router.get("/care")
def fleet_care():
    vehicles = odoo.execute("fleet.vehicle", "search_read", [[["active", "=", True]]],
                            {"fields": ["id", "name", "license_plate", "state_id", "odometer", "odometer_unit"], "order": "name"})
    if not vehicles:
        return {"vehicles": []}
    records = odoo.execute("ir.attachment", "search_read", [[
        ["res_model", "=", "fleet.vehicle"], ["res_id", "in", [v["id"] for v in vehicles]], ["public", "=", False], ["type", "=", "binary"],
        "|", ["description", "ilike", "[Klynx metadata:document:"], ["description", "ilike", "[Klynx metadata:fleet_care:"],
    ]], {"fields": ["id", "res_id", "name", "description", "checksum"], "order": "id desc"})
    documents, plans = defaultdict(list), {}
    invalid = set()
    for record in records:
        if "[Klynx metadata:fleet_care:" in (record.get("description") or ""):
            if record["res_id"] not in plans:
                try:
                    plans[record["res_id"]] = plan_from_record(record)
                except (ValueError, TypeError):
                    invalid.add(record["res_id"])
                    plans[record["res_id"]] = None
        else:
            documents[record["res_id"]].append(record)
    result = []
    for vehicle in vehicles:
        try:
            item = vehicle_attention(vehicle, documents[vehicle["id"]], plans.get(vehicle["id"]))
        except HTTPException as error:
            if error.status_code != 409:
                raise
            item = vehicle_attention(vehicle, [], plans.get(vehicle["id"]))
            item["alerts"].append({"kind": "documents", "reason": "review", "severity": "danger", "date": None})
        if vehicle["id"] in invalid:
            item["alerts"].append({"kind": "oil_change", "reason": "review", "severity": "danger", "date": None})
        result.append(item)
    return {"vehicles": result}


@router.put("/{vehicle_id}/maintenance-plan")
def save_plan(vehicle_id: int, data: MaintenancePlan):
    parent("fleet.vehicle", vehicle_id)
    value = {"version": 1, **data.model_dump(mode="json")}
    # Append revisions; the highest attachment id is authoritative. Clearing both targets disables reminders.
    created = odoo.execute("ir.attachment", "create", [{"name": "Klynx maintenance plan", "res_model": "fleet.vehicle", "res_id": vehicle_id,
                 "type": "binary", "public": False, "mimetype": "application/json",
                 "datas": base64.b64encode(b"{}").decode(), "description": write_metadata("", KEY, value)}])
    if not created:
        raise HTTPException(502, "Maintenance reminder could not be saved.")
    return value
