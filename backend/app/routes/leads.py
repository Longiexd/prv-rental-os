from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.odoo_client import odoo


router = APIRouter(
    prefix="/crm/leads",
    tags=["CRM Leads"],
)


# ============================================================
# SCHEMAS
# ============================================================

class LeadCreate(BaseModel):
    name: str

    partner_id: int | None = None

    phone: str | None = None

    email: str | None = None

    description: str | None = None

    expected_revenue: float | None = 0

    reservation_start: str | None = None

    reservation_end: str | None = None

    vehicle_type_id: int | None = None

    vehicle_brand_id: int | None = None


class StageUpdate(BaseModel):
    stage_id: int


# ============================================================
# HELPERS
# ============================================================

def many2one_id(value):
    if isinstance(value, (list, tuple)) and value:
        return value[0]

    if isinstance(value, int):
        return value

    return None


def many2one_name(value):
    if isinstance(value, (list, tuple)) and len(value) > 1:
        return value[1]

    if isinstance(value, str):
        return value

    return None


def get_vehicle_options():
    """
    Return Odoo Fleet model categories and brands.

    Fleet model categories are used as the vehicle type.
    """

    categories = odoo.execute(
        "fleet.vehicle.model.category",
        "search_read",
        [],
        {
            "fields": [
                "id",
                "name",
            ],
            "order": "name asc",
            "limit": 200,
        },
    )

    brands = odoo.execute(
        "fleet.vehicle.model.brand",
        "search_read",
        [],
        {
            "fields": [
                "id",
                "name",
            ],
            "order": "name asc",
            "limit": 200,
        },
    )

    return {
        "vehicle_types": [
            {
                "id": item["id"],
                "name": item["name"],
            }
            for item in categories
        ],
        "vehicle_brands": [
            {
                "id": item["id"],
                "name": item["name"],
            }
            for item in brands
        ],
    }


# ============================================================
# GET LEAD OPTIONS
# ============================================================

@router.get("/options")
def get_lead_options():
    """
    Options required by Add Lead.

    Source of truth remains Odoo Fleet.
    """

    return get_vehicle_options()


# ============================================================
# GET LEADS
# ============================================================

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
                "description",
                "type",
            ],
            "order": "id desc",
            "limit": 500,
        },
    )

    result = []

    for lead in leads:

        stage_id = None
        stage_name = None

        if lead.get("stage_id"):
            stage_id = lead["stage_id"][0]
            stage_name = lead["stage_id"][1]

        salesperson_id = None
        salesperson_name = None

        if lead.get("user_id"):
            salesperson_id = lead["user_id"][0]
            salesperson_name = lead["user_id"][1]

        customer = None

        if lead.get("partner_id"):
            customer = {
                "id": lead["partner_id"][0],
                "name": lead["partner_id"][1],
            }

        result.append(
            {
                "id": lead["id"],

                "name": lead["name"],

                "customer": customer,

                "phone": (
                    lead.get("phone")
                    or lead.get("mobile")
                    or None
                ),

                "email": lead.get("email_from"),

                "stage_id": stage_id,

                "stage": stage_name,

                "salesperson": (
                    {
                        "id": salesperson_id,
                        "name": salesperson_name,
                    }
                    if salesperson_id is not None
                    else None
                ),

                "expected_revenue": (
                    lead.get("expected_revenue") or 0
                ),

                "created": lead.get("create_date"),

                "description": lead.get("description"),
            }
        )

    return {
        "count": len(result),
        "leads": result,
    }


# ============================================================
# CREATE LEAD / OPPORTUNITY
# ============================================================

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

    # ========================================================
    # LINK EXISTING CUSTOMER
    # ========================================================

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

        if not values["phone"]:
            values["phone"] = partner.get("phone")

        if not values["email_from"]:
            values["email_from"] = partner.get("email")

    # ========================================================
    # RENTAL REQUIREMENTS
    # ========================================================

    if lead.reservation_start:
        values["x_rental_start"] = lead.reservation_start

    if lead.reservation_end:
        values["x_rental_end"] = lead.reservation_end

    # ========================================================
    # VEHICLE TYPE / BRAND
    #
    # IMPORTANT:
    #
    # These assume your Odoo crm.lead fields are literally:
    #
    #   vehicle_type_id
    #   vehicle_brand_id
    #
    # If your Studio fields are x_studio_*,
    # change the keys here.
    # ========================================================

    if lead.vehicle_type_id is not None:
        values["vehicle_type_id"] = lead.vehicle_type_id

    if lead.vehicle_brand_id is not None:
        values["vehicle_brand_id"] = lead.vehicle_brand_id

    # ========================================================
    # CREATE ODOO CRM OPPORTUNITY
    # ========================================================

    try:
        lead_id = odoo.execute(
            "crm.lead",
            "create",
            [values],
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to create opportunity: {exc}",
        ) from exc

    return {
        "success": True,
        "lead_id": lead_id,
    }


# ============================================================
# UPDATE LEAD STAGE
# ============================================================

@router.patch("/{lead_id}/stage")
def update_lead_stage(
    lead_id: int,
    stage: StageUpdate,
):

    existing = odoo.execute(
        "crm.lead",
        "search_read",
        [
            [
                ["id", "=", lead_id],
            ]
        ],
        {
            "fields": [
                "id",
                "name",
                "stage_id",
            ],
            "limit": 1,
        },
    )

    if not existing:
        raise HTTPException(
            status_code=404,
            detail="Lead not found.",
        )

    stages = odoo.execute(
        "crm.stage",
        "search_read",
        [
            [
                ["id", "=", stage.stage_id],
            ]
        ],
        {
            "fields": [
                "id",
                "name",
                "sequence",
            ],
            "limit": 1,
        },
    )

    if not stages:
        raise HTTPException(
            status_code=404,
            detail="CRM stage not found.",
        )

    updated = odoo.execute(
        "crm.lead",
        "write",
        [
            [lead_id],
            {
                "stage_id": stage.stage_id,
            },
        ],
    )

    if not updated:
        raise HTTPException(
            status_code=500,
            detail="Odoo could not update the lead stage.",
        )

    return {
        "success": True,
        "lead_id": lead_id,
        "stage": {
            "id": stages[0]["id"],
            "name": stages[0]["name"],
            "sequence": stages[0]["sequence"],
        },
    }