from fastapi import APIRouter
from pydantic import BaseModel

from app.odoo_client import odoo


router = APIRouter(
    prefix="/crm/leads",
    tags=["CRM Leads"]
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
                "name",
                "partner_id",
                "phone",
                "email_from",
                "stage_id",
                "expected_revenue",
                "create_date",
            ]
        }
    )

    result = []

    for lead in leads:

        result.append({
            "id": lead["id"],
            "name": lead["name"],

            "customer": (
                lead["partner_id"][1]
                if lead["partner_id"]
                else None
            ),

            "phone": lead["phone"],
            "email": lead["email_from"],

            "stage": (
                lead["stage_id"][1]
                if lead["stage_id"]
                else None
            ),

            "expected_revenue": lead["expected_revenue"],
            "created": lead["create_date"],
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
        }
    )

    return {
        "success": True,
        "lead_id": lead_id,
    }