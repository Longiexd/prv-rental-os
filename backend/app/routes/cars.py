from datetime import date

from fastapi import APIRouter, HTTPException

from app.odoo_client import odoo
from app.routes.calendar import rental_vehicle_id


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
# [Rental OS returned:YYYY-MM-DD] marker appended to the same
# order note, since sale.order has no field for this and this
# keeps the convention in one place instead of inventing a
# second one.
# =========================================================

RETURNED_TAG = "[Rental OS returned]"


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
    """
    Non-cancelled orders for this vehicle that haven't been
    marked returned yet — includes draft quotations, since a
    booking should reserve the vehicle the moment it exists,
    not only once confirmed (that distinction is handled in
    compute_target_state, not here).
    """

    orders = odoo.execute(
        "sale.order",
        "search_read",
        [
            [
                ["state", "!=", "cancel"],
                ["note", "ilike", f"fleet.vehicle:{vehicle_id}]"],
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
            "limit": 200,
        },
    )

    return [
        order
        for order in orders
        if rental_vehicle_id(order.get("note")) == vehicle_id
        and RETURNED_TAG not in (order.get("note") or "")
    ]


def compute_target_state(vehicle_id: int) -> str | None:
    """
    - Louée: a CONFIRMED (sale/done) booking whose range covers
      today.
    - Retour dû: a CONFIRMED booking whose end date has passed.
    - Réservé: any booking exists at all (including a draft
      quotation) that isn't fully in the past — a booking
      reserves the vehicle the moment it's created, confirmed
      or not.
    - None: no booking currently needs to drive this vehicle's
      state, so its actual state (Disponible, Nettoyage,
      Maintenance...) is left alone. This sync is corrective
      only, never a wholesale takeover of every state.
    """

    orders = get_active_orders_for_vehicle(vehicle_id)

    if not orders:
        return None

    today = date.today().isoformat()
    has_upcoming_or_current = False
    has_overdue_confirmed = False

    for order in orders:
        start = (order.get("date_order") or "")[:10]
        end = (order.get("commitment_date") or "")[:10]
        confirmed = order.get("state") in ("sale", "done")

        if confirmed and start and end and start <= today <= end:
            return "Louée"

        if confirmed and end and today > end:
            has_overdue_confirmed = True
        elif not end or today <= end:
            has_upcoming_or_current = True

    if has_overdue_confirmed:
        return "Retour dû"

    if has_upcoming_or_current:
        return "Réservé"

    return None


def sync_vehicle_state(vehicle_id: int) -> str | None:
    """
    Computes and writes the correct state for one vehicle.
    Called right after a rental is created, and available via
    POST /cars/sync for the Fleet/Calendar pages to refresh all
    vehicles at once.
    """

    target = compute_target_state(vehicle_id)

    if not target:
        return None

    odoo.execute(
        "fleet.vehicle",
        "write",
        [[vehicle_id], {"state_id": find_state_id(target)}],
    )

    return target


@router.post("/sync")
def sync_all_vehicles():
    vehicles = odoo.execute(
        "fleet.vehicle",
        "search_read",
        [[["active", "=", True]]],
        {"fields": ["id"], "limit": 500},
    )

    updated = {}

    for vehicle in vehicles:
        result = sync_vehicle_state(vehicle["id"])

        if result:
            updated[vehicle["id"]] = result

    return {"synced": len(vehicles), "updated": updated}


@router.post("/{vehicle_id}/return")
def confirm_return(vehicle_id: int):
    """
    "Véhicule retourné" — marks the active booking as returned
    and moves the vehicle to Nettoyage, matching "after return,
    suggest cleaning" from the fleet workflow.
    """

    orders = get_active_orders_for_vehicle(vehicle_id)

    if not orders:
        raise HTTPException(
            status_code=400,
            detail="No active booking found for this vehicle.",
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
        [[vehicle_id], {"state_id": find_state_id("Nettoyage")}],
    )

    return {"vehicle_id": vehicle_id, "state": "Nettoyage"}


@router.post("/{vehicle_id}/mark-available")
def mark_available(vehicle_id: int):
    """
    Explicit agent action once cleaning/checks are done.
    """

    odoo.execute(
        "fleet.vehicle",
        "write",
        [[vehicle_id], {"state_id": find_state_id("Disponible")}],
    )

    return {"vehicle_id": vehicle_id, "state": "Disponible"}


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