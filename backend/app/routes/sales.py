import re

from fastapi import APIRouter

from app.odoo_client import odoo


router = APIRouter(
    prefix="/sales",
    tags=["Sales"]
)


def get_rental_vehicle_id(note):
    """Read the stable fleet reference written by the Rental OS creator."""
    if not isinstance(note, str):
        return None

    match = re.search(r"\[Rental OS fleet\.vehicle:(\d+)\]", note)
    return int(match.group(1)) if match else None


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
            "vehicle_id": get_rental_vehicle_id(order.get("note")),
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

        "invoice_ids": order["invoice_ids"],

        "opportunity": (
            {
                "id": order["opportunity_id"][0],
                "name": order["opportunity_id"][1],
            }
            if order["opportunity_id"]
            else None
        ),

        "order_line_ids": order["order_line"],
        "vehicle_id": get_rental_vehicle_id(order.get("note")),
    }
