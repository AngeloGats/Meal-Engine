const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluatePlan } = require("../web/engine.js");

function makePlan(...foods) {
  return {
    days: [{
      date: "2026-10-13",
      foods,
      food_safety: "yes",
      iodized_salt: "yes",
    }],
  };
}

function dayCheck(report, id) {
  return report.days[0].checks.find((item) => item.id === id);
}

test("a day with all recommended food groups has no flagged gaps", () => {
  const report = evaluatePlan(makePlan(
    { name: "Rice", groups: ["staple"] },
    { name: "Mango and kangkong", groups: ["fruit", "vegetable"] },
    { name: "Egg", groups: ["protein"] },
    { name: "Milk", groups: ["calcium"] },
  ));

  assert.equal(report.summary.status, "no_flagged_gaps");
  assert.equal(dayCheck(report, "3").status, "met");
  assert.equal(dayCheck(report, "4").status, "met");
  assert.equal(dayCheck(report, "5").status, "met");
  assert.equal(dayCheck(report, "8").status, "met");
  assert.equal(report.plan_checks[0].status, "not_assessed");
});

test("missing groups and flagged foods request review without invented thresholds", () => {
  const report = evaluatePlan(makePlan(
    { name: "Fried fish", groups: ["protein"], flags: ["fried", "salty"] },
  ));

  assert.equal(dayCheck(report, "3").status, "attention");
  assert.equal(dayCheck(report, "5").status, "attention");
  assert.equal(dayCheck(report, "8").status, "attention");
  assert.match(dayCheck(report, "1").message, /does not define a minimum variety threshold/);
});

test("infant recommendations depend on age and listed foods", () => {
  const underSixMonths = makePlan({ name: "Mashed banana", groups: ["fruit"] });
  underSixMonths.infant = {
    age_months: 4,
    exclusive_breastfeeding: "yes",
  };
  assert.equal(evaluatePlan(underSixMonths).plan_checks[0].status, "attention");

  const fromSixMonths = makePlan();
  fromSixMonths.infant = {
    age_months: 8,
    complementary_foods: "yes",
    breastfeeding_continues: "yes",
  };
  assert.equal(evaluatePlan(fromSixMonths).plan_checks[0].status, "met");
});

test("self-reported unknowns and malformed plans are handled explicitly", () => {
  const report = evaluatePlan({
    days: [{ foods: [], food_safety: "unknown", iodized_salt: "unknown" }],
  });
  assert.equal(dayCheck(report, "6").status, "not_assessed");
  assert.equal(dayCheck(report, "7").status, "not_assessed");
  assert.throws(() => evaluatePlan({ days: [] }), /at least one day/);
  assert.throws(() => evaluatePlan(makePlan({ name: "Rice", groups: ["invalid"] })), /invalid food group/);
});
