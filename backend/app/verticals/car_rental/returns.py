"""Return eligibility and records, independent of the Odoo RPC transport."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

from app.core.bookings import CONFIRMED_TAG
from app.core.record_metadata import read_metadata
from app.verticals.car_rental.states import PICKED_UP_TAG, is_active_booking

RETURN_RECORD_KEY = "rental_return"
OperationalState = Literal["Nettoyage", "Disponible", "Maintenance"]


class ReturnRecord(BaseModel):
    status: Literal["pending", "completed"]
    order_id: int = Field(gt=0)
    vehicle_id: int = Field(gt=0)
    returned_at: datetime
    odometer: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    previous_odometer: float = Field(ge=0, allow_inf_nan=False)
    odometer_unit: Literal["kilometers", "miles"]
    next_state: OperationalState
    return_notes: str = Field(default="", max_length=4000)
    damage_notes: str = Field(default="", max_length=4000)


def return_record(note: str | None) -> ReturnRecord | None:
    value = read_metadata(note, RETURN_RECORD_KEY)
    if value is None:
        return None
    try:
        return ReturnRecord.model_validate(value)
    except ValidationError:
        return None


def can_return(order: dict) -> bool:
    if not is_active_booking(order):
        return False
    note = order.get("note") or ""
    # Older rentals predate explicit handover markers; retain their return path.
    if PICKED_UP_TAG in note:
        return True
    start = (order.get("date_order") or "")[:10]
    return bool(CONFIRMED_TAG not in note and start and start <= date.today().isoformat())
