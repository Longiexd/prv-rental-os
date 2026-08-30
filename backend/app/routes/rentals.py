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

    quantity: float = Field(
        default=1,
        gt=0,
    )

    unit_price: float | None = Field(
        default=None,
        ge=0,
    )

    optional_product_ids: list[int] = []

    # Optional CRM opportunity / lead.
    opportunity_id: int | None = None


def get_record(
    model: str,
    record_id: int,
    fields: list[str],
):
    records = odoo.execute(
        model,
        "search_read",
        [[[ "id", "=", record_id ]]],
        {
            "fields": fields,
            "limit": 1,
        },
    )

    if not records:
        raise HTTPException(
            status_code=404,
            detail=f"{model} record {record_id} was not found.",
        )

    return records[0]


# =========================================================
# RENTAL OPTIONS
# =========================================================

@router.get("/options")
def get_rental_options():
    """
    Return Odoo-backed choices required to create a rental.

    Source of truth:
    - Customers -> res.partner
    - Vehicles  -> fleet.vehicle
    - Products  -> product.product
    """

    customers = odoo.execute(
        "res.partner",
        "search_read",
        [
            [
                ["active", "=", True],
            ]
        ],
        {
            "fields": [
                "id",
                "name",
            ],
            "order": "name",
            "limit": 500,
        },
    )

    vehicles = odoo.execute(
        "fleet.vehicle",
        "search_read",
        [
            [
                ["active", "=", True],
            ]
        ],
        {
            "fields": [
                "id",
                "name",
                "license_plate",
                "state_id",
            ],
            "order": "name",
            "limit": 500,
        },
    )

    products = odoo.execute(
        "product.product",
        "search_read",
        [
            [
                ["active", "=", True],
                ["sale_ok", "=", True],
            ]
        ],
        {
            "fields": [
                "id",
                "name",
                "display_name",
                "lst_price",
                "product_tmpl_id",
            ],
            "order": "name",
            "limit": 500,
        },
    )

    # =====================================================
    # OPTIONAL / SUGGESTED PRODUCTS
    # =====================================================

    template_ids = [
        product["product_tmpl_id"][0]
        for product in products
        if product.get("product_tmpl_id")
    ]

    templates = []

    if template_ids:
        templates = odoo.execute(
            "product.template",
            "search_read",
            [
                [
                    ["id", "in", template_ids],
                ]
            ],
            {
                "fields": [
                    "id",
                    "optional_product_ids",
                ],
                "limit": 500,
            },
        )

    optional_templates = {
        template["id"]:
            template.get("optional_product_ids") or []
        for template in templates
    }

    variants_by_template: dict[int, list[int]] = {}

    for product in products:
        product_template = product.get(
            "product_tmpl_id"
        )

        if product_template:
            template_id = product_template[0]

            variants_by_template.setdefault(
                template_id,
                [],
            ).append(
                product["id"]
            )

    # =====================================================
    # RESPONSE
    # =====================================================

    return {
        "customers": [
            {
                "id": customer["id"],
                "name": customer["name"],
            }
            for customer in customers
        ],

        "vehicles": [
            {
                "id": vehicle["id"],
                "name": vehicle["name"],
                "license_plate": vehicle.get(
                    "license_plate"
                ),
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

                "name":
                    product.get("display_name")
                    or product["name"],

                "list_price":
                    product.get("lst_price")
                    or 0,

                "suggested_product_ids": [
                    variant_id

                    for template_id in
                    optional_templates.get(
                        product[
                            "product_tmpl_id"
                        ][0],
                        [],
                    )

                    for variant_id in
                    variants_by_template.get(
                        template_id,
                        [],
                    )
                ]

                if product.get(
                    "product_tmpl_id"
                )

                else [],
            }

            for product in products
        ],
    }


# =========================================================
# CREATE RENTAL
# =========================================================

