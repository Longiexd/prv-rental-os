import unittest
from datetime import date
from unittest.mock import patch

from app.routes import analytics


class FakeOdoo:
    def __init__(self):
        self.calls = []
        self.orders = [
            dict(id=1, name="S001", partner_id=[1, "Client"], state="sale",
                 date_order="2026-01-10 09:00:00", amount_total=120,
                 note="[Rental OS fleet.vehicle:7]"),
            dict(id=2, name="S002", partner_id=[1, "Client"], state="sale",
                 date_order="2026-02-10 09:00:00", amount_total=300,
                 note="[Rental OS fleet.vehicle:8]"),
            dict(id=3, name="S003", partner_id=[1, "Client"], state="sale",
                 date_order="2026-03-10 09:00:00", amount_total=80,
                 note="[Rental OS fleet.vehicle:7]"),
            dict(id=4, name="S004", partner_id=[1, "Client"], state="draft",
                 date_order="2026-03-12 09:00:00", amount_total=999,
                 note="[Rental OS fleet.vehicle:7]"),
            dict(id=5, name="S005", partner_id=[1, "Client"], state="sale",
                 date_order="2025-01-10 09:00:00", amount_total=100,
                 note="[Rental OS fleet.vehicle:7]"),
        ]

    def execute(self, model, method, args, kwargs):
        self.calls.append((model, method, args, kwargs))
        if method != "search_read":
            raise AssertionError("Analytics must only read Odoo")
        domain = {item[0]: item[2] for item in args[0]}
        if model == "sale.order":
            dates = {operator: value for field, operator, value in args[0]
                     if field == "date_order"}
            return [order for order in self.orders
                    if order["state"] in domain["state"]
                    and dates[">="] <= order["date_order"] < dates["<"]]
        if model == "fleet.vehicle":
            if "active" in domain:
                return [dict(id=7, state_id=[1, "Loué"]), dict(id=8, state_id=[2, "Disponible"])]
            return [dict(id=7, name="Same model", license_plate="AA-7", category_id=[10, "SUV"]),
                    dict(id=8, name="Same model", license_plate="AA-8", category_id=[11, "Economy"])]
        if model == "sale.order.line":
            lines = [dict(id=1, order_id=[1, "S001"], product_id=[30, "Rental"], price_total=100),
                     dict(id=2, order_id=[1, "S001"], product_id=[31, "Baby seat"], price_total=20),
                     dict(id=3, order_id=[2, "S002"], product_id=[32, "Rental"], price_total=300),
                     dict(id=4, order_id=[3, "S003"], product_id=[30, "Rental"], price_total=80)]
            return [line for line in lines if line["order_id"][0] in domain["order_id"]]
        if model == "product.product":
            return [dict(id=30, categ_id=[20, "SUV"]), dict(id=31, categ_id=[21, "Accessories"]),
                    dict(id=32, categ_id=[22, "Economy"])]
        if model == "account.move":
            invoices = [dict(id=1, order_id=1, amount_total=120, amount_residual=20, move_type="out_invoice"),
                        dict(id=2, order_id=2, amount_total=300, amount_residual=0, move_type="out_invoice"),
                        dict(id=3, order_id=1, amount_total=10, amount_residual=0, move_type="out_refund")]
            order_ids = domain.get("invoice_line_ids.sale_line_ids.order_id")
            return [invoice for invoice in invoices if order_ids is None or invoice["order_id"] in order_ids]
        raise AssertionError(f"Unexpected Odoo model: {model}")


class AnalyticsTests(unittest.TestCase):
    def get_report(self, vehicle_id=None):
        self.odoo = FakeOdoo()
        with patch.object(analytics, "odoo", self.odoo), patch.object(analytics, "fleet_eligibility", side_effect=lambda ids: {i: {"eligible": True} for i in ids}):
            return analytics.get_analytics(year=2026, start_date=date(2026, 1, 1),
                                           end_date=date(2026, 12, 31), vehicle_id=vehicle_id)

    def test_demand_uses_vehicle_ids_and_confirmed_orders(self):
        report = self.get_report()
        self.assertEqual(report["summary"]["revenue"], 500)
        self.assertEqual(report["summary"]["orders"], 3)
        self.assertEqual([(row["id"], row["orders"]) for row in report["vehicles"]], [(7, 2), (8, 1)])
        self.assertEqual({row["vehicle_id"] for row in report["orders"]}, {7, 8})
        self.assertEqual({row["name"]: row["revenue"] for row in report["product_categories"]},
                         {"SUV": 180, "Accessories": 20, "Economy": 300})
        self.assertEqual({row["name"]: row["revenue"] for row in report["fleet_categories"]},
                         {"SUV": 200, "Economy": 300})

    def test_vehicle_filter_scopes_orders_comparison_and_linked_invoices(self):
        report = self.get_report(7)
        self.assertEqual(report["summary"], dict(revenue=200, orders=2, average_order=100,
                                                invoiced=110, collected=90, outstanding=20))
        self.assertEqual(report["comparison"], dict(revenue_change=100, orders_change=100))
        self.assertEqual(sum(row["orders"] for row in report["monthly"]), 2)
        self.assertEqual([row["id"] for row in report["vehicles"]], [7])
        self.assertEqual({row["id"] for row in report["vehicle_options"]}, {7, 8})

    def test_unknown_vehicle_is_empty_without_losing_filter_options(self):
        report = self.get_report(999)
        self.assertEqual(report["summary"]["revenue"], 0)
        self.assertEqual(report["vehicles"], [])
        self.assertEqual(len(report["vehicle_options"]), 2)


if __name__ == "__main__":
    unittest.main()
