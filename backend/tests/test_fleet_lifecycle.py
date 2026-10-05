from datetime import date, timedelta
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.routes import cars, booking_changes as changes, rentals, sales
from app.core.bookings import QUOTATION_TAG
from app.verticals.car_rental.states import (
    PICKED_UP_TAG, RETURNED_TAG, booking_state, group_bookings, target_state,
)


def booking(**overrides):
    today = date.today()
    return {
        "id": 12, "state": "sale", "note": "[Rental OS fleet.vehicle:4]",
        "date_order": str(today), "commitment_date": str(today + timedelta(days=3)),
        **overrides,
    }


@pytest.mark.parametrize("state,tag", [
    ("draft", ""), ("sent", ""), ("cancel", ""),
    ("sale", QUOTATION_TAG), ("sale", RETURNED_TAG),
])
def test_nonblocking_bookings_never_drive_fleet_state(state, tag):
    order = booking(state=state, note=f"[Rental OS fleet.vehicle:4]{tag}")
    assert booking_state([order]) is None
    assert group_bookings([order]) == {}


def test_confirmed_booking_stays_reserved_until_actual_handover():
    order = booking()
    assert booking_state([order]) == "Réservé"
    order["note"] += PICKED_UP_TAG
    assert booking_state([order]) == "Louée"
    order["commitment_date"] = str(date.today() - timedelta(days=1))
    assert booking_state([order]) == "Retour dû"
    order["note"] += RETURNED_TAG
    assert booking_state([order]) is None


def test_overdue_booking_wins_over_current_and_future_bookings():
    overdue = booking(commitment_date=str(date.today() - timedelta(days=1)), note=f"[Rental OS fleet.vehicle:4]{PICKED_UP_TAG}")
    picked_up = booking(note=f"[Rental OS fleet.vehicle:4]{PICKED_UP_TAG}")
    future = booking(date_order=str(date.today() + timedelta(days=2)))
    assert booking_state([picked_up, future, overdue]) == "Retour dû"


def test_missed_pickup_stays_reserved_even_after_the_planned_return():
    missed = booking(date_order=str(date.today() - timedelta(days=3)),
                     commitment_date=str(date.today() - timedelta(days=1)))
    assert booking_state([missed]) == "Réservé"
    assert target_state("Louée", [missed]) == "Réservé"


@pytest.mark.parametrize("state", ["Réservé", "Louée", "Loué", "Retour dû", "Reserved", "Rented"])
def test_stale_booking_state_becomes_available(state):
    assert target_state(state, []) == "Disponible"


@pytest.mark.parametrize("state", ["Nettoyage", "Cleaning", "Maintenance", "Entretien", "En réparation"])
def test_operational_state_survives_a_future_confirmed_booking(state):
    assert target_state(state, [booking()]) is None


def test_sync_does_not_query_bookings_or_write_manual_state():
    with patch.object(cars.odoo, "execute", return_value=[{"state_id": [3, "Maintenance"]}]) as rpc:
        assert cars.sync_vehicle_state(4) is None
    assert rpc.call_count == 1


def test_sync_does_not_rewrite_matching_state():
    with patch.object(cars.odoo, "execute") as rpc:
        assert cars.sync_vehicle_state(4, vehicle={"state_id": [3, "Réservé"]}, orders=[booking()]) == "Réservé"
    rpc.assert_not_called()


def test_bulk_sync_batches_reads_and_reuses_state_lookup():
    vehicles = [{"id": 4, "state_id": [1, "Disponible"]},
                {"id": 5, "state_id": [1, "Disponible"]},
                {"id": 6, "state_id": [2, "Nettoyage"]}]
    orders = [booking(), booking(id=13, note="[Rental OS fleet.vehicle:5]")]
    with patch.object(cars.odoo, "execute", side_effect=[vehicles, orders, True, True]) as rpc, \
         patch.object(cars, "find_state_id", return_value=8) as find:
        assert cars.sync_all_vehicles() == {"synced": 3, "updated": {4: "Réservé", 5: "Réservé"}}
    assert [(call.args[0], call.args[1]) for call in rpc.call_args_list] == [
        ("fleet.vehicle", "search_read"), ("sale.order", "search_read"),
        ("fleet.vehicle", "write"), ("fleet.vehicle", "write"),
    ]
    find.assert_called_once_with("Réservé")


def test_pickup_rejects_returned_booking_before_any_write():
    with patch.object(changes, "get_record", return_value=booking(note=f"[Rental OS fleet.vehicle:4]{RETURNED_TAG}")), \
         patch.object(changes.odoo, "execute") as rpc, pytest.raises(HTTPException) as error:
        changes.mark_picked_up(12)
    assert error.value.status_code == 409
    rpc.assert_not_called()


