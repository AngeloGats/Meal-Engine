(function (root) {
  "use strict";

  const FOOD_GROUPS = {
    staple: "Staple / grains",
    vegetable: "Vegetables",
    fruit: "Fruits",
    protein: "Fish, lean meat, poultry, eggs, beans, or nuts",
    calcium: "Milk, dairy, or other calcium-rich foods",
  };
  const RISK_FLAGS = {
    salty: "Salty",
    fried: "Fried",
    fatty: "Fatty",
    sugary: "Sugar-rich",
  };
  const RULES = [
    ["1", "Eat a variety of foods every day", "Eat a variety of foods everyday to get the nutrients needed by the body."],
    ["2", "Infant and young-child feeding", "Breastfeed infants exclusively from birth up to 6 months, then give appropriate complementary foods while continuing breastfeeding for 2 years and beyond."],
    ["3", "Eat more vegetables and fruits", "Eat more vegetables and fruits everyday to get the essential vitamins, minerals and fiber for regulation of body processes."],
    ["4", "Include protein-rich foods daily", "Consume fish, lean meat, poultry, egg, dried beans or nuts daily for growth and repair of body tissues."],
    ["5", "Include calcium-rich foods daily", "Consume milk, milk products and other calcium-rich foods everyday for healthy bones and teeth."],
    ["6", "Choose safe foods and water", "Consume safe foods and water to prevent diarrhea and other food- and water-borne diseases."],
    ["7", "Use iodized salt", "Use iodized salt to prevent Iodine Deficiency Disorders."],
    ["8", "Limit salty, fried, fatty, and sugar-rich foods", "Limit intake of salty, fried, fatty and sugar-rich foods to prevent cardiovascular diseases."],
    ["9", "Maintain a normal body weight", "Attain normal body weight through proper diet and moderate physical activity to maintain good health and help prevent obesity."],
    ["10", "Support healthy lifestyle choices", "Be physically active, make healthy food choices, manage stress, avoid alcoholic beverages and do not smoke to help prevent lifestyle-related non-communicable diseases."],
  ].map(([id, title, guideline]) => ({ id, title, guideline }));

  function check(ruleId, status, message, evidence) {
    const rule = RULES.find((item) => item.id === ruleId);
    const result = { id: ruleId, title: rule.title, guideline: rule.guideline, status, message };
    if (evidence?.length) result.evidence = evidence;
    return result;
  }

  function assertReport(value, field) {
    if (!["yes", "no", "unknown"].includes(value)) {
      throw new Error(`${field} must be yes, no, or unknown.`);
    }
    return value;
  }

  function valueOrDefault(object, key, fallback) {
    return Object.hasOwn(object, key) ? object[key] : fallback;
  }

  function validatePlan(plan) {
    if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
      throw new Error("Request body must be a JSON object.");
    }
    if (!Array.isArray(plan.days) || plan.days.length === 0) {
      throw new Error("Add at least one day to the meal plan.");
    }
    if (plan.days.length > 31) throw new Error("A meal plan can contain at most 31 days.");

    const days = plan.days.map((day, index) => {
      const dayNumber = index + 1;
      if (!day || typeof day !== "object" || Array.isArray(day)) {
        throw new Error(`Day ${dayNumber} must be an object.`);
      }
      const dayDate = valueOrDefault(day, "date", "");
      if (typeof dayDate !== "string") throw new Error(`Day ${dayNumber} date must be text.`);
      if (dayDate) {
        const parsed = new Date(`${dayDate}T00:00:00.000Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dayDate) || Number(dayDate.slice(0, 4)) < 1 || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dayDate) {
          throw new Error(`Day ${dayNumber} must use a valid YYYY-MM-DD date.`);
        }
      }
      if (!Array.isArray(day.foods)) throw new Error(`Day ${dayNumber} foods must be a list.`);
      if (day.foods.length > 100) throw new Error(`Day ${dayNumber} can contain at most 100 food items.`);

      const foods = day.foods.map((food, foodIndex) => {
        const prefix = `Day ${dayNumber}, food ${foodIndex + 1}`;
        if (!food || typeof food !== "object" || Array.isArray(food)) throw new Error(`${prefix} must be an object.`);
        if (typeof food.name !== "string" || !food.name.trim() || food.name.trim().length > 100) {
          throw new Error(`${prefix} needs a name between 1 and 100 characters.`);
        }
        const meal = valueOrDefault(food, "meal", "");
        if (typeof meal !== "string" || meal.length > 40) throw new Error(`${prefix} meal must be text up to 40 characters.`);
        const groups = valueOrDefault(food, "groups", []);
        const flags = valueOrDefault(food, "flags", []);
        if (!Array.isArray(groups) || groups.some((group) => typeof group !== "string" || !Object.hasOwn(FOOD_GROUPS, group))) {
          throw new Error(`${prefix} has an invalid food group.`);
        }
        if (!Array.isArray(flags) || flags.some((flag) => typeof flag !== "string" || !Object.hasOwn(RISK_FLAGS, flag))) {
          throw new Error(`${prefix} has an invalid food flag.`);
        }
        return {
          name: food.name.trim(),
          meal: meal.trim(),
          groups: [...new Set(groups)],
          flags: [...new Set(flags)],
        };
      });

      return {
        date: dayDate,
        foods,
        food_safety: assertReport(valueOrDefault(day, "food_safety", "unknown"), `Day ${dayNumber} food_safety`),
        iodized_salt: assertReport(valueOrDefault(day, "iodized_salt", "unknown"), `Day ${dayNumber} iodized_salt`),
      };
    });

    let infant = plan.infant ?? null;
    if (infant !== null) {
      if (!infant || typeof infant !== "object" || Array.isArray(infant)) {
        throw new Error("Infant feeding details must be an object.");
      }
      if (!Number.isInteger(infant.age_months) || infant.age_months < 0 || infant.age_months >= 24) {
        throw new Error("Infant age must be a whole number from 0 to 23 months.");
      }
      infant = {
        age_months: infant.age_months,
        exclusive_breastfeeding: assertReport(valueOrDefault(infant, "exclusive_breastfeeding", "unknown"), "exclusive_breastfeeding"),
        complementary_foods: assertReport(valueOrDefault(infant, "complementary_foods", "unknown"), "complementary_foods"),
        breastfeeding_continues: assertReport(valueOrDefault(infant, "breastfeeding_continues", "unknown"), "breastfeeding_continues"),
      };
    }
    return { days, infant };
  }

  function feedingChecks(infant, days) {
    if (!infant) {
      return [check("2", "not_assessed", "No infant age or feeding information was supplied.")];
    }
    if (infant.age_months < 6) {
      const nonBreastmilkFoods = days.flatMap((day) => day.foods)
        .filter((food) => food.name.toLowerCase().replace(/\s/g, "") !== "breastmilk")
        .map((food) => food.name);
      if (nonBreastmilkFoods.length) {
        return [check(
          "2",
          "attention",
          "Food items are listed for an infant under 6 months. Review the guideline's exclusive-breastfeeding recommendation.",
          nonBreastmilkFoods,
        )];
      }
      const status = infant.exclusive_breastfeeding === "yes"
        ? "met"
        : infant.exclusive_breastfeeding === "no" ? "attention" : "not_assessed";
      const message = {
        yes: "Exclusive breastfeeding is reported for an infant under 6 months.",
        no: "Exclusive breastfeeding is not reported for an infant under 6 months.",
        unknown: "Exclusive breastfeeding status is unknown.",
      }[infant.exclusive_breastfeeding];
      return [check("2", status, message)];
    }
    const reports = [infant.complementary_foods, infant.breastfeeding_continues];
    const status = reports.includes("no") ? "attention" : reports.includes("unknown") ? "not_assessed" : "met";
    let message = "Complementary foods and continued breastfeeding are both reported.";
    if (status === "attention") {
      const missing = [];
      if (infant.complementary_foods === "no") missing.push("complementary foods");
      if (infant.breastfeeding_continues === "no") missing.push("continued breastfeeding");
      message = `Not reported: ${missing.join(" and ")}.`;
    } else if (status === "not_assessed") {
      message = "Complementary-food or continued-breastfeeding status is unknown.";
    }
    return [check("2", status, message)];
  }

  function evaluateDay(day, dayNumber) {
    const foods = day.foods;
    const names = [...new Set(foods.map((food) => food.name.toLowerCase()))].sort();
    const groups = new Set(foods.flatMap((food) => food.groups));
    const flagged = foods
      .filter((food) => food.flags.length)
      .map((food) => `${food.name} (${food.flags.map((flag) => RISK_FLAGS[flag]).join(", ")})`);
    const varietyGroups = Object.keys(FOOD_GROUPS)
      .filter((group) => groups.has(group))
      .map((group) => FOOD_GROUPS[group]);

    const checks = [
      check(
        "1",
        "informational",
        `${names.length} distinct listed food(s) across ${varietyGroups.length} tagged food group(s). The guideline does not define a minimum variety threshold.`,
        varietyGroups,
      ),
      check(
        "3",
        groups.has("vegetable") && groups.has("fruit") ? "met" : "attention",
        groups.has("vegetable") && groups.has("fruit")
          ? "Vegetables and fruits are both listed."
          : "Add or confirm both vegetables and fruits in this day's plan.",
        ["vegetable", "fruit"].filter((group) => groups.has(group)).map((group) => FOOD_GROUPS[group]),
      ),
      check(
        "4",
        groups.has("protein") ? "met" : "attention",
        groups.has("protein")
          ? "At least one recommended protein-source group is listed."
          : "No fish, lean meat, poultry, egg, dried beans, or nuts are tagged for this day.",
      ),
      check(
        "5",
        groups.has("calcium") ? "met" : "attention",
        groups.has("calcium")
          ? "A calcium-rich food is listed."
          : "No milk, milk product, or other calcium-rich food is tagged for this day.",
      ),
    ];
    const safety = day.food_safety;
    checks.push(check(
      "6",
      { yes: "met", no: "attention", unknown: "not_assessed" }[safety],
      {
        yes: "Food and water safety was confirmed by the planner; this was not independently verified.",
        no: "Food and water safety was not confirmed for this day.",
        unknown: "Food and water safety was not assessed.",
      }[safety],
    ));
    checks.push(check(
      "7",
      { yes: "met", no: "attention", unknown: "not_assessed" }[day.iodized_salt],
      {
        yes: "Use of iodized salt was reported; product iodine content was not verified.",
        no: "Use of iodized salt was not reported for this day.",
        unknown: "Use of iodized salt was not assessed.",
      }[day.iodized_salt],
    ));
    checks.push(check(
      "8",
      flagged.length ? "attention" : "met",
      flagged.length
        ? `${flagged.length} food item(s) were marked for limiting.`
        : "No listed food was marked salty, fried, fatty, or sugar-rich.",
      flagged,
    ));
    return { label: day.date || `Day ${dayNumber}`, checks };
  }

  function evaluatePlan(plan) {
    const { days, infant } = validatePlan(plan);
    const dayResults = days.map((day, index) => evaluateDay(day, index + 1));
    const planChecks = [
      ...feedingChecks(infant, days),
      check("9", "not_assessed", "Normal body weight cannot be assessed from meal-plan entries alone."),
      check("10", "not_assessed", "Physical activity, stress management, alcohol, and smoking are outside a meal-plan screen."),
    ];
    const allChecks = [...planChecks, ...dayResults.flatMap((day) => day.checks)];
    const attentionCount = allChecks.filter((item) => item.status === "attention").length;
    const assessedCount = allChecks.filter((item) => ["met", "attention"].includes(item.status)).length;
    return {
      summary: {
        status: attentionCount ? "needs_review" : "no_flagged_gaps",
        attention_count: attentionCount,
        assessed_count: assessedCount,
        message: attentionCount
          ? `${attentionCount} item(s) need review.`
          : "No gaps were flagged in the assessable checks.",
      },
      plan_checks: planChecks,
      days: dayResults,
      disclaimer: "Screening only, not a compliance certification or medical advice. This tool uses the 2012 NNC resolution supplied with the project. The resolution gives broad recommendations, not numeric serving or nutrient limits; food groups and self-reports are planner-entered and are not independently verified.",
    };
  }

  const engine = { FOOD_GROUPS, RISK_FLAGS, RULES, evaluatePlan };
  root.MealPlanEngine = engine;
  if (typeof module !== "undefined" && module.exports) module.exports = engine;
}(globalThis));
