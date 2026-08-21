from fastapi import APIRouter
from pydantic import BaseModel

from app.odoo_client import odoo


router = APIRouter(
    prefix="/crm",
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
    partner_id: int | None = None


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

            "stage_id": (
                lead["stage_id"][0]
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

    # --------------------------------------------------------
    # NOTE: odoo.execute()'s "args" positional slot is passed
    # straight through to Odoo's execute_kw, which expects a
    # LIST of positional args for the target method (e.g.
    # crm.lead.create(vals_list)). Passing a bare dict here
    # (instead of [dict]) is what broke lead creation.
    # --------------------------------------------------------

    vals = {
        "name": lead.name,
        "phone": lead.phone,
        "email_from": lead.email,
        "description": lead.description,
    }

    # partner_id is how a lead becomes a Rental OS "customer"
    # (see customers.py: a contact only qualifies once it has
    # an associated crm.lead). Only set it when attaching this
    # lead to an existing customer/contact.

    if lead.partner_id:
        vals["partner_id"] = lead.partner_id

    lead_id = odoo.execute(
        "crm.lead",
        "create",
        [vals],
    )

    return {
        "success": True,
        "lead_id": lead_id,
        "partner_id": lead.partner_id,
    }


# =========================================================
# UPDATE LEAD STAGE (kanban drag & drop)
# =========================================================

class LeadStageUpdate(BaseModel):
    stage_id: int


@router.patch("/{lead_id}/stage")
def update_lead_stage(lead_id: int, payload: LeadStageUpdate):

    odoo.execute(
        "crm.lead",
        "write",
        [
            [lead_id],
            {"stage_id": payload.stage_id},
        ],
    )

    return {
        "success": True,
        "lead_id": lead_id,
        "stage_id": payload.stage_id,
    }