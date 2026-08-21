from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.odoo_client import odoo


router = APIRouter(
    prefix="/rentals",
    tags=["Rentals"],
)


class RentalCreate(BaseModel):
    partner_id: int
    vehicle_id: int
    product_id: int
    start_date: date
    end_date: date
    quantity: float = Field(default=1, gt=0)
    unit_price: float | None = Field(default=None, ge=0)
    optional_product_ids: list[int] = []


def get_record(model: str, record_id: int, fields: list[str]):
    records = odoo.execute(
        model,
        "search_read",
        [[["id", "=", record_id]]],
        {"fields": fields, "limit": 1},
    )

    if not records:
        raise HTTPException(
            status_code=404,
            detail=f"{model} record {record_id} was not found.",
        )

    return records[0]


@router.get("/options")
def get_rental_options():
    """Return Odoo-backed choices required to start a rental."""
    customers = odoo.execute(
        "res.partner",
        "search_read",
        # CRM-created customers have no sales history yet, so customer_rank
        # alone would hide the very customers this form needs to serve.
        [[["active", "=", True]]],
        {"fields": ["id", "name"], "order": "name", "limit": 500},
    )

    vehicles = odoo.execute(
        "fleet.vehicle",
        "search_read",
        [[["active", "=", True]]],
        {
            "fields": ["id", "name", "license_plate", "state_id"],
            "order": "name",
            "limit": 200,
        },
    )

    products = odoo.execute(
        "product.product",
        "search_read",
        [[["active", "=", True], ["sale_ok", "=", True]]],
        {
            "fields": [
                "id", "name", "display_name", "lst_price",
                "product_tmpl_id",
            ],
            "order": "name",
            "limit": 500,
        },
    )

    template_ids = [
        product["product_tmpl_id"][0]
        for product in products
        if product.get("product_tmpl_id")
    ]
    templates = odoo.execute(
        "product.template",
        "search_read",
        [[["id", "in", template_ids]]],
        {"fields": ["id", "optional_product_ids"]},
    )
    optional_templates = {
        template["id"]: template.get("optional_product_ids") or []
        for template in templates
    }
    variants_by_template = {}
    for product in products:
        if product.get("product_tmpl_id"):
            variants_by_template.setdefault(
                product["product_tmpl_id"][0], []
            ).append(product["id"])

    return {
        "customers": [
            {"id": customer["id"], "name": customer["name"]}
            for customer in customers
        ],
        "vehicles": [
            {
                "id": vehicle["id"],
                "name": vehicle["name"],
                "license_plate": vehicle.get("license_plate"),
                "status": (
                    vehicle["state_id"][1]
                    if vehicle.get("state_id")
                    else None
                ),
            }
            for vehicle in vehicles
        ],
        "products": [
            {
                "id": product["id"],
                "name": product.get("display_name") or product["name"],
                "list_price": product.get("lst_price") or 0,
                "suggested_product_ids": [
                    variant_id
                    for template_id in optional_templates.get(
                        product["product_tmpl_id"][0], []
                    )
                    for variant_id in variants_by_template.get(template_id, [])
                ] if product.get("product_tmpl_id") else [],
            }
            for product in products
        ],
    }


@router.post("")
def create_rental(rental: RentalCreate):
    """Create a draft Odoo sale order for a rental.

    Invoices remain linked through Odoo's standard sale-order origin. The
    selected fleet vehicle is retained in the order note with a stable ID so
    no unverified custom Odoo field is required.
    """
    if rental.end_date < rental.start_date:
        raise HTTPException(
            status_code=422,
            detail="The return date must be on or after the start date.",
        )

    customer = get_record("res.partner", rental.partner_id, ["id", "name"])
    vehicle = get_record(
        "fleet.vehicle",
        rental.vehicle_id,
        ["id", "name", "license_plate", "active"],
    )
    product = get_record(
        "product.product",
        rental.product_id,
        ["id", "name", "sale_ok", "active"],
    )

    if not vehicle.get("active"):
        raise HTTPException(422, "The selected vehicle is inactive.")

    if not product.get("active") or not product.get("sale_ok"):
        raise HTTPException(422, "The selected product is not available for sale.")

    vehicle_label = vehicle["name"]
    if vehicle.get("license_plate"):
        vehicle_label = f"{vehicle_label} ({vehicle['license_plate']})"

    line = {
        "product_id": product["id"],
        "product_uom_qty": rental.quantity,
    }
    if rental.unit_price is not None:
        line["price_unit"] = rental.unit_price

    optional_products = []
    for optional_product_id in set(rental.optional_product_ids):
        if optional_product_id == product["id"]:
            continue
        optional_product = get_record(
            "product.product",
            optional_product_id,
            ["id", "sale_ok", "active"],
        )
        if optional_product.get("active") and optional_product.get("sale_ok"):
            optional_products.append(optional_product)

    sale_id = odoo.execute(
        "sale.order",
        "create",
        [{
            "partner_id": customer["id"],
            "date_order": f"{rental.start_date.isoformat()} 00:00:00",
            "commitment_date": f"{rental.end_date.isoformat()} 00:00:00",
            "note": (
                f"[Rental OS fleet.vehicle:{vehicle['id']}]\n"
                f"Rental vehicle: {vehicle_label}"
            ),
            "order_line": [
                (0, 0, line),
                *[
                    (0, 0, {
                        "product_id": optional_product["id"],
                        "product_uom_qty": 1,
                    })
                    for optional_product in optional_products
                ],
            ],
        }],
    )

    sale = get_record(
        "sale.order",
        sale_id,
        [
            "id", "name", "partner_id", "state", "date_order",
            "commitment_date", "amount_total", "invoice_status",
            "opportunity_id", "order_line", "note",
        ],
    )

    return {
        "success": True,
        "sale": {
            "id": sale["id"],
            "name": sale["name"],
            "customer": {
                "id": sale["partner_id"][0],
                "name": sale["partner_id"][1],
            } if sale.get("partner_id") else None,
            "state": sale["state"],
            "date_order": sale.get("date_order"),
            "commitment_date": sale.get("commitment_date"),
            "amount_total": sale.get("amount_total") or 0,
            "invoice_status": sale.get("invoice_status"),
            "opportunity": None,
            "order_line_ids": sale.get("order_line") or [],
            "vehicle_id": vehicle["id"],
            "vehicle_name": vehicle_label,
        },
    }
