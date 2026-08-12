from fastapi import APIRouter

from app.odoo_client import odoo


router = APIRouter(
    prefix="/invoices",
    tags=["Invoices"]
)


# =========================================================
# GET INVOICES
# =========================================================

@router.get("")
def get_invoices():

    invoices = odoo.execute(
        "account.move",
        "search_read",
        [
            [
                ["move_type", "in", ["out_invoice", "out_refund"]]
            ]
        ],
        {
            "fields": [
                "id",
                "name",
                "partner_id",
                "move_type",
                "state",
                "invoice_date",
                "invoice_date_due",
                "amount_untaxed",
                "amount_tax",
                "amount_total",
                "amount_residual",
                "payment_state",
                "invoice_origin",
                "invoice_line_ids",
            ],
            "order": "id desc",
            "limit": 100,
        }
    )

    result = []

    for invoice in invoices:

        result.append({
            "id": invoice["id"],
            "name": invoice["name"],

            "customer": (
                {
                    "id": invoice["partner_id"][0],
                    "name": invoice["partner_id"][1],
                }
                if invoice["partner_id"]
                else None
            ),

            "type": invoice["move_type"],
            "state": invoice["state"],

            "invoice_date": invoice["invoice_date"],
            "due_date": invoice["invoice_date_due"],

            "amount_untaxed": invoice["amount_untaxed"],
            "amount_tax": invoice["amount_tax"],
            "amount_total": invoice["amount_total"],
            "amount_residual": invoice["amount_residual"],

            "payment_state": invoice["payment_state"],
            "origin": invoice["invoice_origin"],

            "invoice_line_ids": invoice["invoice_line_ids"],
        })

    return {
        "count": len(result),
        "invoices": result,
    }