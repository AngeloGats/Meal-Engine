"""Rule-based screening for the 2012 Nutritional Guidelines for Filipinos."""

from __future__ import annotations

from datetime import date
from typing import Any


FOOD_GROUPS = {
    "staple": "Staple / grains",
    "vegetable": "Vegetables",
    "fruit": "Fruits",
    "protein": "Fish, lean meat, poultry, eggs, beans, or nuts",
    "calcium": "Milk, dairy, or other calcium-rich foods",
}

RISK_FLAGS = {
    "salty": "Salty",
    "fried": "Fried",
    "fatty": "Fatty",
    "sugary": "Sugar-rich",
}

RULES = [
    {
        "id": "1",
        "title": "Eat a variety of foods every day",
        "guideline": "Eat a variety of foods everyday to get the nutrients needed by the body.",
        "scope": "Meal-plan food variety can be described, but the guideline sets no numeric variety threshold.",
    },
    {
        "id": "2",
        "title": "Infant and young-child feeding",
        "guideline": (
            "Breastfeed infants exclusively from birth up to 6 months, then give appropriate "
            "complementary foods while continuing breastfeeding for 2 years and beyond."
        ),
        "scope": "Assessed only when an infant age and feeding details are supplied.",
    },
    {
        "id": "3",
        "title": "Eat more vegetables and fruits",
        "guideline": "Eat more vegetables and fruits everyday.",
        "scope": "Checks whether both groups appear in the foods listed for each day.",
    },
    {
        "id": "4",
        "title": "Include protein-rich foods daily",
        "guideline": "Consume fish, lean meat, poultry, egg, dried beans or nuts daily.",
        "scope": "Checks whether at least one listed food is tagged as a recommended source.",
    },
    {
        "id": "5",
        "title": "Include calcium-rich foods daily",
        "guideline": "Consume milk, milk products and other calcium-rich foods every day.",
        "scope": "Checks whether a listed food is tagged as calcium-rich.",
    },
    {
        "id": "6",
        "title": "Choose safe foods and water",
        "guideline": "Consume safe foods and water to prevent food- and water-borne diseases.",
        "scope": "Based on the planner's daily self-reported food-safety confirmation.",
    },
    {
        "id": "7",
        "title": "Use iodized salt",
        "guideline": "Use iodized salt to prevent Iodine Deficiency Disorders.",
        "scope": "Based on the planner's daily self-report; salt iodine content is not verified.",
    },
    {
        "id": "8",
        "title": "Limit salty, fried, fatty, and sugar-rich foods",
        "guideline": "Limit intake of salty, fried, fatty and sugar-rich foods.",
        "scope": "Flags only foods the planner marks; the guideline does not provide a numeric limit.",
    },
    {
        "id": "9",
        "title": "Maintain a normal body weight",
        "guideline": "Attain normal body weight through proper diet and moderate physical activity.",
        "scope": "Not determined from a meal plan; requires individual health and activity context.",
    },
    {
        "id": "10",
        "title": "Support healthy lifestyle choices",
        "guideline": (
            "Be physically active, make healthy food choices, manage stress, avoid alcoholic "
            "beverages and do not smoke."
        ),
        "scope": "Only the listed-food portion can be screened; activity, stress, alcohol, and smoking are outside this tool.",
    },
]

VALID_GROUPS = set(FOOD_GROUPS)
VALID_FLAGS = set(RISK_FLAGS)
VALID_SELF_REPORTS = {"yes", "no", "unknown"}


def _check(
    rule_id: str,
    status: str,
    message: str,
    evidence: list[str] | None = None,
) -> dict[str, Any]:
    rule = next(item for item in RULES if item["id"] == rule_id)
    result = {
        "id": rule_id,
        "title": rule["title"],
        "guideline": rule["guideline"],
        "status": status,
        "message": message,
    }
    if evidence:
        result["evidence"] = evidence
    return result


def _validate_self_report(value: Any, field: str) -> str:
    if not isinstance(value, str) or value not in VALID_SELF_REPORTS:
        raise ValueError(f"{field} must be yes, no, or unknown.")
    return value