def test_pickup_marks_only_this_booking_and_refreshes_linked_car():
    with patch.object(changes, "get_record", side_effect=[booking(), {"active": True, "state_id": [1, "Réservé"]}]), \
         patch.object(changes.odoo, "execute", return_value=True) as rpc, \
         patch.object(changes, "refresh_fleet") as refresh:
        assert changes.mark_picked_up(12) == {"success": True}
    assert rpc.call_args.args[2][0] == [12]
    assert PICKED_UP_TAG in rpc.call_args.args[2][1]["note"]
    refresh.assert_called_once_with(4)


def test_repeated_pickup_repairs_fleet_without_another_handover_write():
    with patch.object(changes, "get_record", return_value=booking(note=f"[Rental OS fleet.vehicle:4]{PICKED_UP_TAG}")), \
         patch.object(changes.odoo, "execute") as rpc, patch.object(changes, "refresh_fleet") as refresh:
        assert changes.mark_picked_up(12) == {"success": True, "already": True}
    rpc.assert_not_called()
    refresh.assert_called_once_with(4)


@pytest.mark.parametrize("state", ["Nettoyage", "Maintenance"])
def test_pickup_requires_operational_car(state):
    with patch.object(changes, "get_record", side_effect=[booking(), {"active": True, "state_id": [1, state]}]), \
         patch.object(changes.odoo, "execute") as rpc, pytest.raises(HTTPException):
        changes.mark_picked_up(12)
    rpc.assert_not_called()


def test_future_pickup_requires_a_date_edit_before_handover():
    with patch.object(changes, "get_record", return_value=booking(date_order=str(date.today() + timedelta(days=2)))), \
         patch.object(changes.odoo, "execute") as rpc, pytest.raises(HTTPException):
        changes.mark_picked_up(12)
    rpc.assert_not_called()


@pytest.mark.parametrize("state,tag,expected", [
    ("draft", "", True), ("sale", QUOTATION_TAG, True),
    ("sale", "", False), ("sale", RETURNED_TAG, True), ("cancel", "", True),
])
def test_vehicle_options_block_only_unreturned_confirmed_bookings(state, tag, expected):
    def rpc(model, method, args, kwargs):
        if model == "fleet.vehicle":
            return [{"id": 4, "name": "Test car", "license_plate": "TEST-4",
                     "state_id": [1, "Disponible"], "category_id": False, "brand_id": False}]
        if model == "sale.order":
            return [booking(state=state, note=f"[Rental OS fleet.vehicle:4]{tag}")]
        return []
    with patch.object(rentals.odoo, "execute", side_effect=rpc):
        result = rentals.get_rental_options(date.today(), date.today() + timedelta(days=3))
    assert result["vehicles"][0]["available"] is expected


def test_editing_dates_preserves_existing_pickup_and_return_times():
    order = booking(partner_id=[2, "Client"], locked=False,
                    date_order=f"{date.today()} 09:30:00",
                    commitment_date=f"{date.today() + timedelta(days=3)} 17:45:00")
    data = rentals.RentalCreate(partner_id=2, vehicle_id=4, start_date=date.today(),
                                end_date=date.today() + timedelta(days=4),
                                products=[{"product_id": 9}])
    def records(model, record_id, fields):
        return order if model == "sale.order" else {"active": True, "sale_ok": True}
    with patch.object(changes, "get_record", side_effect=records), patch.object(changes, "ensure_available"), \
         patch.object(changes, "refresh_fleet"), patch.object(changes.odoo, "execute", side_effect=[[], True]) as rpc:
        changes.update_booking(12, data)
    values = rpc.call_args.args[2][1]
    assert values["date_order"].endswith("09:30:00")
    assert values["commitment_date"].endswith("17:45:00")


def test_fleet_booking_feed_keeps_older_records_beyond_recent_sales_limit():
    rows = [booking(id=index, name=f"S{index}", partner_id=False, opportunity_id=False,
                    order_line=[], amount_total=100, invoice_status="to invoice")
            for index in range(121)]
    def rpc(model, method, args, kwargs):
        return rows[:kwargs.get("limit", len(rows))]
    with patch.object(sales.odoo, "execute", side_effect=rpc) as execute:
        assert sales.get_sales()["count"] == 100
        assert sales.get_sales(for_fleet=True)["count"] == 121
    domain = execute.call_args.args[2][0]
    assert ["state", "!=", "cancel"] in domain
    assert ["note", "not ilike", RETURNED_TAG] in domain


@pytest.mark.parametrize("paid", [90, 300])
def test_deposit_or_direct_full_payment_can_confirm_booking(paid):
    order = booking(note=f"[Rental OS fleet.vehicle:4]{QUOTATION_TAG}",
                    invoice_ids=[34], amount_total=300)
    invoice = {"amount_total": 300, "amount_residual": 300 - paid,
               "move_type": "out_invoice"}
    with patch.object(changes, "get_record", return_value=order), \
         patch.object(changes, "ensure_available"), patch.object(changes, "refresh_fleet"), \
         patch.object(changes.odoo, "execute", side_effect=[[invoice], True]):
        assert changes.confirm_booking(12)["booking_status"] == "confirmed"
