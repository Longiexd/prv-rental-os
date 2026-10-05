from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.odoo_client import odoo
from app.routes.calendar import QUOTATION_TAG, booking_status, rental_vehicle_id
from app.verticals.car_rental.states import (
    PICKED_UP_TAG, RETURNED_TAG, booking_state, group_bookings,
    is_operational_state, normalize_state, target_state,
)


router = APIRouter(
    prefix="/cars",
    tags=["Cars"]
)


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


@router.post("/{vehicle_id}/return")
def confirm_return(vehicle_id: int, body: ReturnRequest = ReturnRequest()):
    """
    "Véhicule retourné" — marks the active booking as returned
    and moves the vehicle to whichever state the agent picked
    (Nettoyage by default, matching "after return, suggest
    cleaning" — but Disponible or Maintenance are valid too,
    e.g. a car returned in perfect condition doesn't need to
    sit in a cleaning queue).
    """

    if body.next_state not in ("Nettoyage", "Disponible", "Maintenance"):
        raise HTTPException(
            status_code=400,
            detail="next_state must be Nettoyage, Disponible, or Maintenance.",
        )

    orders = [order for order in get_active_orders_for_vehicle(vehicle_id)
              if (order.get("date_order") or "9999")[:10] <= date.today().isoformat()]

    if not orders:
        raise HTTPException(
            status_code=400,
            detail=(
                "This vehicle has no active booking to return "
                "— it may already have been marked returned."
            ),
        )

    for order in orders:
        note = order.get("note") or ""

        odoo.execute(
            "sale.order",
            "write",
            [
                [order["id"]],
                {"note": f"{note}\n{RETURNED_TAG}".strip()},
            ],
        )

    odoo.execute(
        "fleet.vehicle",
        "write",
        [[vehicle_id], {"state_id": find_state_id(body.next_state)}],
    )

    return {"vehicle_id": vehicle_id, "state": body.next_state}


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
