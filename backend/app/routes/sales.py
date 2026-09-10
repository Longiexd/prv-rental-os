from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.odoo_client import odoo
from app.routes.calendar import rental_vehicle_id


router = APIRouter(
    prefix="/sales",
    tags=["Sales"]
)


# =========================================================
# GET SALES ORDERS
# =========================================================

@router.get("")
def get_sales():

    orders = odoo.execute(
        "sale.order",
        "search_read",
        [],
        {
            "fields": [
                "id",
                "name",
                "partner_id",
                "state",
                "date_order",
                "commitment_date",
                "amount_total",
                "invoice_status",
                "opportunity_id",
                "order_line",
                "note",
            ],
            "order": "id desc",
            "limit": 100,
        }
    )

    result = []

    for order in orders:

        result.append({
            "id": order["id"],
            "name": order["name"],

            "customer": (
                {
                    "id": order["partner_id"][0],
                    "name": order["partner_id"][1],
                }
                if order["partner_id"]
                else None
            ),

            "state": order["state"],
            "date_order": order["date_order"],
            "commitment_date": order["commitment_date"],

            "amount_total": order["amount_total"],
            "invoice_status": order["invoice_status"],

            "opportunity": (
                {
                    "id": order["opportunity_id"][0],
                    "name": order["opportunity_id"][1],
                }
                if order["opportunity_id"]
                else None
            ),

            "order_line_ids": order["order_line"],
            "vehicle_id": rental_vehicle_id(order.get("note")),
        })

    return {
        "count": len(result),
        "sales": result,
    }


# =========================================================
# GET SALE ORDER
# =========================================================

@router.get("/{order_id}")
def get_sale(order_id: int):

    orders = odoo.execute(
        "sale.order",
        "search_read",
        [
            [
                ["id", "=", order_id]
            ]
        ],
        {
            "fields": [
                "id",
                "name",
                "partner_id",
                "state",
                "date_order",
                "commitment_date",
                "amount_untaxed",
                "amount_tax",
                "amount_total",
                "invoice_status",
                "amount_invoiced",
                "amount_to_invoice",
                "invoice_ids",
                "opportunity_id",
                "order_line",
                "note",
            ]
        }
    )

    if not orders:
        return {
            "error": "Sale order not found"
        }

    order = orders[0]

    # ------------------------------------------------------
    # ORDER LINES — the quotation itself
    # ------------------------------------------------------

    lines = odoo.execute(
        "sale.order.line",
        "search_read",
        [[["order_id", "=", order_id]]],
        {
            "fields": [
                "id",
                "product_id",
                "name",
                "product_uom_qty",
                "price_unit",
                "discount",
                "price_subtotal",
                "price_total",
            ],
            "order": "sequence, id",
        },
    )

    order_lines = [
        {
            "id": line["id"],
            "product": (
                {
                    "id": line["product_id"][0],
                    "name": line["product_id"][1],
                }
                if line.get("product_id")
                else None
            ),
            "description": line["name"],
            "quantity": line["product_uom_qty"],
            "unit_price": line["price_unit"],
            "discount_percent": line["discount"] or 0,
            "subtotal": line["price_subtotal"],
            "total": line["price_total"],
        }
        for line in lines
    ]

    # ------------------------------------------------------
    # INVOICES — status + payment picture, no accounting
    # jargon leaking through (Odoo's payment_state values are
    # normalized to plain words on the way out)
    # ------------------------------------------------------

    invoices = []

    if order.get("invoice_ids"):
        invoice_records = odoo.execute(
            "account.move",
            "search_read",
            [[["id", "in", order["invoice_ids"]]]],
            {
                "fields": [
                    "id",
                    "name",
                    "state",
                    "payment_state",
                    "invoice_date",
                    "invoice_date_due",
                    "amount_total",
                    "amount_residual",
                ],
                "order": "id",
            },
        )

        invoices = [
            {
                "id": invoice["id"],
                "name": invoice["name"],
                "draft": invoice["state"] == "draft",
                "payment_status": invoice["payment_state"],
                "date": invoice["invoice_date"],
                "due_date": invoice["invoice_date_due"],
                "total": invoice["amount_total"],
                "paid": (
                    invoice["amount_total"]
                    - invoice["amount_residual"]
                ),
                "outstanding": invoice["amount_residual"],
            }
            for invoice in invoice_records
        ]

    return {
        "id": order["id"],
        "name": order["name"],

        "customer": (
            {
                "id": order["partner_id"][0],
                "name": order["partner_id"][1],
            }
            if order["partner_id"]
            else None
        ),

        "state": order["state"],
        "date_order": order["date_order"],
        "commitment_date": order["commitment_date"],

        "amount_untaxed": order["amount_untaxed"],
        "amount_tax": order["amount_tax"],
        "amount_total": order["amount_total"],

        "invoice_status": order["invoice_status"],
        "amount_invoiced": order["amount_invoiced"],
        "amount_to_invoice": order["amount_to_invoice"],

        "lines": order_lines,
        "invoices": invoices,

        "opportunity": (
            {
                "id": order["opportunity_id"][0],
                "name": order["opportunity_id"][1],
            }
            if order["opportunity_id"]
            else None
        ),

        "order_line_ids": order["order_line"],
        "vehicle_id": rental_vehicle_id(order.get("note")),
    }


