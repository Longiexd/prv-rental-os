from fastapi import APIRouter

from app.odoo_client import odoo


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
    }