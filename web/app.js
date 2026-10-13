(() => {
  "use strict";

  const { FOOD_GROUPS, RISK_FLAGS, RULES, evaluatePlan } = window.MealPlanEngine;
  const daysRoot = document.querySelector("#days");
  const form = document.querySelector("#meal-plan-form");
  const errorBox = document.querySelector("#form-error");
  const results = document.querySelector("#results");
  let nextDayId = 1;

  function makeTagPicker(options, label) {
    const details = document.createElement("details");
    details.className = "tag-picker";
    const summary = document.createElement("summary");
    summary.textContent = label;
    const list = document.createElement("div");
    list.className = "tag-options";
    for (const [value, title] of Object.entries(options)) {
      const option = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = value;
      checkbox.addEventListener("change", () => {
        const count = list.querySelectorAll("input:checked").length;
        const noun = label === "Food groups" ? `group${count === 1 ? "" : "s"}` : `flag${count === 1 ? "" : "s"}`;
        summary.textContent = count ? `${count} ${noun} selected` : label;
        details.open = false;
      });
      option.append(checkbox, document.createTextNode(title));
      list.append(option);
    }
    details.append(summary, list);
    return details;
  }

  function makeSelect(labelText, id, choices) {
    const label = document.createElement("label");
    label.className = "field";
    label.append(document.createTextNode(labelText));
    const select = document.createElement("select");
    select.id = id;
    for (const [value, text] of choices) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    label.append(select);
    return label;
  }

  function addFoodRow(card) {
    const row = document.createElement("div");
    row.className = "food-row";
    const name = document.createElement("input");
    name.className = "food-name";
    name.type = "text";
    name.maxLength = 100;
    name.placeholder = "Food or dish";
    name.setAttribute("aria-label", "Food or dish");

    const meal = document.createElement("select");
    meal.className = "meal-select";
    meal.setAttribute("aria-label", "Meal");
    for (const value of ["Breakfast", "Lunch", "Dinner", "Snack", "Other"]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      meal.append(option);
    }

    const groups = makeTagPicker(FOOD_GROUPS, "Food groups");
    const flags = makeTagPicker(RISK_FLAGS, "Limit flags");
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-food";
    remove.setAttribute("aria-label", "Remove food");
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      row.remove();
      if (!card.querySelector(".food-row")) addFoodRow(card);
    });
    row.append(name, meal, groups, flags, remove);
    card.querySelector(".food-list").append(row);
  }

  function renumberDays() {
    daysRoot.querySelectorAll(".day-card").forEach((card, index) => {
      const number = index + 1;
      card.querySelector(".day-title").textContent = `Day ${number}`;
      card.querySelector(".day-date").setAttribute("aria-label", `Date for day ${number}`);
    });
  }

  function addDay() {
    if (daysRoot.querySelectorAll(".day-card").length >= 31) {
      showError("A meal plan can contain at most 31 days.");
      return;
    }
    const id = nextDayId++;
    const card = document.createElement("article");
    card.className = "day-card";
    card.innerHTML = `
      <div class="day-header">
        <h3 class="day-title">Day ${id}</h3>
        <input class="day-date" type="date" aria-label="Date for day ${id}">
        <button class="remove-day" type="button">Remove day</button>
      </div>
      <div class="food-list"></div>
      <div class="day-actions">
        <button class="add-food" type="button">+ Add food</button>
        <div class="self-reports"></div>
      </div>`;
    card.querySelector(".add-food").addEventListener("click", () => addFoodRow(card));
    card.querySelector(".remove-day").addEventListener("click", () => {
      if (daysRoot.querySelectorAll(".day-card").length === 1) {
        showError("Keep at least one day in the meal plan.");
        return;
      }
      card.remove();
      renumberDays();
      hideError();
    });
    const reports = card.querySelector(".self-reports");
    reports.append(
      makeSelect("Food & water safety", `safety-${id}`, [
        ["unknown", "Not assessed"], ["yes", "Confirmed"], ["no", "Not confirmed"],
      ]),
      makeSelect("Iodized salt", `salt-${id}`, [
        ["unknown", "Not assessed"], ["yes", "Yes"], ["no", "No"],
      ]),
    );
    daysRoot.append(card);
    addFoodRow(card);
    renumberDays();
    hideError();
  }

  function collectPlan() {
    const days = [...daysRoot.querySelectorAll(".day-card")].map((card) => ({
      date: card.querySelector(".day-date").value,
      food_safety: card.querySelector(".self-reports select[id^='safety-']").value,
      iodized_salt: card.querySelector(".self-reports select[id^='salt-']").value,
      foods: [...card.querySelectorAll(".food-row")]
        .filter((row) => row.querySelector(".food-name").value.trim())
        .map((row) => ({
          name: row.querySelector(".food-name").value.trim(),
          meal: row.querySelector(".meal-select").value,
          groups: [...row.querySelectorAll(".tag-picker:nth-of-type(1) input:checked")].map((input) => input.value),
          flags: [...row.querySelectorAll(".tag-picker:nth-of-type(2) input:checked")].map((input) => input.value),
        })),
    }));
    const ageValue = document.querySelector("#infant-age").value.trim();
    const plan = { days };
    if (ageValue) {
      const age = Number(ageValue);
      if (!Number.isInteger(age) || age < 0 || age > 23) {
        throw new Error("Infant age must be a whole number from 0 to 23 months.");
      }
      plan.infant = {
        age_months: age,
        exclusive_breastfeeding: document.querySelector("#exclusive-breastfeeding").value,
        complementary_foods: document.querySelector("#complementary-foods").value,
        breastfeeding_continues: document.querySelector("#breastfeeding-continues").value,
      };
    }
    return plan;
  }

  function makeCheckCard(item) {
    const card = document.createElement("article");
    card.className = `check-card status-${item.status}`;
    const status = document.createElement("span");
    status.className = "check-status";
    status.textContent = {
      met: "Covered",
      attention: "Review",
      not_assessed: "Not assessed",
      informational: "Info",
    }[item.status];
    const title = document.createElement("h4");
    title.textContent = `#${item.id} ${item.title}`;
    const message = document.createElement("p");
    message.textContent = item.message;
    card.append(status, title, message);
    if (item.evidence?.length) {
      const evidence = document.createElement("p");
      evidence.className = "check-evidence";
      evidence.textContent = item.evidence.join(" · ");
      card.append(evidence);
    }
    return card;
  }

  function renderChecks(container, checks) {
    container.replaceChildren(...checks.map(makeCheckCard));
  }

  function renderResults(report) {
    const needsReview = report.summary.status === "needs_review";
    const badge = document.querySelector("#result-status");
    badge.classList.toggle("needs-review", needsReview);
    badge.textContent = needsReview ? "Review recommended" : "No gaps flagged";
    document.querySelector("#result-summary").textContent = report.summary.message;
    renderChecks(document.querySelector("#plan-checks"), report.plan_checks);

    const dayResults = document.querySelector("#day-results");
    dayResults.replaceChildren();
    for (const day of report.days) {
      const section = document.createElement("section");
      section.className = "day-result";
      const heading = document.createElement("h3");
      heading.textContent = day.label;
      const checks = document.createElement("div");
      checks.className = "check-list";
      renderChecks(checks, day.checks);
      section.append(heading, checks);
      dayResults.append(section);
    }
    document.querySelector("#disclaimer").textContent = report.disclaimer;
    results.hidden = false;
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function hideError() {
    errorBox.textContent = "";
    errorBox.hidden = true;
  }

  function renderGuidelines() {
    const list = document.querySelector("#guideline-list");
    list.replaceChildren(...RULES.map((rule) => {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = `${rule.title}. `;
      item.append(title, document.createTextNode(rule.guideline));
      return item;
    }));
  }

  document.querySelector("#add-day").addEventListener("click", addDay);
  document.addEventListener("click", (event) => {
    const currentPicker = event.target.closest(".tag-picker");
    daysRoot.querySelectorAll(".tag-picker[open]").forEach((picker) => {
      if (picker !== currentPicker) picker.open = false;
    });
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    hideError();
    try {
      renderResults(evaluatePlan(collectPlan()));
    } catch (error) {
      showError(error.message || "The meal plan could not be checked.");
    }
  });

  renderGuidelines();
  addDay();
})();
