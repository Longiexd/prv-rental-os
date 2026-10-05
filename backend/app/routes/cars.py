from datetime import datetime, timezone
import math

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.odoo_client import odoo
from app.core.documents import document_router
from app.core.record_metadata import write_metadata
from app.verticals.car_rental.returns import (
    RETURN_RECORD_KEY, ReturnRecord, can_return, return_record,
)
from app.routes.calendar import QUOTATION_TAG, booking_status, rental_vehicle_id
from app.verticals.car_rental.states import (
    PICKED_UP_TAG, RETURNED_TAG, booking_state, group_bookings,
    is_operational_state, normalize_state, target_state,
)


router = APIRouter(
    prefix="/cars",
    tags=["Cars"]
)
router.include_router(document_router("fleet.vehicle", {
    "insurance": "Assurance / Insurance", "registration": "Carte grise",
    "technical_inspection": "Visite technique",
}))


# =========================================================
# FLEET STATE SYNC
#
# fleet.vehicle.state_id is a plain many2one to a small
# "stages" model (fleet.vehicle.state) — Odoo doesn't manage
# it automatically, and until now nothing in this backend
# ever wrote to it either: creating a rental had zero effect
# on the vehicle's actual Fleet state.
#
# This computes the correct stage from real bookings (reusing
# the same [Rental OS fleet.vehicle:ID] note convention
# calendar.py already established) rather than adding a
# second, parallel status system.
#
# "Returned" is tracked the same way: a
# [Rental OS returned] marker appended to the same
# order note, since sale.order has no field for this and this
# keeps the convention in one place instead of inventing a
# second one.
# =========================================================

def find_state_id(name: str) -> int:
    """
    Looks up a fleet.vehicle.state by name, creating it if it
    doesn't exist yet (e.g. "Réservé" / "Retour dû" may not be
    configured in Odoo yet). Idempotent — safe to call anytime.
    """

    existing = odoo.execute(
        "fleet.vehicle.state",
        "search_read",
        [[["name", "=", name]]],
        {"fields": ["id"], "limit": 1},
    )

    if existing:
        return existing[0]["id"]

    return odoo.execute(
        "fleet.vehicle.state",
        "create",
        [{"name": name}],
    )


def get_active_orders_for_vehicle(vehicle_id: int) -> list[dict]:
    """Confirmed bookings for this vehicle that have not been returned."""

    orders = odoo.execute(
        "sale.order",
        "search_read",
        [
            [
                ["state", "in", ["sale", "done"]],
                ["note", "ilike", f"fleet.vehicle:{vehicle_id}]"],
                ["note", "not ilike", RETURNED_TAG],
                ["note", "not ilike", QUOTATION_TAG],
            ]
        ],
        {
            "fields": [
                "id",
                "name",
                "partner_id",
                "note",
                "state",
                "date_order",
                "commitment_date",
            ],
        },
    )

    return [
        order
        for order in orders
        if rental_vehicle_id(order.get("note")) == vehicle_id
        and RETURNED_TAG not in (order.get("note") or "")
        and booking_status(order) == "confirmed"
    ]


def compute_target_state(vehicle_id: int, orders: list[dict] | None = None) -> str | None:
    return booking_state(
        get_active_orders_for_vehicle(vehicle_id) if orders is None else orders,
    )


def sync_vehicle_state(vehicle_id: int, *, vehicle: dict | None = None,
                       orders: list[dict] | None = None,
                       state_ids: dict[str, int] | None = None) -> str | None:
    """Recompute booking states without overwriting manual operations."""
    if vehicle is None:
        records = odoo.execute("fleet.vehicle", "search_read",
                               [[["id", "=", vehicle_id]]],
                               {"fields": ["state_id"], "limit": 1})
        if not records:
            raise HTTPException(404, "Vehicle not found.")
        vehicle = records[0]
    state = vehicle.get("state_id")
    current = state[1] if state else None
    if is_operational_state(current):
        return None
    active_orders = get_active_orders_for_vehicle(vehicle_id) if orders is None else orders
    target = target_state(current, active_orders)
    if not target:
        return None
    if normalize_state(current) != normalize_state(target):
        cache = state_ids if state_ids is not None else {}
        if target not in cache:
            cache[target] = find_state_id(target)
        odoo.execute("fleet.vehicle", "write",
                     [[vehicle_id], {"state_id": cache[target]}])
    return target


