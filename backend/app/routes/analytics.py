from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Query

from app.odoo_client import odoo


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
)


VEHICLE_NOTE_RE = re.compile(
    r"\[Rental OS fleet\.vehicle:(\d+)\]"
)


def clean_number(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


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


def parse_vehicle_id(note: str | None) -> int | None:
    if not note:
        return None

    match = VEHICLE_NOTE_RE.search(note)

    if not match:
        return None

    return int(match.group(1))


def month_key(value: str | None) -> str | None:
    if not value:
        return None

    try:
        return datetime.fromisoformat(
            value.replace("Z", "")
        ).strftime("%Y-%m")
    except ValueError:
        try:
            return datetime.strptime(
                value[:10],
                "%Y-%m-%d",
            ).strftime("%Y-%m")
        except ValueError:
            return None


def month_label(key: str) -> str:
    return datetime.strptime(
        key,
        "%Y-%m",
    ).strftime("%b")


def build_months(start: date, end: date):
    months = []

    current = date(
        start.year,
        start.month,
        1,
    )

    while current <= end:
        key = current.strftime("%Y-%m")

        months.append(
            {
                "key": key,
                "label": current.strftime("%b"),
                "month": current.month,
                "year": current.year,
                "revenue": 0.0,
                "orders": 0,
                "invoiced": 0.0,
                "collected": 0.0,
            }
        )

        if current.month == 12:
            current = date(
                current.year + 1,
                1,
                1,
            )
        else:
            current = date(
                current.year,
                current.month + 1,
                1,
            )

    return months


def percent_share(
    value: float,
    total: float,
) -> float:
    if total <= 0:
        return 0.0

    return round(
        (value / total) * 100,
        1,
    )


@router.get("")
def get_analytics(
    year: int = Query(
        default=None,
        ge=2020,
        le=2100,
    ),
    start_date: date | None = Query(
        default=None
    ),
    end_date: date | None = Query(
        default=None
    ),
):
    # ------------------------------------------------------------
    # DATE RANGE
    # ------------------------------------------------------------

    if start_date is None:
        selected_year = year or date.today().year
        start_date = date(
            selected_year,
            1,
            1,
        )

    if end_date is None:
        selected_year = year or start_date.year
        end_date = date(
            selected_year,
            12,
            31,
        )

    end_exclusive = end_date + timedelta(days=1)

    start_dt = (
        f"{start_date.isoformat()} 00:00:00"
    )

    end_dt = (
        f"{end_exclusive.isoformat()} 00:00:00"
    )

    # ------------------------------------------------------------
    # SALES ORDERS
    #
    # Only confirmed/completed orders represent actual revenue.
    # Quotations remain outside the financial KPIs.
    # ------------------------------------------------------------

    orders = odoo.execute(
        "sale.order",
        "search_read",
        [
            [
                ["date_order", ">=", start_dt],
                ["date_order", "<", end_dt],
                ["state", "in", ["sale", "done"]],
            ]
        ],
        {
            "fields": [
                "id",
                "name",
                "partner_id",
                "state",
                "date_order",
                "amount_total",
                "order_line",
                "note",
            ],
            "order": "date_order asc",
            "limit": 3000,
        },
    )

    if not orders:
        return {
            "range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
            },
            "summary": {
                "revenue": 0,
                "orders": 0,
                "average_order": 0,
                "invoiced": 0,
                "collected": 0,
                "outstanding": 0,
            },
            "monthly": build_months(
                start_date,
                end_date,
            ),
            "product_categories": [],
            "fleet_categories": [],
            "customers": [],
            "orders": [],
        }

    # ------------------------------------------------------------
    # MONTHS
    # ------------------------------------------------------------

    months = build_months(
        start_date,
        end_date,
    )

    months_by_key = {
        item["key"]: item
        for item in months
    }

    # ------------------------------------------------------------
    # ORDER IDS
    # ------------------------------------------------------------

    order_ids = [
        order["id"]
        for order in orders
    ]

    # ------------------------------------------------------------
    # SALES LINES
    # ------------------------------------------------------------

    lines = odoo.execute(
        "sale.order.line",
        "search_read",
        [
            [
                ["order_id", "in", order_ids],
            ]
        ],
        {
            "fields": [
                "id",
                "order_id",
                "product_id",
                "product_uom_qty",
                "price_total",
            ],
            "limit": 10000,
        },
    )

    # ------------------------------------------------------------
    # PRODUCTS
    # ------------------------------------------------------------

    product_ids = list(
        {
            many2one_id(line.get("product_id"))
            for line in lines
            if many2one_id(line.get("product_id"))
        }
    )

    products = []

    if product_ids:
        products = odoo.execute(
            "product.product",
            "search_read",
            [
                [
                    ["id", "in", product_ids],
                ]
            ],
            {
                "fields": [
                    "id",
                    "display_name",
                    "categ_id",
                ],
            },
        )

    product_map = {
        product["id"]: product
        for product in products
    }

    # ------------------------------------------------------------
    # VEHICLES
    # ------------------------------------------------------------

    vehicle_ids = list(
        {
            parse_vehicle_id(
                order.get("note")
            )
            for order in orders
            if parse_vehicle_id(
                order.get("note")
            )
        }
    )

    vehicles = []

    if vehicle_ids:
        vehicles = odoo.execute(
            "fleet.vehicle",
            "search_read",
            [
                [
                    ["id", "in", vehicle_ids],
                ]
            ],
            {
                "fields": [
                    "id",
                    "name",
                    "category_id",
                ],
            },
        )

    vehicle_map = {
        vehicle["id"]: vehicle
        for vehicle in vehicles
    }

    # ------------------------------------------------------------
    # INVOICES
    # ------------------------------------------------------------

    invoices = odoo.execute(
        "account.move",
        "search_read",
        [
            [
                ["move_type", "in", ["out_invoice", "out_refund"]],
                ["invoice_date", ">=", start_date.isoformat()],
                ["invoice_date", "<=", end_date.isoformat()],
                ["state", "=", "posted"],
            ]
        ],
        {
            "fields": [
                "id",
                "invoice_date",
                "amount_total",
                "amount_residual",
                "payment_state",
                "move_type",
            ],
            "limit": 5000,
        },
    )

    # ------------------------------------------------------------
    # ORDER / LINE MAPS
    # ------------------------------------------------------------

    lines_by_order: dict[int, list] = defaultdict(list)

    for line in lines:
        order_id = many2one_id(
            line.get("order_id")
        )

        if order_id:
            lines_by_order[order_id].append(
                line
            )

    # ------------------------------------------------------------
    # AGGREGATES
    # ------------------------------------------------------------

    revenue = 0.0

    product_revenue = defaultdict(float)
    product_orders = defaultdict(set)

    fleet_revenue = defaultdict(float)
    fleet_orders = defaultdict(set)

    customer_revenue = defaultdict(float)
    customer_orders = defaultdict(int)

    order_rows = []

    for order in orders:
        amount = clean_number(
            order.get("amount_total")
        )

        revenue += amount

        order_month = month_key(
            order.get("date_order")
        )

        if order_month in months_by_key:
            months_by_key[order_month][
                "revenue"
            ] += amount

            months_by_key[order_month][
                "orders"
            ] += 1

        # --------------------------------------------------------
        # CUSTOMER
        # --------------------------------------------------------

        customer_name = (
            many2one_name(
                order.get("partner_id")
            )
            or "Unknown customer"
        )

        customer_revenue[
            customer_name
        ] += amount

        customer_orders[
            customer_name
        ] += 1

        # --------------------------------------------------------
        # PRODUCT CATEGORIES
        #
        # Product category revenue comes from actual order lines,
        # not from arbitrary frontend labels.
        # --------------------------------------------------------

        for line in lines_by_order.get(
            order["id"],
            [],
        ):
            line_revenue = clean_number(
                line.get("price_total")
            )

            product = product_map.get(
                many2one_id(
                    line.get("product_id")
                )
            )

            category = (
                many2one_name(
                    product.get("categ_id")
                )
                if product
                else None
            ) or "Other"

            product_revenue[
                category
            ] += line_revenue

            product_orders[
                category
            ].add(order["id"])

        # --------------------------------------------------------
        # FLEET CATEGORY
        #
        # Each rental belongs to the category of its vehicle.
        # The order's total revenue is assigned to that fleet
        # category because the rental order represents one vehicle.
        # --------------------------------------------------------

        vehicle_id = parse_vehicle_id(
            order.get("note")
        )

        vehicle = (
            vehicle_map.get(vehicle_id)
            if vehicle_id
            else None
        )

        fleet_category = (
            many2one_name(
                vehicle.get("category_id")
            )
            if vehicle
            else None
        ) or "Other"

        fleet_revenue[
            fleet_category
        ] += amount

        fleet_orders[
            fleet_category
        ].add(order["id"])

        order_rows.append(
            {
                "id": order["id"],
                "name": order["name"],
                "customer": customer_name,
                "date": order.get("date_order"),
                "amount": amount,
                "state": order.get("state"),
                "vehicle": (
                    vehicle.get("name")
                    if vehicle
                    else None
                ),
                "fleet_category": fleet_category,
            }
        )

    # ------------------------------------------------------------
    # INVOICE METRICS
    # ------------------------------------------------------------

    invoiced = 0.0
    collected = 0.0
    outstanding = 0.0

    for invoice in invoices:
        amount_total = clean_number(
            invoice.get("amount_total")
        )

        residual = clean_number(
            invoice.get("amount_residual")
        )

        # Credit notes reduce billed revenue.
        sign = (
            -1
            if invoice.get("move_type")
            == "out_refund"
            else 1
        )

        invoiced += (
            amount_total * sign
        )

        outstanding += (
            residual * sign
        )

        collected += (
            (amount_total - residual)
            * sign
        )

    # ------------------------------------------------------------
    # BREAKDOWNS
    # ------------------------------------------------------------

    product_categories = [
        {
            "name": name,
            "revenue": round(value, 2),
            "orders": len(
                product_orders[name]
            ),
            "share": percent_share(
                value,
                revenue,
            ),
        }
        for name, value in product_revenue.items()
        if value > 0
    ]

    fleet_categories = [
        {
            "name": name,
            "revenue": round(value, 2),
            "orders": len(
                fleet_orders[name]
            ),
            "share": percent_share(
                value,
                revenue,
            ),
        }
        for name, value in fleet_revenue.items()
        if value > 0
    ]

    customers = [
        {
            "name": name,
            "revenue": round(value, 2),
            "orders": customer_orders[name],
        }
        for name, value in customer_revenue.items()
        if value > 0
    ]

    product_categories.sort(
        key=lambda item: item["revenue"],
        reverse=True,
    )

    fleet_categories.sort(
        key=lambda item: item["revenue"],
        reverse=True,
    )

    customers.sort(
        key=lambda item: item["revenue"],
        reverse=True,
    )

    return {
        "range": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
        },
        "summary": {
            "revenue": round(revenue, 2),
            "orders": len(orders),
            "average_order": round(
                revenue / len(orders),
                2,
            )
            if orders
            else 0,
            "invoiced": round(
                invoiced,
                2,
            ),
            "collected": round(
                collected,
                2,
            ),
            "outstanding": round(
                outstanding,
                2,
            ),
        },
        "monthly": months,
        "product_categories": product_categories,
        "fleet_categories": fleet_categories,
        "customers": customers[:20],
        "orders": order_rows,
    }