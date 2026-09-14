"""Booking edits reuse the existing sale-order and fleet links in Odoo."""
import re
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from app.odoo_client import odoo
from app.routes.calendar import CONFIRMED_TAG, QUOTATION_TAG, booking_status, rental_vehicle_id
from app.routes.cars import RETURNED_TAG, sync_vehicle_state, find_state_id
from app.routes.rentals import RentalCreate, get_record

router = APIRouter(prefix="/rentals", tags=["Rentals"])


def ensure_available(vehicle_id, start, end, order_id):
    orders = odoo.execute("sale.order", "search_read", [[
        ["id", "!=", order_id], ["state", "in", ["sale", "done"]],
        ["date_order", "<", f"{(end + timedelta(days=1)).isoformat()} 00:00:00"],
        ["commitment_date", ">=", f"{start.isoformat()} 00:00:00"],
    ]], {"fields": ["note", "state"]})
    if any(rental_vehicle_id(row.get("note")) == vehicle_id and booking_status(row) == "confirmed"
           and RETURNED_TAG not in (row.get("note") or "") for row in orders):
        raise HTTPException(409, "This vehicle already has a confirmed booking for these dates. Choose another vehicle or dates.")


def refresh_fleet(vehicle_id):
    if not vehicle_id or sync_vehicle_state(vehicle_id):
        return
    vehicle = get_record("fleet.vehicle", vehicle_id, ["state_id"])
    state = (vehicle.get("state_id") or [None, ""])[1].lower()
    if any(word in state for word in ("réserv", "reserv", "loué", "loue", "rented", "retour d", "return due")):
        odoo.execute("fleet.vehicle", "write", [[vehicle_id], {"state_id": find_state_id("Disponible")}])


@router.patch("/{order_id}")
def update_booking(order_id: int, rental: RentalCreate):
    order = get_record("sale.order", order_id, ["state", "note", "partner_id", "date_order", "commitment_date", "locked"])
    if order["state"] not in ("draft", "sent", "sale") or order.get("locked") or RETURNED_TAG in (order.get("note") or ""):
        raise HTTPException(409, "This booking is cancelled, returned or locked in Odoo.")
    original_start = (order.get("date_order") or "")[:10]
    if rental.end_date <= rental.start_date or (rental.start_date < date.today() and rental.start_date.isoformat() != original_start):
        raise HTTPException(422, "Pickup cannot move into the past; return must be after pickup.")
    if rental.partner_id != order["partner_id"][0]:
        raise HTTPException(409, "Keep the original customer when editing this booking.")
    vehicle = get_record("fleet.vehicle", rental.vehicle_id, ["active"])
    if not vehicle.get("active"):
        raise HTTPException(422, "The selected vehicle is inactive.")
    if booking_status(order) == "confirmed":
        ensure_available(rental.vehicle_id, rental.start_date, rental.end_date, order_id)
    lines = odoo.execute("sale.order.line", "search_read", [[["order_id", "=", order_id]]], {
        "fields": ["product_id", "product_uom_qty", "price_unit", "discount", "qty_invoiced", "qty_delivered", "display_type", "is_downpayment"],
    })
    existing = {line["id"]: line for line in lines if not line.get("display_type") and not line.get("is_downpayment")}
    commands, seen = [], set()
    for item in rental.products:
        values = {"product_id": item.product_id, "product_uom_qty": item.quantity, "discount": item.discount_percent}
        if item.unit_price is not None:
            values["price_unit"] = item.unit_price
        if item.line_id:
            line = existing.get(item.line_id)
            if not line or item.line_id in seen:
                raise HTTPException(422, "An article is duplicated or does not belong to this quotation.")
            seen.add(item.line_id)
            changes = {key: value for key, value in values.items() if value != (line[key][0] if key == "product_id" else line[key])}
            if changes and (line.get("qty_invoiced") or line.get("qty_delivered")):
                raise HTTPException(409, "Invoiced or delivered articles must be adjusted with Odoo's accounting workflow; add new articles separately.")
            if changes:
                commands.append((1, item.line_id, changes))
        else:
            product = get_record("product.product", item.product_id, ["active", "sale_ok"])
            if not product.get("active") or not product.get("sale_ok"):
                raise HTTPException(422, "This product is not available for sale in Odoo.")
            commands.append((0, 0, values))
    for line_id, line in existing.items():
        if line_id not in seen:
            if line.get("qty_invoiced") or line.get("qty_delivered"):
                raise HTTPException(409, "An invoiced or delivered article cannot be removed.")
            commands.append((1, line_id, {"product_uom_qty": 0}) if order["state"] == "sale" else (2, line_id, 0))
    old_vehicle = rental_vehicle_id(order.get("note"))
    note = re.sub(r"\[Rental OS fleet\.vehicle:\d+\]", f"[Rental OS fleet.vehicle:{rental.vehicle_id}]", order.get("note") or "")
    if old_vehicle is None:
        note += f"\n[Rental OS fleet.vehicle:{rental.vehicle_id}]"
    odoo.execute("sale.order", "write", [[order_id], {
        "date_order": f"{rental.start_date.isoformat()} 00:00:00",
        "commitment_date": f"{rental.end_date.isoformat()} 00:00:00", "note": note, "order_line": commands,
    }])
    if booking_status(order) == "confirmed":
        for vehicle_id in {old_vehicle, rental.vehicle_id}:
            refresh_fleet(vehicle_id)
    return {"sale": {"id": order_id}, "success": True}


