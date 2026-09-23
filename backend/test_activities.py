import unittest
from datetime import date, timedelta
from unittest.mock import patch

from fastapi import HTTPException

from app.routes import activities


class ActivityTests(unittest.TestCase):
    def setUp(self):
        self.future_date = (date.today() + timedelta(days=7)).isoformat()
        self.calls = []
        self.stage = 1
        self.category = "phonecall"
        self.completed = False
        self.model = "crm.lead"
        self.fail_stage = False
        self.stages = [
            {"id": 1, "name": "Nouveau", "sequence": 1, "is_won": False},
            {"id": 8, "name": "Contacté", "sequence": 2, "is_won": False},
            {"id": 12, "name": "Gagné", "sequence": 3, "is_won": True},
        ]
        self.patcher = patch.object(activities.odoo, "execute", side_effect=self.execute)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def execute(self, model, method, args=None, kwargs=None):
        self.calls.append((model, method, args, kwargs))
        if model in ("crm.lead", "sale.order") and method == "search_read":
            return [{"id": 42, "team_id": [5, "Rentals"], "stage_id": [self.stage, "Stage"]}]
        if model == "crm.stage":
            return self.stages
        if model == "mail.activity.type":
            return [{"id": 7, "name": "Appeler", "category": "phonecall"}]
        if model == "ir.model":
            return [{"id": 25}]
        if model == "mail.activity" and method == "create":
            self.values = args[0]
            return 10
        if model == "mail.activity" and method == "search_read":
            return [] if self.completed else [{"id": 10, "res_id": 42, "res_model": self.model, "activity_category": self.category}]
        if method == "action_feedback":
            self.completed = True
            return 99
        if method == "write":
            if self.fail_stage:
                raise RuntimeError("Odoo unavailable")
            self.stage = args[1]["stage_id"]
            return True
        raise AssertionError((model, method))

    def test_creates_native_activity_with_real_model_and_escaped_notes(self):
        result = activities.create_activity(activities.ActivityCreate(
            lead_id=42, activity_type_id=7, summary=" Call Mariem ",
            date_deadline=self.future_date, note="<script>alert(1)</script>\nDiscuss dates"))
        self.assertEqual(result["activity_id"], 10)
        self.assertEqual(self.values["res_model_id"], 25)
        self.assertEqual(self.values["res_id"], 42)
        self.assertEqual(self.values["summary"], "Call Mariem")
        self.assertNotIn("<script>", self.values["note"])

    def test_booking_call_completes_without_changing_prospect_stage(self):
        self.model = "sale.order"
        activities.complete_activity(10, activities.ActivityComplete())
        self.assertTrue(self.completed)
        self.assertFalse(any(model == "crm.lead" for model, _, _, _ in self.calls))

    def test_booking_reminder_uses_sale_model_and_original_record(self):
        activities.create_activity(activities.ActivityCreate(
            sale_id=42, activity_type_id=7, summary="Email invoice", date_deadline=self.future_date))
        self.assertIn(("ir.model", "search_read", [[["model", "=", "sale.order"]]],
                       {"fields": ["id"], "limit": 1}), self.calls)
        self.assertEqual(self.values["res_id"], 42)
        self.assertFalse(any(model == "crm.lead" for model, _, _, _ in self.calls))

    def test_activity_types_only_query_calls_and_email(self):
        activities.activity_types("sale.order")
        domain = self.calls[-1][2][0]
        self.assertIn(["category", "=", "phonecall"], domain)
        self.assertIn(["icon", "=", "fa-envelope"], domain)
        self.assertIn(["res_model", "=", "sale.order"], domain)

    def test_ambiguous_or_missing_related_record_never_writes(self):
        for ids in [{}, {"lead_id": 42, "sale_id": 42}]:
            with self.assertRaises(HTTPException):
                activities.create_activity(activities.ActivityCreate(
                    **ids, activity_type_id=7, summary="Call", date_deadline=self.future_date))
        self.assertFalse(self.calls)

    def test_unknown_activity_type_never_writes(self):
        with self.assertRaises(HTTPException):
            activities.create_activity(activities.ActivityCreate(
                lead_id=42, activity_type_id=999, summary="Call", date_deadline=self.future_date))
        self.assertFalse(any(method == "create" for _, method, _, _ in self.calls))

    def test_completing_call_moves_to_existing_contacted_stage(self):
        activities.complete_activity(10, activities.ActivityComplete(feedback="Client reached"))
        self.assertTrue(self.completed)
        self.assertEqual(self.stage, 8)
        self.assertLess(next(i for i, call in enumerate(self.calls) if call[1] == "action_feedback"),
                        next(i for i, call in enumerate(self.calls) if call[1] == "write"))

    def test_completed_activity_is_not_replayed(self):
        self.completed = True
        with self.assertRaises(HTTPException) as error:
            activities.complete_activity(10, activities.ActivityComplete())
        self.assertEqual(error.exception.status_code, 404)

    def test_non_call_does_not_change_stage(self):
        self.category = "default"
        activities.complete_activity(10, activities.ActivityComplete())
        self.assertTrue(self.completed)
        self.assertEqual(self.stage, 1)

    def test_won_lead_never_regresses(self):
        self.stage = 12
        activities.complete_activity(10, activities.ActivityComplete())
        self.assertEqual(self.stage, 12)

    def test_stage_failure_reports_completed_activity_without_retry(self):
        self.fail_stage = True
        result = activities.complete_activity(10, activities.ActivityComplete())
        self.assertTrue(result["success"])
        self.assertIn("could not be updated", result["warning"])
        self.assertTrue(self.completed)

    def test_ambiguous_stage_does_not_guess(self):
        self.stages.append({"id": 20, "name": "Contacted", "sequence": 2, "is_won": False})
        result = activities.complete_activity(10, activities.ActivityComplete())
        self.assertEqual(self.stage, 1)
        self.assertIn("no unique", result["warning"])

    def test_list_filters_native_crm_activities_by_dates(self):
        activities.list_activities(lead_id=42, date_from=date(2026, 9, 1), date_to=date(2026, 9, 30))
        domain = self.calls[-1][2][0]
        self.assertIn(["res_model", "=", "crm.lead"], domain)
        self.assertIn(["active", "=", True], domain)
        self.assertIn(["res_id", "=", 42], domain)
        self.assertIn(["date_deadline", ">=", "2026-09-01"], domain)
        self.assertIn(["date_deadline", "<=", "2026-09-30"], domain)


if __name__ == "__main__":
    unittest.main()
