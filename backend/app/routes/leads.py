from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.odoo_client import odoo


router = APIRouter(
    prefix="/crm/leads",
    tags=["CRM Leads"],
)


# =========================================================
# SCHEMAS
# =========================================================

class LeadCreate(BaseModel):
    name: str
    partner_id: int | None = None
    phone: str | None = None
    email: str | None = None
    description: str | None = None
    expected_revenue: float | None = 0


# =========================================================
# GET LEADS
# =========================================================

@router.get("")
def get_leads():

    leads = odoo.execute(
        "crm.lead",
        "search_read",
        [],
        {
            "fields": [
                "id",
                "name",
                "partner_id",
                "phone",
                "mobile",
                "email_from",
                "stage_id",
                "user_id",
                "expected_revenue",
                "create_date",
            ],
            "order": "id desc",
            "limit": 500,
        },
    )

    result = []

    for lead in leads:

        result.append(
            {
                "id": lead["id"],

                "name": lead["name"],

                "customer": (
                    {
                        "id": lead["partner_id"][0],
                        "name": lead["partner_id"][1],
                    }
                    if lead.get("partner_id")
                    else None
                ),

                "phone": (
                    lead.get("phone")
                    or lead.get("mobile")
                    or None
                ),

                "email": lead.get("email_from"),

                "stage": (
                    lead["stage_id"][1]
                    if lead.get("stage_id")
                    else None
                ),

                "salesperson": (
                    {
                        "id": lead["user_id"][0],
                        "name": lead["user_id"][1],
                    }
                    if lead.get("user_id")
                    else None
                ),

                "expected_revenue": (
                    lead.get("expected_revenue") or 0
                ),

                "created": lead.get("create_date"),
            }
        )

    return {
        "count": len(result),
        "leads": result,
    }


# =========================================================
# CREATE LEAD / OPPORTUNITY
# =========================================================

@router.post("")
def create_lead(lead: LeadCreate):

    name = lead.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Opportunity name is required.",
        )

    values = {
        "name": name,
        "phone": lead.phone,
        "email_from": lead.email,
        "description": lead.description,
        "expected_revenue": lead.expected_revenue or 0,
    }

    # -----------------------------------------------------
    # LINK EXISTING CUSTOMER
    # -----------------------------------------------------

    if lead.partner_id:

        partners = odoo.execute(
            "res.partner",
            "search_read",
            [
                [
                    ["id", "=", lead.partner_id],
                ]
            ],
            {
                "fields": [
                    "id",
                    "name",
                    "phone",
                    "email",
                ],
                "limit": 1,
            },
        )

        if not partners:
            raise HTTPException(
                status_code=404,
                detail="Customer not found.",
            )

        partner = partners[0]

        values["partner_id"] = partner["id"]

        # Use customer information if the opportunity
        # itself did not explicitly provide it.
        if not values["phone"]:
            values["phone"] = partner.get("phone")

        if not values["email_from"]:
            values["email_from"] = partner.get("email")

    # -----------------------------------------------------
    # CREATE ODOO CRM OPPORTUNITY
    # -----------------------------------------------------

    lead_id = odoo.execute(
        "crm.lead",
        "create",
        values,
    )

    return {
        "success": True,
        "lead_id": lead_id,
    }