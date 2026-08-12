from fastapi import APIRouter


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
            "customers",
        ]
    }