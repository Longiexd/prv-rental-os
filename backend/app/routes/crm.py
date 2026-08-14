from fastapi import APIRouter

from app.odoo_client import odoo


router = APIRouter(
    prefix="/crm",
    tags=["CRM"]
)


# =========================================================
# CRM OVERVIEW
# =========================================================

@router.get("")
def crm_overview():

    return {
        "status": "CRM API",
        "modules": [
            "leads",
            "stages",
            "customers",
        ]
    }


# =========================================================
# CRM STAGES (kanban columns)
# =========================================================

@router.get("/stages")
def get_stages():

    stages = odoo.execute(
        "crm.stage",
        "search_read",
        [],
        {
            "fields": [
                "id",
                "name",
                "sequence",
            ],
            "order": "sequence asc",
        },
    )

    return {
        "count": len(stages),
        "stages": stages,
    }