@router.post("/{order_id}/confirm")
def confirm_booking(order_id: int):
    order = get_record("sale.order", order_id, ["state", "note", "invoice_ids", "date_order", "commitment_date", "amount_total"])
    if booking_status(order) == "confirmed":
        return {"booking_status": "confirmed"}
    if order["state"] not in ("sale", "done"):
        raise HTTPException(409, "Confirm the quotation, create an invoice and record a payment first.")
    invoices = odoo.execute("account.move", "search_read", [[
        ["id", "in", order.get("invoice_ids") or []], ["state", "=", "posted"],
        ["move_type", "in", ["out_invoice", "out_refund"]],
    ]], {"fields": ["amount_total", "amount_residual", "move_type"]})
    paid = sum((row["amount_total"] - row["amount_residual"]) * (-1 if row["move_type"] == "out_refund" else 1) for row in invoices)
    required = round(order["amount_total"] * 0.30, 2)
    if paid <= 0 or round(paid, 2) < required:
        raise HTTPException(409, f"A 30% deposit is required to confirm this booking. Minimum: {required:.2f}; recorded: {paid:.2f}.")
    vehicle_id = rental_vehicle_id(order.get("note"))
    if not vehicle_id or not order.get("date_order") or not order.get("commitment_date"):
        raise HTTPException(409, "Choose a vehicle and pickup/return dates first.")
    ensure_available(vehicle_id, date.fromisoformat(order["date_order"][:10]), date.fromisoformat(order["commitment_date"][:10]), order_id)
    note = (order.get("note") or "").replace(QUOTATION_TAG, "")
    odoo.execute("sale.order", "write", [[order_id], {"note": f"{note}\n{CONFIRMED_TAG}"}])
    refresh_fleet(vehicle_id)
    return {"booking_status": "confirmed"}


@router.post("/{order_id}/cancel")
def cancel_booking(order_id: int):
    order = get_record("sale.order", order_id, ["state", "note", "opportunity_id"])
    if order["state"] != "cancel":
        odoo.execute("sale.order", "action_cancel", [[order_id]], {"context": {"disable_cancel_warning": True}})
    if order.get("opportunity_id"):
        odoo.execute("crm.lead", "action_set_lost", [[order["opportunity_id"][0]]])
    refresh_fleet(rental_vehicle_id(order.get("note")))
    return {"booking_status": "cancelled", "message": "Cancelled and marked lost. Existing posted invoices/payments remain in Odoo; process any refund separately."}
