from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.odoo_client import odoo


router = APIRouter(
    prefix="/customers",
    tags=["Customer Creation"],
)


class CustomerCreate(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    description: str | None = None


@router.post("/create")
def create_customer(customer: CustomerCreate):

    name = customer.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Customer name is required.",
        )

    # -----------------------------------------------------
    # CREATE CONTACT
    # -----------------------------------------------------

    partner_id = odoo.execute(
        "res.partner",
        "create",
        {
            "name": name,
            "phone": customer.phone,
            "email": customer.email,
        },
    )

    # -----------------------------------------------------
    # CREATE CRM LEAD
    #
    # Rental OS customers are CRM-connected contacts.
    # -----------------------------------------------------

    lead_id = odoo.execute(
        "crm.lead",
        "create",
        {
            "name": f"Customer - {name}",
            "partner_id": partner_id,
            "phone": customer.phone,
            "email_from": customer.email,
            "description": customer.description,
        },
    )

    return {
        "success": True,
        "customer_id": partner_id,
        "lead_id": lead_id,
    }