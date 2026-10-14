# HealthyWeight — Ideal Weight Calculator

A self-contained, dependency-free weight calculator website: one HTML file, one CSS file,
one vanilla-JS file. No build step, no external fonts, images, libraries, or APIs.

## Files

- `index.html` — semantic markup, SEO meta, hero, calculator form, results, educational
  section (how it works, BMI formula, worked example), FAQs, FAQ structured data.
- `styles.css` — soft neutral background, white cards, teal accent; responsive
  (mobile / tablet / desktop); visible focus states; `prefers-reduced-motion` support.
- `script.js` — unit toggle (metric/imperial), input validation, calculations, results
  rendering, BMI scale visualization, under-18 handling. Pure math lives in the `WC`
  module, which is also exported for Node so it can be unit-tested.

## How to run

Option A — just open it:

1. Open `index.html` in any modern browser (double-click works).

Option B — local server (recommended, avoids `file://` quirks):

```bash
cd weight-calculator
python3 -m http.server 8000
# then open http://localhost:8000
```

## Formulas used

- **Height conversion:** metric: m = cm ÷ 100. Imperial: m = (ft × 12 + in) × 2.54 ÷ 100.
- **Weight conversion:** kg = lb × 0.45359237 (and the inverse).
- **Healthy weight range:** from the adult BMI band 18.5–24.9 (WHO/CDC):
  `low = 18.5 × height(m)²`, `high = 24.9 × height(m)²`.
- **BMI:** `weight(kg) ÷ height(m)²`. (The imperial form 703 × lb ÷ in² is algebraically
  identical; internally everything is converted to metric first.)
- **Adult categories (age ≥ 18 only):** < 18.5 underweight · 18.5–24.9 healthy ·
  25–29.9 overweight · ≥ 30 obesity.
- **Difference:** current weight minus the nearest bound of the range
  (below → range low − weight; above → weight − range high).

## Behavior notes

- Weight is optional: without it you still get the healthy range, but no BMI/category.
- Age is required. Under 18, adult BMI categories are **not** applied; an
  age-appropriate notice is shown instead and the BMI is labelled reference-only.
- Validation rejects empty, zero, negative, and non-numeric inputs, plus values
  outside sane limits (height 50–300 cm / 1–9 ft, weight 2–635 kg, age 1–120).
- Results update in place — no page reload. The unit toggle remembers your last
  choice via `localStorage`.
- Verified with Node unit tests (`/tmp` test script during development) covering:
  conversions, the worked example (170 cm / 70 kg → range 53.5–72.0 kg, BMI 24.2),
  category boundaries, validation edge cases, and under-18 logic.

## Remaining limitations

- No production URL is configured, so canonical/social meta tags are intentionally
  omitted (add them when the site is deployed).
- `localStorage` for the unit preference may be unavailable in strict private-browsing
  modes; the calculator still works, it just won't remember the unit choice.
- The healthy range is an estimate from BMI alone — it cannot account for muscle
  mass, body composition, pregnancy, or medical conditions. This is stated on the
  page and in the FAQs.
