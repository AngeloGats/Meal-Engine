# Meal-plan guideline checker

A compact, dependency-free tool that screens meal plans against the ten recommendations in the supplied **NNC Governing Board Resolution No. 6, Series of 2012: Adoption of the 2012 Nutritional Guidelines for Filipinos**.

## Run with VS Code Live Server

Open `web/index.html` in VS Code and choose **Open with Live Server**. The page and assets use paths relative to the HTML file, and the rule engine runs in the browser. The checker works as a static site; it does not need a server, API, package install, or network access.

## Optional Python API

The Python API provides the same checks independently of the static website. To run it, use Python 3.10 or newer:

```powershell
python server.py
```

Then open <http://127.0.0.1:8000>.

## What the screen checks

- Checks each day separately for listed vegetables and fruits, a tagged recommended protein source, and a tagged calcium-rich food.
- Lets the planner report whether food and water safety and iodized-salt use were confirmed.
- Flags foods the planner marks as salty, fried, fatty, or sugar-rich.
- Optionally screens reported infant-feeding practices when an age under 24 months is entered.
- Shows the other recommendations and explains why body weight, physical activity, stress, alcohol, and smoking cannot be established by a meal list alone.

Food-group tags and self-reported information are supplied by the planner. The resolution does not prescribe numeric serving, nutrient, food-variety, or risk-food limits, so the app does not invent thresholds or compute a compliance percentage. A "covered" result means only that the specified information was present in the submitted plan; it is not independent verification, a formal policy certification, or medical advice.

## API

- `GET /api/guidelines` returns the source title and guideline messages.
- `POST /api/evaluate` accepts a JSON object with a `days` list. Each day has `foods` (`name`, `groups`, optional `flags`), and optional `food_safety` / `iodized_salt` self-reports (`yes`, `no`, or `unknown`). An optional `infant` object has `age_months` (0–23) and breastfeeding/complementary-food self-reports.

## Tests

```powershell
python -m unittest discover -s tests -v
node --test tests/engine.test.js
```
