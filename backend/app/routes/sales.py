from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from fastapi.responses import Response


from app.odoo_client import odoo
from app.routes.calendar import QUOTATION_TAG, rental_vehicle_id, booking_status
from app.routes.cars import PICKED_UP_TAG, RETURNED_TAG
from app.verticals.car_rental.returns import can_return, return_record
from app.core.documents import document_checklist
from app.core.record_metadata import read_metadata
from app.verticals.car_rental.contracts import render_contract


router = APIRouter(
    prefix="/sales",
    tags=["Sales"]
)


# =========================================================
# GET SALES ORDERS
# =========================================================

@router.get("")
def get_sales(for_fleet: bool = False, for_calendar: bool = False):

    domain = []
    if for_fleet:
        domain = [["state", "!=", "cancel"],
                  ["note", "ilike", "[Rental OS fleet.vehicle:"],
                  ["note", "not ilike", RETURNED_TAG]]

    orders = odoo.execute(
        "sale.order",
        "search_read",
        [domain],
        {
            "fields": [
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
            "order": "id desc",
            **({} if for_fleet or for_calendar else {"limit": 100}),
        }
    )

    result = []

    for order in orders:

        result.append({
            "id": order["id"],
            "name": order["name"],

            "customer": (
                {
                    "id": order["partner_id"][0],
                    "name": order["partner_id"][1],
                }
                if order["partner_id"]
                else None
            ),

            "state": order["state"],
            "date_order": order["date_order"] or None,
            "commitment_date": order["commitment_date"] or None,

            "amount_total": order["amount_total"],
            "invoice_status": order["invoice_status"],

            "opportunity": (
                {
                    "id": order["opportunity_id"][0],
                    "name": order["opportunity_id"][1],
                }
                if order["opportunity_id"]
                else None
            ),

            "order_line_ids": order["order_line"],
            "vehicle_id": rental_vehicle_id(order.get("note")),
            "booking_status": booking_status(order),
            "returned": RETURNED_TAG in (order.get("note") or ""),
            "picked_up": PICKED_UP_TAG in (order.get("note") or ""),
        })

    return {
        "count": len(result),
        "sales": result,
    }


# =========================================================
# GET SALE ORDER
# =========================================================

@router.get("/{order_id}")
def get_sale(order_id: int):

    orders = odoo.execute(
        "sale.order",
        "search_read",
        [
            [
                ["id", "=", order_id]
            ]
        ],
        {
            "fields": [
                "id",
                "name",
                "partner_id",
                "state",
                "date_order",
                "commitment_date",
                "amount_untaxed",
                "amount_tax",
                "amount_total",
                "invoice_status",
                "amount_invoiced",
                "amount_to_invoice",
                "invoice_ids",
                "opportunity_id",
                "order_line",
                "note",
            ]
        }
    )

    if not orders:
        raise HTTPException(status_code=404, detail="Rental not found.")

    order = orders[0]

    # ------------------------------------------------------
    # ORDER LINES — the quotation itself
    # ------------------------------------------------------

    lines = odoo.execute(
        "sale.order.line",
        "search_read",
        [[["order_id", "=", order_id], ["display_type", "=", False]]],
        {
            "fields": [
                "id",
                "product_id",
                "name",
                "product_uom_qty",
                "price_unit",
                "discount",
                "price_subtotal",
                "price_total",
                "is_downpayment",
            ],
            "order": "sequence, id",
        },
    )

    order_lines = [
        {
            "id": line["id"],
            "is_downpayment": line.get("is_downpayment", False),
            "product": (
                {
                    "id": line["product_id"][0],
                    "name": line["product_id"][1],
                }
                if line.get("product_id")
                else None
            ),
            "description": line["name"],
            "quantity": line["product_uom_qty"],
            "unit_price": line["price_unit"],
            "discount_percent": line["discount"] or 0,
            "subtotal": line["price_subtotal"],
            "total": line["price_total"],
        }
        for line in lines
    ]

    # ------------------------------------------------------
    # INVOICES — status + payment picture, no accounting
    # jargon leaking through (Odoo's payment_state values are
    # normalized to plain words on the way out)
    # ------------------------------------------------------

    invoices = []

    if order.get("invoice_ids"):
        invoice_records = odoo.execute(
            "account.move",
            "search_read",
            [[["id", "in", order["invoice_ids"]]]],
            {
                "fields": [
                    "id",
                    "name",
                    "state",
                    "payment_state",
                    "invoice_date",
                    "invoice_date_due",
                    "amount_total",
                    "amount_residual",
                    "move_type",
                ],
                "order": "id",
            },
        )

        invoices = [
            {
                "id": invoice["id"],
                "name": invoice["name"],
                "draft": invoice["state"] == "draft",
                "state": invoice["state"],
                "type": invoice["move_type"],
                "payment_status": invoice["payment_state"],
                "date": invoice["invoice_date"],
                "due_date": invoice["invoice_date_due"],
                "total": invoice["amount_total"],
                "paid": (invoice["amount_total"] - invoice["amount_residual"])
                if invoice["state"] == "posted" else 0,
                "outstanding": invoice["amount_residual"],
            }
            for invoice in invoice_records if invoice["state"] != "cancel"
        ]

    return {
        "id": order["id"],
        "name": order["name"],

        "customer": (
            {
                "id": order["partner_id"][0],
                "name": order["partner_id"][1],
            }
            if order["partner_id"]
            else None
        ),

        "state": order["state"],
        "date_order": order["date_order"] or None,
        "commitment_date": order["commitment_date"] or None,

        "amount_untaxed": order["amount_untaxed"],
        "amount_tax": order["amount_tax"],
        "amount_total": order["amount_total"],

        "invoice_status": order["invoice_status"],
        "amount_invoiced": sum(
            i["total"] * (-1 if i["type"] == "out_refund" else 1)
            for i in invoices if i["state"] == "posted"
        ),
        "amount_paid": sum(
            i["paid"] * (-1 if i["type"] == "out_refund" else 1)
            for i in invoices if i["state"] == "posted"
        ),
        "amount_outstanding": max(0, order["amount_total"] - sum(
            i["paid"] * (-1 if i["type"] == "out_refund" else 1)
            for i in invoices if i["state"] == "posted"
        )),
        "amount_to_invoice": order["amount_to_invoice"],

        "lines": order_lines,
        "invoices": invoices,

        "opportunity": (
            {
                "id": order["opportunity_id"][0],
                "name": order["opportunity_id"][1],
            }
            if order["opportunity_id"]
            else None
        ),

        "returned": RETURNED_TAG in (order.get("note") or ""),
        "picked_up": PICKED_UP_TAG in (order.get("note") or ""),
        "return_record": record.model_dump(mode="json") if (record := return_record(order.get("note"))) else None,
        "can_return": can_return(order),
        "order_line_ids": order["order_line"],
        "vehicle_id": rental_vehicle_id(order.get("note")),
            "booking_status": booking_status(order),
    }


def sale_record(order_id: int, fields: list[str] | None = None, editable=False):
    records = odoo.execute("sale.order", "search_read", [[["id", "=", order_id]]],
                           {"fields": fields or ["state"], "limit": 1})
    if not records:
        raise HTTPException(404, "Rental not found.")
    if editable and records[0]["state"] not in ("draft", "sent"):
        raise HTTPException(400, "Only a draft or sent quotation can be edited.")
    return records[0]


def owned_line(order_id: int, line_id: int):
    sale_record(order_id, editable=True)
    lines = odoo.execute("sale.order.line", "search_read",
                         [[["id", "=", line_id], ["order_id", "=", order_id],
                           ["display_type", "=", False], ["is_downpayment", "=", False]]],
                         {"fields": ["id", "qty_invoiced", "qty_delivered"], "limit": 1})
    if not lines:
        raise HTTPException(404, "Quotation line not found in this rental.")
    ensure_unbilled(lines)


def ensure_unbilled(lines):
    if any(line.get("qty_invoiced") or line.get("qty_delivered") for line in lines):
        raise HTTPException(409, "Invoiced or delivered articles cannot be changed here. Use an accounting adjustment instead.")


class LineUpdate(BaseModel):
    quantity: float | None = Field(None, gt=0, le=1000000, allow_inf_nan=False)
    unit_price: float | None = Field(None, ge=0, le=1000000000, allow_inf_nan=False)
    discount_percent: float | None = Field(None, ge=0, le=100, allow_inf_nan=False)


class LineCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: float = Field(1, gt=0, le=1000000, allow_inf_nan=False)
    unit_price: float | None = Field(None, ge=0, le=1000000000, allow_inf_nan=False)


class OrderDiscount(BaseModel):
    discount_percent: float = Field(ge=0, le=100, allow_inf_nan=False)


@router.patch("/{order_id}/lines/{line_id}")
def update_line(order_id: int, line_id: int, update: LineUpdate):
    owned_line(order_id, line_id)
    mapping = {"quantity": "product_uom_qty", "unit_price": "price_unit", "discount_percent": "discount"}
    values = {mapping[key]: value for key, value in update.model_dump().items() if value is not None}
    if not values:
        raise HTTPException(400, "Nothing to update.")
    odoo.execute("sale.order.line", "write", [[line_id], values])
    return {"line_id": line_id, "updated": values}


@router.post("/{order_id}/lines")
def add_line(order_id: int, line: LineCreate):
    sale_record(order_id, editable=True)
    products = odoo.execute("product.product", "search_read",
                            [[["id", "=", line.product_id], ["sale_ok", "=", True]]],
                            {"fields": ["id"], "limit": 1})
    if not products:
        raise HTTPException(404, "Choose a saleable product.")
    # Odoo computes description, UoM, pricelist price, taxes and fiscal-position mapping.
    values = {"order_id": order_id, "product_id": line.product_id, "product_uom_qty": line.quantity}
    if line.unit_price is not None:
        values["price_unit"] = line.unit_price
    line_id = odoo.execute("sale.order.line", "create", [values])
    return {"line_id": line_id}


@router.delete("/{order_id}/lines/{line_id}")
def remove_line(order_id: int, line_id: int):
    owned_line(order_id, line_id)
    odoo.execute("sale.order.line", "unlink", [[line_id]])
    return {"line_id": line_id, "removed": True}


@router.patch("/{order_id}/discount")
def discount_order(order_id: int, discount: OrderDiscount):
    sale_record(order_id, editable=True)
    lines = odoo.execute("sale.order.line", "search_read", [[["order_id", "=", order_id],
                         ["display_type", "=", False], ["is_downpayment", "=", False]]],
                         {"fields": ["id", "qty_invoiced", "qty_delivered"]})
    ensure_unbilled(lines)
    if lines:
        # Matches Odoo's "On All Order Lines" discount: replaces existing line discounts.
        odoo.execute("sale.order.line", "write", [[line["id"] for line in lines], {"discount": discount.discount_percent}])
    return {"discount_percent": discount.discount_percent}


@router.post("/{order_id}/confirm")
def confirm_quotation(order_id: int):
    order = sale_record(order_id, ["state", "date_order", "note"], editable=True)
    note = order.get("note") or ""
    if QUOTATION_TAG not in note:
        odoo.execute("sale.order", "write", [[order_id], {"note": f"{note}\n{QUOTATION_TAG}"}])
    odoo.execute("sale.order", "action_confirm", [[order_id]])
    # This installation stores pickup in date_order; Odoo confirmation otherwise resets it.
    if order.get("date_order"):
        odoo.execute("sale.order", "write", [[order_id], {"date_order": order["date_order"]}])
    return {"order_id": order_id, "state": "sale"}


class InvoiceCreate(BaseModel):
    deposit_amount: float | None = Field(None, gt=0, allow_inf_nan=False)


@router.post("/{order_id}/invoice")
def create_invoice(order_id: int, request: InvoiceCreate | None = None):
    order = sale_record(order_id, ["state", "invoice_ids", "amount_to_invoice"])
    if order["state"] not in ("sale", "done"):
        raise HTTPException(400, "Confirm the quotation before generating an invoice.")
    # Reuse a pending draft instead of creating duplicates on a repeated click.
    drafts = odoo.execute("account.move", "search", [[["id", "in", order.get("invoice_ids") or []],
                          ["state", "=", "draft"], ["move_type", "=", "out_invoice"]]])
    if drafts:
        return {"order_id": order_id, "invoice_ids": drafts}
    context = {"active_model": "sale.order", "active_ids": [order_id], "active_id": order_id}
    values = {"advance_payment_method": "delivered", "sale_order_ids": [[6, 0, [order_id]]]}
    if request and request.deposit_amount is not None:
        if request.deposit_amount > order["amount_to_invoice"]:
            raise HTTPException(422, "The deposit cannot exceed the remaining amount to invoice.")
        values.update(advance_payment_method="fixed", fixed_amount=request.deposit_amount)
    wizard = odoo.execute("sale.advance.payment.inv", "create",
                          [values],
                          {"context": context})
    odoo.execute("sale.advance.payment.inv", "create_invoices", [[wizard]], {"context": context})
    refreshed = sale_record(order_id, ["invoice_ids"])
    return {"order_id": order_id,
            "invoice_ids": sorted(set(refreshed.get("invoice_ids") or []) - set(order.get("invoice_ids") or []))}


@router.get("/{order_id}/print-link")
def quotation_print_link(order_id: int):
    sale_record(order_id)
    return {"url": f"/api/backend/sales/{order_id}/document"}


@router.get("/{order_id}/contract")
def rental_contract(order_id: int):
    order = get_sale(order_id)
    if order["booking_status"] == "cancelled":
        raise HTTPException(409, "A cancelled booking cannot generate a rental contract.")
    if not order.get("customer") or not order.get("vehicle_id"):
        raise HTTPException(409, "Select a customer and vehicle before generating a contract.")
    partners = odoo.execute("res.partner", "read", [[order["customer"]["id"]]],
                            {"fields": ["name", "phone"]})
    vehicles = odoo.execute("fleet.vehicle", "read", [[order["vehicle_id"]]],
                            {"fields": ["name", "model_id", "license_plate"]})
    if not partners or not vehicles:
        raise HTTPException(404, "Contract customer or vehicle is unavailable.")
    client, vehicle = partners[0], vehicles[0]
    details = sale_record(order_id, ["company_id", "currency_id", "note"])
    companies = odoo.execute("res.company", "read", [[details["company_id"][0]]],
                             {"fields": ["name", "phone", "email"]}) if details.get("company_id") else []
    company = companies[0] if companies else {}
    documents = document_checklist("res.partner", order["customer"]["id"],
                                  {"cin": "CIN", "driving_license": "Driving licence"})
    numbers = {item["kind"]: item["number"] for item in documents["documents"]}
    record = order.get("return_record") or {}
    pickup = read_metadata(details.get("note"), "rental_pickup") or {}
    if pickup.get("order_id") != order_id or pickup.get("vehicle_id") != order["vehicle_id"]:
        pickup = {}
    # A pre-return reading is not necessarily the pickup reading. Never invent historical mileage.
    fields = {
        "Agence": company.get("name"), "Téléphone agence": company.get("phone"), "Email agence": company.get("email"),
        "Réservation": order["name"], "Statut": order["booking_status"],
        "Client": client["name"], "Téléphone": client.get("phone"), "CIN": numbers["cin"],
        "Permis de conduire": numbers["driving_license"], "Véhicule": vehicle["name"],
        "Modèle": vehicle["model_id"][1] if vehicle.get("model_id") else None,
        "Immatriculation": vehicle.get("license_plate"), "Départ": order["date_order"],
        "Retour prévu": order["commitment_date"], "Prix total": order["amount_total"],
        "Montant payé / acompte": order["amount_paid"], "Reste à payer": order["amount_outstanding"],
        "Devise": details["currency_id"][1] if details.get("currency_id") else None,
        "Kilométrage au départ": pickup.get("odometer"),
        "Kilométrage au retour": record.get("odometer") if record.get("status") == "completed" else None,
        "Unité du compteur": pickup.get("odometer_unit") or record.get("odometer_unit"),
    }
    return {"template": "car-rental-basic-v1", "fields": fields, "html": render_contract(fields)}


@router.get("/{order_id}/document")
def quotation_document(order_id: int):
    sale_record(order_id)
    return Response(odoo.document("sale.report_saleorder", order_id), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="quotation-{order_id}.pdf"'})


@router.post("/{order_id}/send")
def send_quotation(order_id: int):
    order = sale_record(order_id, ["state", "partner_id"])
    if order["state"] == "cancel":
        raise HTTPException(400, "A cancelled quotation cannot be sent.")
    partners = odoo.execute("res.partner", "read", [[order["partner_id"][0]]], {"fields": ["email"]})
    if not partners or not partners[0].get("email"):
        raise HTTPException(400, "Add the customer's email address before sending.")
    action = odoo.execute("sale.order", "action_quotation_send", [[order_id]])
    context = action.get("context") or {}
    if not context.get("default_template_id"):
        raise HTTPException(400, "Configure a quotation email template before sending.")
    wizard = odoo.execute("mail.compose.message", "create", [{}], {"context": context})
    odoo.execute("mail.compose.message", "action_send_mail", [[wizard]], {"context": context})
    return {"order_id": order_id, "sent": True}
