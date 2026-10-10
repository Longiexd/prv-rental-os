"""Reminder boundaries, optional contracts, ownership and private plan storage."""
from datetime import date, timedelta
from unittest.mock import patch
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from app.core.documents import checklist_from_records, expiry_reminder
from app.core.record_metadata import write_metadata, read_metadata
from app.verticals.car_rental import fleet_care as care


def vehicle():
    return {"id": 7, "name": "Car", "license_plate": "TEST", "odometer": 9500, "odometer_unit": "kilometers", "state_id": [1, "Available"]}


def scan(kind, expiry=None, verified=True, attachment_id=1):
    return {"id": attachment_id, "name": "scan.pdf", "res_id": 7,
            "description": write_metadata("", "document", {"version": 1, "kind": kind, "number": "123", "verified": verified, "expiry_date": expiry})}


def complete():
    return [scan(kind, (date.today()+timedelta(days=90)).isoformat() if kind != "registration" else None) for kind in care.KINDS if kind not in care.OPTIONAL]


def test_missing_documents_red_and_optional_contracts_not_required():
    result=care.vehicle_attention(vehicle(), [])
    assert result["missing_count"] == 3
    assert {item["kind"] for item in result["alerts"]} == {"insurance", "registration", "technical_inspection"}
    assert all(item["severity"] == "danger" for item in result["alerts"])


def test_complete_fleet_ignores_unconfigured_optional_contracts():
    assert care.vehicle_attention(vehicle(),complete())["alerts"] == []
    assert checklist_from_records(complete(),care.KINDS)["ready"]


def test_renewed_scan_supersedes_expired_scan_and_preserves_history():
    old=scan("insurance",(date.today()-timedelta(days=1)).isoformat())
    new=scan("insurance",(date.today()+timedelta(days=100)).isoformat(),attachment_id=2)
    records=[new,old,*[row for row in complete() if read_metadata(row["description"],"document")["kind"]!="insurance"]]
    assert care.vehicle_attention(vehicle(),records)["alerts"] == []
    assert len(records)==4


@pytest.mark.parametrize("days,reason,severity", [(-1,"expired","danger"),(0,"renewal","warning"),(15,"renewal","warning"),(60,None,None)])
def test_insurance_expiry_boundaries(days,reason,severity):
    records=[scan("insurance",(date.today()+timedelta(days=days)).isoformat())]+[row for row in complete() if read_metadata(row["description"],"document")["kind"]!="insurance"]
    alerts=care.vehicle_attention(vehicle(),records)["alerts"]
    if reason is None: assert alerts==[]
    else: assert alerts[0]["reason"]==reason and alerts[0]["severity"]==severity


def test_month_end_renewal_window():
    assert expiry_reminder(date(2028,3,31))=="2028-02-29"
    assert expiry_reminder(date(2027,1,31))=="2026-12-31"


def test_date_missing_and_unverified_are_reminders():
    alerts=care.vehicle_attention(vehicle(),[scan("insurance",verified=False)])["alerts"]
    assert {a["reason"] for a in alerts if a["kind"]=="insurance"}=={"uploaded","date_missing"}


def test_optional_contract_only_alerts_after_upload():
    alerts=care.vehicle_attention(vehicle(),[*complete(),scan("lease",(date.today()+timedelta(days=10)).isoformat())])["alerts"]
    assert len(alerts)==1 and alerts[0]["kind"]=="lease"


@pytest.mark.parametrize("target,distance,reason", [(9500,500,"due"),(9999,500,"soon"),(10001,500,None)])
def test_oil_change_odometer_boundary(target,distance,reason):
    plan=care.MaintenancePlan(next_odometer=target,reminder_distance=distance).model_dump(mode="json")
    alerts=care.vehicle_attention(vehicle(),complete(),plan)["alerts"]
    if reason is None: assert not alerts
    else: assert alerts[0]["reason"]==reason


def test_oil_change_date_and_clearing_targets():
    plan=care.MaintenancePlan(next_date=date.today()).model_dump(mode="json")
    assert care.vehicle_attention(vehicle(),complete(),plan)["alerts"][0]["reason"]=="due"
    assert care.vehicle_attention(vehicle(),complete(),care.MaintenancePlan().model_dump(mode="json"))["alerts"]==[]


@pytest.mark.parametrize("kwargs", [{"next_odometer":-1},{"next_odometer":float("inf")},{"reminder_distance":-1}])
def test_invalid_plan_values_rejected(kwargs):
    with pytest.raises(ValidationError): care.MaintenancePlan(**kwargs)


def test_missing_owner_rejected_before_plan_write():
    with patch.object(care.odoo,"execute",return_value=[]) as execute:
        with pytest.raises(HTTPException) as error: care.save_plan(7,care.MaintenancePlan(next_odometer=10000))
    assert error.value.status_code==404 and execute.call_count==1


def test_plan_write_private_and_scoped_to_vehicle():
    calls=[]
    def execute(model,method,args,kwargs=None):
        calls.append((model,method,args))
        return [{"id":7}] if model=="fleet.vehicle" else 12
    with patch.object(care.odoo,"execute",side_effect=execute): care.save_plan(7,care.MaintenancePlan(next_odometer=10000))
    record=calls[-1][2][0]
    assert record["public"] is False and record["res_id"]==7 and record["res_model"]=="fleet.vehicle"
    assert care.plan_from_record(record)["next_odometer"]==10000


def test_aggregate_batches_documents_and_skips_archived_vehicles():
    calls=[]
    def execute(model,method,args,kwargs=None):
        calls.append((model,args,kwargs))
        return [vehicle()] if model=="fleet.vehicle" else complete()
    with patch.object(care.odoo,"execute",side_effect=execute): result=care.fleet_care()
    assert len(calls)==2 and calls[0][1]==[[["active","=",True]]]
    assert ["res_id","in",[7]] in calls[1][1][0]
    assert result["vehicles"][0]["alerts"]==[]


def test_malformed_plan_visible_as_review_alert():
    bad={"id":9,"res_id":7,"name":"plan","description":write_metadata("","fleet_care",{"version":1,"next_odometer":-1})}
    with patch.object(care.odoo,"execute",side_effect=[[vehicle()],[bad,*complete()]]): result=care.fleet_care()
    assert result["vehicles"][0]["alerts"][0]["reason"]=="review"


def test_failed_plan_create_is_not_reported_as_success():
    with patch.object(care.odoo,"execute",side_effect=[[{"id":7}],False]):
        with pytest.raises(HTTPException) as error: care.save_plan(7,care.MaintenancePlan(next_odometer=10000))
    assert error.value.status_code==502


def test_malformed_latest_document_requires_review_instead_of_old_valid_scan():
    invalid={"id":9,"res_id":7,"name":"bad","description":"[Klynx metadata:document:invalid]"}
    with patch.object(care.odoo,"execute",side_effect=[[vehicle()],[invalid,*complete()]]): result=care.fleet_care()
    assert any(alert["reason"]=="review" for alert in result["vehicles"][0]["alerts"])
