import unittest

from engine import evaluate_plan


def make_plan(*foods, food_safety="yes", iodized_salt="yes"):
    return {
        "days": [
            {
                "date": "2026-10-13",
                "foods": list(foods),
                "food_safety": food_safety,
                "iodized_salt": iodized_salt,
            }
        ]
    }


def result_for(result, rule_id, day_index=0):
    checks = result["days"][day_index]["checks"]
    return next(check for check in checks if check["id"] == rule_id)


class EvaluatePlanTests(unittest.TestCase):
    def test_complete_tagged_day_has_no_flagged_gaps(self):
        result = evaluate_plan(
            make_plan(
                {"name": "Rice", "groups": ["staple"], "flags": []},
                {"name": "Mango", "groups": ["fruit"], "flags": []},
                {"name": "Kangkong", "groups": ["vegetable"], "flags": []},
                {"name": "Egg", "groups": ["protein"], "flags": []},
                {"name": "Milk", "groups": ["calcium"], "flags": []},
            )
        )
        self.assertEqual(result["summary"]["status"], "no_flagged_gaps")
        self.assertEqual(result_for(result, "3")["status"], "met")
        self.assertEqual(result_for(result, "4")["status"], "met")
        self.assertEqual(result_for(result, "5")["status"], "met")
        self.assertEqual(result_for(result, "8")["status"], "met")
        self.assertEqual(result["plan_checks"][0]["status"], "not_assessed")

    def test_missing_food_groups_are_reviewed_without_invented_thresholds(self):
        result = evaluate_plan(make_plan({"name": "Rice", "groups": ["staple"], "flags": []}))
        self.assertEqual(result_for(result, "3")["status"], "attention")
        self.assertEqual(result_for(result, "4")["status"], "attention")
        self.assertEqual(result_for(result, "5")["status"], "attention")
        self.assertEqual(result_for(result, "1")["status"], "informational")
        self.assertIn(
            "does not define a minimum variety threshold",
            result_for(result, "1")["message"].lower(),
        )

    def test_flagged_food_and_unknown_self_reports_are_not_silently_passed(self):
        result = evaluate_plan(
            make_plan(
                {"name": "Fried fish", "groups": ["protein"], "flags": ["fried", "salty"]},
                food_safety="unknown",
                iodized_salt="unknown",
            )
        )
        self.assertEqual(result_for(result, "8")["status"], "attention")
        self.assertEqual(result_for(result, "6")["status"], "not_assessed")
        self.assertEqual(result_for(result, "7")["status"], "not_assessed")
        self.assertEqual(result["summary"]["status"], "needs_review")

    def test_infant_feeding_rules_depend_on_age(self):
        base = make_plan()
        base["infant"] = {
            "age_months": 4,
            "exclusive_breastfeeding": "yes",
            "complementary_foods": "no",
            "breastfeeding_continues": "yes",
        }
        self.assertEqual(evaluate_plan(base)["plan_checks"][0]["status"], "met")

        base["infant"]["age_months"] = 8
        infant_check = evaluate_plan(base)["plan_checks"][0]
        self.assertEqual(infant_check["status"], "attention")
        self.assertIn("complementary foods", infant_check["message"])

        base["infant"]["age_months"] = 4
        base["days"][0]["foods"] = [
            {"name": "Mashed banana", "groups": ["fruit"], "flags": []}
        ]
        infant_check = evaluate_plan(base)["plan_checks"][0]
        self.assertEqual(infant_check["status"], "attention")
        self.assertIn("exclusive-breastfeeding", infant_check["message"])

    def test_invalid_inputs_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "at least one day"):
            evaluate_plan({"days": []})
        with self.assertRaisesRegex(ValueError, "invalid food group"):
            evaluate_plan(make_plan({"name": "Rice", "groups": ["vegetable-ish"], "flags": []}))
        with self.assertRaisesRegex(ValueError, "whole number"):
            plan = make_plan()
            plan["infant"] = {"age_months": True}
            evaluate_plan(plan)
        with self.assertRaisesRegex(ValueError, "food group"):
            evaluate_plan(make_plan({"name": "Rice", "groups": [{}], "flags": []}))
        with self.assertRaisesRegex(ValueError, "food_safety"):
            evaluate_plan(make_plan(food_safety=[]))


if __name__ == "__main__":
    unittest.main()