@router.post("/sync")
def sync_all_vehicles():
    vehicles = odoo.execute(
        "fleet.vehicle",
        "search_read",
        [[["active", "=", True]]],
        {"fields": ["id", "state_id"]},
    )
    orders = odoo.execute("sale.order", "search_read", [[
        ["state", "in", ["sale", "done"]],
        ["note", "ilike", "[Rental OS fleet.vehicle:"],
        ["note", "not ilike", RETURNED_TAG],
        ["note", "not ilike", QUOTATION_TAG],
    ]], {"fields": ["id", "note", "state", "date_order", "commitment_date"]}) if vehicles else []
    grouped = group_bookings(orders)
    state_ids = {}
    updated = {}

    for vehicle in vehicles:
        result = sync_vehicle_state(vehicle["id"], vehicle=vehicle,
                                    orders=grouped.get(vehicle["id"], []), state_ids=state_ids)

        if result:
            updated[vehicle["id"]] = result

    return {"synced": len(vehicles), "updated": updated}


class ReturnRequest(BaseModel):
    # What the vehicle should become right after return — the
    # agent's call based on the car's actual condition, not
    # forced through cleaning if it doesn't need it.
    next_state: str = "Nettoyage"
    order_id: int | None = Field(default=None, gt=0)
    odometer: float | None = Field(default=None, ge=0, allow_inf_nan=False, strict=True)
    return_notes: str = Field(default="", max_length=4000)
    damage_notes: str = Field(default="", max_length=4000)


def return_vehicle(vehicle_id: int):
    records = odoo.execute("fleet.vehicle", "search_read", [[["id", "=", vehicle_id]]], {
        "fields": ["id", "name", "license_plate", "active", "state_id", "odometer", "odometer_unit"], "limit": 1,
    })
    if not records:
        raise HTTPException(404, "Vehicle not found.")
    return records[0]


@router.get("/{vehicle_id}/return-options")
def return_options(vehicle_id: int):
    vehicle = return_vehicle(vehicle_id)
    orders = [order for order in get_active_orders_for_vehicle(vehicle_id) if can_return(order)]
    return {"vehicle": {key: vehicle.get(key) for key in
                       ("id", "name", "license_plate", "odometer", "odometer_unit")},
            "bookings": [{"id": order["id"], "name": order.get("name") or f"Booking #{order['id']}",
                          "customer": order["partner_id"][1] if order.get("partner_id") else None,
                          "pickup_date": order.get("date_order"), "return_date": order.get("commitment_date"),
                          "pending_return": record.model_dump(mode="json") if
                          (record := return_record(order.get("note"))) and record.status == "pending" else None}
                         for order in orders]}


@router.post("/{vehicle_id}/return")
def confirm_return(vehicle_id: int, body: ReturnRequest = ReturnRequest()):
    """Return one booking; retain a recoverable record across separate RPCs."""

    if body.next_state not in ("Nettoyage", "Disponible", "Maintenance"):
        raise HTTPException(
            status_code=400,
            detail="next_state must be Nettoyage, Disponible, or Maintenance.",
        )

    if body.order_id:
        records = odoo.execute("sale.order", "search_read", [[["id", "=", body.order_id]]], {
            "fields": ["id", "note", "state", "date_order"], "limit": 1,
        })
        if not records:
            raise HTTPException(404, "Booking not found.")
        order = records[0]
        if rental_vehicle_id(order.get("note")) != vehicle_id:
            raise HTTPException(409, "This booking belongs to a different vehicle.")
    else:
        orders = [order for order in get_active_orders_for_vehicle(vehicle_id) if can_return(order)]
        if len(orders) != 1:
            raise HTTPException(409, "Choose the booking to return. No unique collected booking is available.")
        order = orders[0]

    note = order.get("note") or ""
    saved = return_record(note)
    if f"[Klynx metadata:{RETURN_RECORD_KEY}:" in note and not saved:
        raise HTTPException(409, "The saved return cannot be read. Review it in Odoo before returning this booking.")
    if saved and (saved.order_id != order["id"] or saved.vehicle_id != vehicle_id):
        raise HTTPException(409, "The saved return does not match this booking. Review it in Odoo.")
    if saved and (saved.odometer != body.odometer or saved.next_state != body.next_state
                  or saved.return_notes != body.return_notes.strip() or saved.damage_notes != body.damage_notes.strip()):
        raise HTTPException(409, "This booking has a saved return. Resume it with the saved values.")
    if RETURNED_TAG in note:
        if saved and saved.status == "completed":
            return {"vehicle_id": vehicle_id, "state": saved.next_state, "order_id": order["id"],
                    "odometer": saved.odometer, "return_record": saved.model_dump(mode="json"), "already": True}
        raise HTTPException(409, "This booking is already returned. Refresh the rental.")
    if not can_return(order):
        raise HTTPException(409, "Only a collected confirmed booking can be returned. Validate pickup or cancel the uncollected booking.")
    if saved and saved.status != "pending":
        raise HTTPException(409, "The saved return is inconsistent. Review it in Odoo.")
    if body.order_id and body.odometer is None and not saved:
        raise HTTPException(422, "Enter the return odometer reading for this booking.")

    vehicle = return_vehicle(vehicle_id)
    current_odometer = float(vehicle.get("odometer") or 0)
    if not math.isfinite(current_odometer) or current_odometer < 0:
        raise HTTPException(409, "The vehicle's saved odometer reading is invalid. Review it in Odoo.")
    if body.odometer is not None and body.odometer < current_odometer:
        raise HTTPException(409, f"Return odometer cannot be below the vehicle's current reading ({current_odometer:g}).")
    unit = vehicle.get("odometer_unit") or "kilometers"
    if unit not in ("kilometers", "miles"):
        raise HTTPException(409, "The vehicle's odometer unit is unavailable. Review it in Odoo.")
    if saved and saved.odometer_unit != unit:
        raise HTTPException(409, "The vehicle's odometer unit changed. Review the saved return in Odoo.")
    state_id = find_state_id(body.next_state)
    if not saved:
        saved = ReturnRecord(status="pending", order_id=order["id"], vehicle_id=vehicle_id,
                             returned_at=datetime.now(timezone.utc), odometer=body.odometer,
                             previous_odometer=current_odometer, odometer_unit=unit,
                             next_state=body.next_state, return_notes=body.return_notes.strip(),
                             damage_notes=body.damage_notes.strip())
        note = write_metadata(note, RETURN_RECORD_KEY, saved.model_dump(mode="json"))
        if not odoo.execute("sale.order", "write", [[order["id"]], {"note": note}]):
            raise HTTPException(502, "Return details could not be saved. Keep this form and retry.")

    values = {}
    if not vehicle.get("state_id") or vehicle["state_id"][0] != state_id:
        values["state_id"] = state_id
    # Odoo's inverse creates a history entry. Equal-reading retries must not write it again.
    if body.odometer is not None and body.odometer > current_odometer:
        values["odometer"] = body.odometer
    if values:
        if not odoo.execute("fleet.vehicle", "write", [[vehicle_id], values]):
            raise HTTPException(502, "Return details saved, but the vehicle could not be updated. Retry with the saved details.")
    completed = saved.model_copy(update={"status": "completed"})
    note = write_metadata(note, RETURN_RECORD_KEY, completed.model_dump(mode="json"))
    if not odoo.execute("sale.order", "write", [[order["id"]], {"note": f"{note}\n{RETURNED_TAG}"}]):
        raise HTTPException(502, "Vehicle updated, but the booking return is unfinished. Retry with the saved details.")
    return {"vehicle_id": vehicle_id, "state": body.next_state, "order_id": order["id"],
            "odometer": body.odometer, "return_record": completed.model_dump(mode="json")}