@router.post("")
def create_rental(
    rental: RentalCreate,
):
    """
    Create a rental as an Odoo sale.order.

    Relationships:

        CRM opportunity
              ↓
        Sale Order
              ↓
        Customer
              ↓
        Rental dates
              ↓
        Fleet vehicle
              ↓
        Calendar

    Odoo remains the source of truth.
    """

    # =====================================================
    # DATE VALIDATION
    # =====================================================

    if rental.end_date < rental.start_date:
        raise HTTPException(
            status_code=422,
            detail=(
                "The return date must be on or after "
                "the start date."
            ),
        )

    # =====================================================
    # CUSTOMER
    # =====================================================

    customer = get_record(
        "res.partner",
        rental.partner_id,
        [
            "id",
            "name",
        ],
    )

    # =====================================================
    # VEHICLE
    # =====================================================

    vehicle = get_record(
        "fleet.vehicle",
        rental.vehicle_id,
        [
            "id",
            "name",
            "license_plate",
            "active",
            "state_id",
        ],
    )

    if not vehicle.get("active"):
        raise HTTPException(
            status_code=422,
            detail="The selected vehicle is inactive.",
        )

    # =====================================================
    # PRODUCT
    # =====================================================

    product = get_record(
        "product.product",
        rental.product_id,
        [
            "id",
            "name",
            "sale_ok",
            "active",
        ],
    )

    if (
        not product.get("active")
        or not product.get("sale_ok")
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                "The selected product is not "
                "available for sale."
            ),
        )

    # =====================================================
    # CRM OPPORTUNITY
    # =====================================================

    opportunity = None

    if rental.opportunity_id is not None:

        opportunity = get_record(
            "crm.lead",
            rental.opportunity_id,
            [
                "id",
                "name",
                "partner_id",
                "type",
                "active",
            ],
        )

        # Make sure the CRM opportunity belongs
        # to the same customer selected in the rental.

        opportunity_partner_id = None

        if opportunity.get("partner_id"):
            opportunity_partner_id = (
                opportunity["partner_id"][0]
            )

        if (
            opportunity_partner_id is not None
            and opportunity_partner_id
            != customer["id"]
        ):
            raise HTTPException(
                status_code=422,
                detail=(
                    "The selected CRM opportunity "
                    "does not belong to the selected customer."
                ),
            )

    # =====================================================
    # VEHICLE LABEL
    # =====================================================

    vehicle_label = vehicle["name"]

    if vehicle.get("license_plate"):
        vehicle_label = (
            f"{vehicle_label} "
            f"({vehicle['license_plate']})"
        )

    # =====================================================
    # MAIN RENTAL PRODUCT
    # =====================================================

    rental_line = {
        "product_id": product["id"],
        "product_uom_qty": rental.quantity,
    }

    if rental.unit_price is not None:
        rental_line["price_unit"] = (
            rental.unit_price
        )

    # =====================================================
    # OPTIONAL PRODUCTS
    # =====================================================

    optional_products = []

    for optional_product_id in set(
        rental.optional_product_ids
    ):

        # Don't duplicate main product.
        if (
            optional_product_id
            == product["id"]
        ):
            continue

        optional_product = get_record(
            "product.product",
            optional_product_id,
            [
                "id",
                "name",
                "sale_ok",
                "active",
            ],
        )

        if (
            optional_product.get("active")
            and optional_product.get("sale_ok")
        ):
            optional_products.append(
                optional_product
            )

    # =====================================================
    # SALE ORDER VALUES
    # =====================================================

    sale_values = {
        "partner_id": customer["id"],

        "date_order":
            f"{rental.start_date.isoformat()}"
            " 00:00:00",

        "commitment_date":
            f"{rental.end_date.isoformat()}"
            " 00:00:00",

        "note": (
            f"[Rental OS fleet.vehicle:{vehicle['id']}]"
            "\n"
            f"Rental vehicle: {vehicle_label}"
        ),

        "order_line": [
            (
                0,
                0,
                rental_line,
            ),

            *[
                (
                    0,
                    0,
                    {
                        "product_id":
                            optional_product["id"],

                        "product_uom_qty": 1,
                    },
                )

                for optional_product
                in optional_products
            ],
        ],
    }

    # =====================================================
    # LINK CRM OPPORTUNITY
    # =====================================================

    if opportunity is not None:
        sale_values[
            "opportunity_id"
        ] = opportunity["id"]

    # =====================================================
    # CREATE ODOO SALE
    # =====================================================

    sale_id = odoo.execute(
        "sale.order",
        "create",
        [sale_values],
    )

    # =====================================================
    # READ CREATED SALE
    # =====================================================

    sale = get_record(
        "sale.order",
        sale_id,
        [
            "id",
            "name",
            "partner_id",
            "state",
            "date_order",
            "commitment_date",
            "amount_total",
            "invoice_status",
            "opportunity_id",
            "order_line",
            "note",
        ],
    )

    # =====================================================
    # RESPONSE
    # =====================================================

    return {
        "success": True,

        "sale": {
            "id": sale["id"],

            "name": sale["name"],

            "customer": (
                {
                    "id":
                        sale["partner_id"][0],

                    "name":
                        sale["partner_id"][1],
                }

                if sale.get("partner_id")

                else None
            ),

            "state":
                sale["state"],

            "date_order":
                sale.get("date_order"),

            "commitment_date":
                sale.get("commitment_date"),

            "amount_total":
                sale.get("amount_total")
                or 0,

            "invoice_status":
                sale.get("invoice_status"),

            "opportunity": (
                {
                    "id":
                        sale[
                            "opportunity_id"
                        ][0],

                    "name":
                        sale[
                            "opportunity_id"
                        ][1],
                }

                if sale.get(
                    "opportunity_id"
                )

                else None
            ),

            "order_line_ids":
                sale.get(
                    "order_line"
                )
                or [],

            "vehicle_id":
                vehicle["id"],

            "vehicle_name":
                vehicle_label,

            "vehicle_status":
                (
                    vehicle["state_id"][1]
                    if vehicle.get(
                        "state_id"
                    )
                    else None
                ),
        },
    }