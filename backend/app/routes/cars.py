from fastapi import APIRouter

from app.odoo_client import odoo


router = APIRouter(
    prefix="/cars",
    tags=["Cars"]
)


# =========================================================
# GET CARS
# =========================================================

@router.get("")
def get_cars():

    vehicles = odoo.execute(
        "fleet.vehicle",
        "search_read",
        [],
        {
            "fields": [
                "id",
                "name",
                "license_plate",
                "model_id",
                "brand_id",
                "state_id",
                "category_id",
                "location",
                "odometer",
                "odometer_unit",
                "active",
            ],
            "order": "id desc",
            "limit": 200,
        }
    )

    cars = []

    for vehicle in vehicles:

        cars.append({
            "id": vehicle["id"],

            "name": vehicle["name"],

            "license_plate": vehicle["license_plate"],

            "model": (
                vehicle["model_id"][1]
                if vehicle["model_id"]
                else None
            ),

            "brand": (
                vehicle["brand_id"][1]
                if vehicle["brand_id"]
                else None
            ),

            "category": (
                vehicle["category_id"][1]
                if vehicle["category_id"]
                else None
            ),

            "status": (
                vehicle["state_id"][1]
                if vehicle["state_id"]
                else None
            ),

            "location": vehicle["location"],

            "odometer": vehicle["odometer"],

            "odometer_unit": vehicle["odometer_unit"],

            "active": vehicle["active"],
        })

    return {
        "count": len(cars),
        "cars": cars,
    }