@router.post("/{vehicle_id}/mark-available")
def mark_available(vehicle_id: int):
    """
    Explicit agent action once cleaning/checks are done.
    """

    return set_vehicle_state(vehicle_id, "Disponible")


def set_vehicle_state(vehicle_id: int, state: str) -> dict:
    """
    Directly sets a vehicle's Fleet stage, no active order
    required — used for agent-driven transitions that aren't
    tied to a specific booking (mark-available, needs-diagnosis).
    Distinct from confirm_return, which requires and tags an
    active booking.
    """

    odoo.execute(
        "fleet.vehicle",
        "write",
        [[vehicle_id], {"state_id": find_state_id(state)}],
    )

    return {"vehicle_id": vehicle_id, "state": state}


@router.post("/{vehicle_id}/needs-diagnosis")
def needs_diagnosis(vehicle_id: int):
    """
    From the fleet workflow: a car already in Nettoyage that
    turns out to need a mechanical look — moves it straight to
    Maintenance without requiring an active booking (there
    usually isn't one left at this point, since return already
    happened).
    """

    return set_vehicle_state(vehicle_id, "Maintenance")


# =========================================================
# GET CARS
# =========================================================

@router.get("")
def get_cars():

    vehicles = odoo.execute(
        "fleet.vehicle",
        "search_read",
        [],
        {
            "fields": [
                "id",
                "name",
                "license_plate",
                "model_id",
                "brand_id",
                "state_id",
                "category_id",
                "location",
                "odometer",
                "odometer_unit",
                "active",
            ],
            "order": "id desc",
            "limit": 200,
        }
    )

    cars = []

    for vehicle in vehicles:

        cars.append({
            "id": vehicle["id"],

            "name": vehicle["name"],

            "license_plate": vehicle["license_plate"],

            "model": (
                vehicle["model_id"][1]
                if vehicle["model_id"]
                else None
            ),

            "brand": (
                vehicle["brand_id"][1]
                if vehicle["brand_id"]
                else None
            ),

            "category": (
                vehicle["category_id"][1]
                if vehicle["category_id"]
                else None
            ),

            "status": (
                vehicle["state_id"][1]
                if vehicle["state_id"]
                else None
            ),

            "location": vehicle["location"],

            "odometer": vehicle["odometer"],

            "odometer_unit": vehicle["odometer_unit"],

            "active": vehicle["active"],
        })

    return {
        "count": len(cars),
        "cars": cars,
    }