# =========================================================
# GENERATE INVOICE
#
# Reuses Odoo's own native invoicing action rather than
# building account.move lines ourselves — Odoo owns the
# accounting engine, Klynx owns the UX. Only confirmed
# (sale/done) orders can be invoiced, matching how Odoo's own
# Sales app gates this.
# =========================================================

@router.post("/{order_id}/invoice")
def create_invoice(order_id: int):

    orders = odoo.execute(
        "sale.order",
        "search_read",
        [[["id", "=", order_id]]],
        {"fields": ["state", "invoice_ids"]},
    )

    if not orders:
        raise HTTPException(
            status_code=404,
            detail="Rental not found.",
        )

    order = orders[0]

    if order["state"] not in ("sale", "done"):
        raise HTTPException(
            status_code=400,
            detail=(
                "This rental needs to be confirmed before "
                "it can be invoiced."
            ),
        )

    before_ids = set(order.get("invoice_ids") or [])

    # Odoo's method name for this action has varied by version
    # (action_invoice_create is the long-standing one; some
    # versions expose _create_invoices instead). Try the public
    # action first, fall back to the internal method rather than
    # guessing which one this Odoo instance has.
    try:
        odoo.execute(
            "sale.order",
            "action_invoice_create",
            [[order_id]],
        )
    except Exception:
        odoo.execute(
            "sale.order",
            "_create_invoices",
            [[order_id]],
        )

    refreshed = odoo.execute(
        "sale.order",
        "search_read",
        [[["id", "=", order_id]]],
        {"fields": ["invoice_ids"]},
    )[0]

    new_ids = set(refreshed.get("invoice_ids") or []) - before_ids

    return {
        "order_id": order_id,
        "invoice_ids": list(new_ids)
        or refreshed.get("invoice_ids")
        or [],
    }


# =========================================================
# EDIT QUOTATION LINE
#
# Quantity/discount only, and only while the order is still a
# draft quotation — once confirmed, a sale order is a
# commitment and shouldn't be silently rewritten from here.
# =========================================================

class LineUpdate(BaseModel):
    quantity: float | None = None
    discount_percent: float | None = None


@router.patch("/{order_id}/lines/{line_id}")
def update_line(
    order_id: int,
    line_id: int,
    update: LineUpdate,
):

    orders = odoo.execute(
        "sale.order",
        "search_read",
        [[["id", "=", order_id]]],
        {"fields": ["state"]},
    )

    if not orders:
        raise HTTPException(
            status_code=404,
            detail="Rental not found.",
        )

    if orders[0]["state"] != "draft":
        raise HTTPException(
            status_code=400,
            detail=(
                "This quotation is already confirmed and "
                "can't be edited here."
            ),
        )

    values = {}

    if update.quantity is not None:
        values["product_uom_qty"] = update.quantity

    if update.discount_percent is not None:
        values["discount"] = update.discount_percent

    if not values:
        raise HTTPException(
            status_code=400,
            detail="Nothing to update.",
        )

    odoo.execute(
        "sale.order.line",
        "write",
        [[line_id], values],
    )

    return {"line_id": line_id, "updated": values}