def _validate_plan(plan: Any) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    if not isinstance(plan, dict):
        raise ValueError("Request body must be a JSON object.")

    days = plan.get("days")
    if not isinstance(days, list) or not days:
        raise ValueError("Add at least one day to the meal plan.")
    if len(days) > 31:
        raise ValueError("A meal plan can contain at most 31 days.")

    clean_days: list[dict[str, Any]] = []
    for day_number, day in enumerate(days, start=1):
        if not isinstance(day, dict):
            raise ValueError(f"Day {day_number} must be an object.")
        day_date = day.get("date", "")
        if not isinstance(day_date, str):
            raise ValueError(f"Day {day_number} date must be text.")
        if day_date:
            try:
                parsed_date = date.fromisoformat(day_date)
            except ValueError as exc:
                raise ValueError(f"Day {day_number} must use a valid YYYY-MM-DD date.") from exc
            if parsed_date.isoformat() != day_date:
                raise ValueError(f"Day {day_number} must use a valid YYYY-MM-DD date.")

        foods = day.get("foods")
        if not isinstance(foods, list):
            raise ValueError(f"Day {day_number} foods must be a list.")
        if len(foods) > 100:
            raise ValueError(f"Day {day_number} can contain at most 100 food items.")

        clean_foods: list[dict[str, Any]] = []
        for food_number, food in enumerate(foods, start=1):
            prefix = f"Day {day_number}, food {food_number}"
            if not isinstance(food, dict):
                raise ValueError(f"{prefix} must be an object.")
            name = food.get("name")
            if not isinstance(name, str) or not name.strip() or len(name.strip()) > 100:
                raise ValueError(f"{prefix} needs a name between 1 and 100 characters.")
            meal = food.get("meal", "")
            if not isinstance(meal, str) or len(meal) > 40:
                raise ValueError(f"{prefix} meal must be text up to 40 characters.")
            groups = food.get("groups", [])
            flags = food.get("flags", [])
            if not isinstance(groups, list) or any(
                not isinstance(group, str) or group not in VALID_GROUPS for group in groups
            ):
                raise ValueError(f"{prefix} has an invalid food group.")
            if not isinstance(flags, list) or any(
                not isinstance(flag, str) or flag not in VALID_FLAGS for flag in flags
            ):
                raise ValueError(f"{prefix} has an invalid food flag.")
            clean_foods.append(
                {
                    "name": name.strip(),
                    "meal": meal.strip(),
                    "groups": list(dict.fromkeys(groups)),
                    "flags": list(dict.fromkeys(flags)),
                }
            )

        clean_days.append(
            {
                "date": day_date,
                "foods": clean_foods,
                "food_safety": _validate_self_report(
                    day.get("food_safety", "unknown"), f"Day {day_number} food_safety"
                ),
                "iodized_salt": _validate_self_report(
                    day.get("iodized_salt", "unknown"), f"Day {day_number} iodized_salt"
                ),
            }
        )

    infant = plan.get("infant")
    if infant is not None:
        if not isinstance(infant, dict):
            raise ValueError("Infant feeding details must be an object.")
        age_months = infant.get("age_months")
        if isinstance(age_months, bool) or not isinstance(age_months, int) or not 0 <= age_months < 24:
            raise ValueError("Infant age must be a whole number from 0 to 23 months.")
        infant = {
            "age_months": age_months,
            "exclusive_breastfeeding": _validate_self_report(
                infant.get("exclusive_breastfeeding", "unknown"),
                "exclusive_breastfeeding",
            ),
            "complementary_foods": _validate_self_report(
                infant.get("complementary_foods", "unknown"),
                "complementary_foods",
            ),
            "breastfeeding_continues": _validate_self_report(
                infant.get("breastfeeding_continues", "unknown"),
                "breastfeeding_continues",
            ),
        }
    return clean_days, infant


