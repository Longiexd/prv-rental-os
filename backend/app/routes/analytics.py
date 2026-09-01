from datetime import date

from fastapi import APIRouter, Query

from app.odoo_client import odoo

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
)


def many2one(value):
    if isinstance(value, list) and len(value) >= 2:
        return {
            "id": value[0],
            "name": value[1],
        }
    return None


def month_key(value):
    return value[:7] if value else None


def signed_amount(move_type, amount):
    amount = amount or 0
    return -amount if move_type == "out_refund" else amount


@router.get("")
def get_analytics(
    year: int = Query(..., ge=2020, le=2100),
):
    start = date(year, 1, 1)
    end = date(year + 1, 1, 1)

    orders = odoo.execute(
        "sale.order",
        "search_read",
        [[
            ["date_order", ">=", f"{start.isoformat()} 00:00:00"],
            ["date_order", "<", f"{end.isoformat()} 00:00:00"],
            ["state", "in", ["sale", "done"]],
        ]],
        {
            "fields": [
                "id",
                "name",
                "partner_id",
                "state",
                "date_order",
                "amount_untaxed",
                "amount_tax",
                "amount_total",
                "invoice_status",
                "order_line",
            ],
            "order": "date_order desc",
            "limit": 5000,
        },
    )

    order_ids = [order["id"] for order in orders]

    lines = []

    if order_ids:
        lines = odoo.execute(
            "sale.order.line",
            "search_read",
            [[
                ["order_id", "in", order_ids],
            ]],
            {
                "fields": [
                    "id",
                    "order_id",
                    "product_id",
                    "product_uom_qty",
                    "price_subtotal",
                    "price_total",
                ],
                "limit": 30000,
            },
        )

    product_ids = {
        line["product_id"][0]
        for line in lines
        if line.get("product_id")
    }

    products = []

    if product_ids:
        products = odoo.execute(
            "product.product",
            "search_read",
            [[
                ["id", "in", list(product_ids)],
            ]],
            {
                "fields": [
                    "id",
                    "name",
                    "display_name",
                    "categ_id",
                ],
                "limit": 30000,
            },
        )

    product_map = {
        product["id"]: product
        for product in products
    }

    invoices = odoo.execute(
        "account.move",
        "search_read",
        [[
            ["move_type", "in", ["out_invoice", "out_refund"]],
            ["state", "=", "posted"],
            ["invoice_date", ">=", start.isoformat()],
            ["invoice_date", "<", end.isoformat()],
        ]],
        {
            "fields": [
                "id",
                "name",
                "partner_id",
                "move_type",
                "invoice_date",
                "amount_total",
                "amount_residual",
                "payment_state",
                "invoice_origin",
            ],
            "order": "invoice_date desc",
            "limit": 10000,
        },
    )

    monthly = {
        f"{year}-{month:02d}": {
            "revenue": 0,
            "orders": 0,
            "average_order": 0,
            "invoiced": 0,
            "collected": 0,
            "outstanding": 0,
        }
        for month in range(1, 13)
    }

    revenue = 0
    orders_count = 0
    transactions = []

    for order in orders:
        amount = order.get("amount_total") or 0
        month = month_key(order.get("date_order"))

        revenue += amount
        orders_count += 1

        if month in monthly:
            monthly[month]["revenue"] += amount
            monthly[month]["orders"] += 1

        order_products = []
        order_categories = set()

        for line in lines:
            order_ref = line.get("order_id")

            if not order_ref or order_ref[0] != order["id"]:
                continue

            product_ref = line.get("product_id")

            if not product_ref:
                continue

            product = product_map.get(product_ref[0])

            if not product:
                continue

            product_name = (
                product.get("display_name")
                or product.get("name")
                or "Unknown product"
            )

            category = many2one(
                product.get("categ_id")
            )

            order_products.append(product_name)

            if category:
                order_categories.add(category["name"])

        transactions.append({
            "id": order["id"],
            "name": order["name"],
            "date": order.get("date_order"),
            "customer": many2one(order.get("partner_id")),
            "amount": amount,
            "state": order.get("state"),
            "invoice_status": order.get("invoice_status"),
            "products": order_products,
            "categories": sorted(order_categories),
        })

    product_mix = {}
    category_mix = {}

    for line in lines:
        product_ref = line.get("product_id")

        if not product_ref:
            continue

        product = product_map.get(product_ref[0])

        if not product:
            continue

        product_id = product["id"]
        product_name = (
            product.get("display_name")
            or product.get("name")
            or "Unknown product"
        )

        category = many2one(
            product.get("categ_id")
        )

        category_name = (
            category["name"]
            if category
            else "Uncategorized"
        )

        amount = line.get("price_total") or 0
        quantity = line.get("product_uom_qty") or 0

        if product_id not in product_mix:
            product_mix[product_id] = {
                "id": product_id,
                "name": product_name,
                "category": category_name,
                "revenue": 0,
                "quantity": 0,
            }

        product_mix[product_id]["revenue"] += amount
        product_mix[product_id]["quantity"] += quantity

        if category_name not in category_mix:
            category_mix[category_name] = {
                "name": category_name,
                "revenue": 0,
                "quantity": 0,
            }

        category_mix[category_name]["revenue"] += amount
        category_mix[category_name]["quantity"] += quantity

    invoiced = 0
    collected = 0
    outstanding = 0

    for invoice in invoices:
        total = signed_amount(
            invoice.get("move_type"),
            invoice.get("amount_total"),
        )

        residual = signed_amount(
            invoice.get("move_type"),
            invoice.get("amount_residual"),
        )

        paid = total - residual
        month = invoice.get("invoice_date", "")[:7]

        invoiced += total
        collected += paid
        outstanding += residual

        if month in monthly:
            monthly[month]["invoiced"] += total
            monthly[month]["collected"] += paid
            monthly[month]["outstanding"] += residual

    for item in monthly.values():
        if item["orders"]:
            item["average_order"] = (
                item["revenue"] / item["orders"]
            )

    return {
        "year": year,
        "summary": {
            "revenue": revenue,
            "orders": orders_count,
            "average_order": (
                revenue / orders_count
                if orders_count
                else 0
            ),
            "invoiced": invoiced,
            "collected": collected,
            "outstanding": outstanding,
        },
        "monthly": [
            {
                "month": key,
                **value,
            }
            for key, value in monthly.items()
        ],
        "categories": sorted(
            category_mix.values(),
            key=lambda item: item["revenue"],
            reverse=True,
        ),
        "products": sorted(
            product_mix.values(),
            key=lambda item: item["revenue"],
            reverse=True,
        ),
        "transactions": transactions,
    }