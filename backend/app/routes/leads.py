from fastapi import APIRouter
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
    phone: str | None = None
    email: str | None = None
    description: str | None = None


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

        result.append({
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
        })

    return {
        "count": len(result),
        "leads": result,
    }


# =========================================================
# CREATE LEAD
# =========================================================

@router.post("")
def create_lead(lead: LeadCreate):

    lead_id = odoo.execute(
        "crm.lead",
        "create",
        {
            "name": lead.name,
            "phone": lead.phone,
            "email_from": lead.email,
            "description": lead.description,
        },
    )

    return {
        "success": True,
        "lead_id": lead_id,
    }