def _feeding_checks(
    infant: dict[str, Any] | None,
    days: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if infant is None:
        return [
            _check(
                "2",
                "not_assessed",
                "No infant age or feeding information was supplied.",
            )
        ]

    age = infant["age_months"]
    exclusive = infant["exclusive_breastfeeding"]
    complementary = infant["complementary_foods"]
    continued = infant["breastfeeding_continues"]
    if age < 6:
        non_breastmilk_foods = [
            food["name"]
            for day in days
            for food in day["foods"]
            if "".join(food["name"].casefold().split()) != "breastmilk"
        ]
        if non_breastmilk_foods:
            return [
                _check(
                    "2",
                    "attention",
                    "Food items are listed for an infant under 6 months. Review the guideline's exclusive-breastfeeding recommendation.",
                    non_breastmilk_foods,
                )
            ]
        status = "met" if exclusive == "yes" else "attention" if exclusive == "no" else "not_assessed"
        message = {
            "yes": "Exclusive breastfeeding is reported for an infant under 6 months.",
            "no": "Exclusive breastfeeding is not reported for an infant under 6 months.",
            "unknown": "Exclusive breastfeeding status is unknown.",
        }[exclusive]
        return [_check("2", status, message)]

    statuses = [complementary, continued]
    status = (
        "attention"
        if "no" in statuses
        else "not_assessed"
        if "unknown" in statuses
        else "met"
    )
    if status == "met":
        message = "Complementary foods and continued breastfeeding are both reported."
    elif status == "attention":
        missing = []
        if complementary == "no":
            missing.append("complementary foods")
        if continued == "no":
            missing.append("continued breastfeeding")
        message = "Not reported: " + " and ".join(missing) + "."
    else:
        message = "Complementary-food or continued-breastfeeding status is unknown."
    return [_check("2", status, message)]


def _evaluate_day(day: dict[str, Any], day_number: int) -> dict[str, Any]:
    foods = day["foods"]
    names = sorted({food["name"].casefold() for food in foods})
    groups = {group for food in foods for group in food["groups"]}
    flagged = [
        f"{food['name']} ({', '.join(RISK_FLAGS[flag] for flag in food['flags'])})"
        for food in foods
        if food["flags"]
    ]

    variety_groups = [
        FOOD_GROUPS[group]
        for group in FOOD_GROUPS
        if group in groups
    ]
    checks = [
        _check(
            "1",
            "informational",
            f"{len(names)} distinct listed food(s) across {len(variety_groups)} tagged food group(s). "
            "The guideline does not define a minimum variety threshold.",
            variety_groups,
        ),
        _check(
            "3",
            "met" if {"vegetable", "fruit"} <= groups else "attention",
            "Vegetables and fruits are both listed."
            if {"vegetable", "fruit"} <= groups
            else "Add or confirm both vegetables and fruits in this day's plan.",
            [
                label
                for group, label in (("vegetable", "Vegetables"), ("fruit", "Fruits"))
                if group in groups
            ],
        ),
        _check(
            "4",
            "met" if "protein" in groups else "attention",
            "At least one recommended protein-source group is listed."
            if "protein" in groups
            else "No fish, lean meat, poultry, egg, dried beans, or nuts are tagged for this day.",
        ),
        _check(
            "5",
            "met" if "calcium" in groups else "attention",
            "A calcium-rich food is listed."
            if "calcium" in groups
            else "No milk, milk product, or other calcium-rich food is tagged for this day.",
        ),
    ]

    safety = day["food_safety"]
    checks.append(
        _check(
            "6",
            {"yes": "met", "no": "attention", "unknown": "not_assessed"}[safety],
            {
                "yes": "Food and water safety was confirmed by the planner; this was not independently verified.",
                "no": "Food and water safety was not confirmed for this day.",
                "unknown": "Food and water safety was not assessed.",
            }[safety],
        )
    )

    iodized_salt = day["iodized_salt"]
    checks.append(
        _check(
            "7",
            {"yes": "met", "no": "attention", "unknown": "not_assessed"}[iodized_salt],
            {
                "yes": "Use of iodized salt was reported; product iodine content was not verified.",
                "no": "Use of iodized salt was not reported for this day.",
                "unknown": "Use of iodized salt was not assessed.",
            }[iodized_salt],
        )
    )
    checks.append(
        _check(
            "8",
            "attention" if flagged else "met",
            f"{len(flagged)} food item(s) were marked for limiting."
            if flagged
            else "No listed food was marked salty, fried, fatty, or sugar-rich.",
            flagged,
        )
    )

    label = day["date"] or f"Day {day_number}"
    return {"label": label, "checks": checks}


def evaluate_plan(plan: Any) -> dict[str, Any]:
    """Validate and screen a meal plan against assessable guideline statements."""
    days, infant = _validate_plan(plan)
    day_results = [_evaluate_day(day, index) for index, day in enumerate(days, start=1)]
    plan_checks = _feeding_checks(infant, days) + [
        _check(
            "9",
            "not_assessed",
            "Normal body weight cannot be assessed from meal-plan entries alone.",
        ),
        _check(
            "10",
            "not_assessed",
            "Physical activity, stress management, alcohol, and smoking are outside a meal-plan screen.",
        ),
    ]

    all_checks = plan_checks + [
        check for day in day_results for check in day["checks"]
    ]
    attention_count = sum(check["status"] == "attention" for check in all_checks)
    assessed_count = sum(check["status"] in {"met", "attention"} for check in all_checks)
    return {
        "summary": {
            "status": "needs_review" if attention_count else "no_flagged_gaps",
            "attention_count": attention_count,
            "assessed_count": assessed_count,
            "message": (
                f"{attention_count} item(s) need review."
                if attention_count
                else "No gaps were flagged in the assessable checks."
            ),
        },
        "plan_checks": plan_checks,
        "days": day_results,
        "disclaimer": (
            "Screening only, not a compliance certification or medical advice. "
            "This tool uses the 2012 NNC resolution supplied with the project. "
            "The resolution gives broad recommendations, not numeric serving or nutrient limits; "
            "food groups and self-reports are planner-entered and are not independently verified."
        ),
    }
