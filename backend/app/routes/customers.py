from fastapi import APIRouter

from app.odoo_client import odoo

router = APIRouter(
    prefix="/customers",
    tags=["Customers"]
)

# =========================================================
# GET CUSTOMERS
# =========================================================

@router.get("")
def get_customers():

    leads = odoo.execute(
        "crm.lead",
        "search_read",
        [],
        {
            "fields": [
                "partner_id",
                "phone",
                "email_from",
            ]
        }
    )

    customers = {}

    for lead in leads:

        partner = lead.get("partner_id")

        if not partner:
            continue

        partner_id = partner[0]
        partner_name = partner[1]

        if partner_id not in customers:

            customers[partner_id] = {
                "id": partner_id,
                "name": partner_name,
                "phone": lead.get("phone"),
                "email": lead.get("email_from"),
            }

    result = list(customers.values())

    return {
        "count": len(result),
        "customers": result,
    }