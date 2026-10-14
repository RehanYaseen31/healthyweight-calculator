'use strict';

/* ============================================================
   HealthyWeight — calculation logic + UI wiring.
   The `WC` module holds pure, DOM-free functions so the math
   can be unit-tested in Node. DOM wiring runs only when
   `document` exists.
   ============================================================ */

const WC = (() => {
  // ---- constants ----
  const CM_PER_IN = 2.54;
  const KG_PER_LB = 0.45359237;
  const BMI_LOW = 18.5;    // lower bound of the healthy adult BMI band
  const BMI_HIGH = 24.9;   // upper bound of the healthy adult BMI band
  const SCALE_MIN = 12;    // left edge of the visual BMI scale
  const SCALE_MAX = 40;    // right edge of the visual BMI scale

  // ---- input limits (min/max chosen to reject typos, not real people) ----
  const LIMITS = {
    cm: { min: 50, max: 300, unit: 'cm' },
    ft: { min: 1, max: 9, unit: 'ft' },
    inch: { min: 0, max: 11.9, unit: 'in' },
    kg: { min: 2, max: 635, unit: 'kg' },
    lb: { min: 4, max: 1400, unit: 'lb' },
    age: { min: 1, max: 120, unit: 'yrs' },
  };

  // ---- conversions ----
  function cmToMeters(cm) { return cm / 100; }
  function inchesToMeters(ft, inch) { return ((ft * 12) + inch) * CM_PER_IN / 100; }
  function kgToLb(kg) { return kg / KG_PER_LB; }
  function lbToKg(lb) { return lb * KG_PER_LB; }

  // ---- core formulas ----
  // BMI = weight (kg) / height (m)^2
  function calcBmi(weightKg, heightM) {
    return weightKg / (heightM * heightM);
  }

  // Healthy weight range from the adult BMI band 18.5–24.9.
  // Returns kilograms: { low, high }.
  function healthyRangeKg(heightM) {
    const h2 = heightM * heightM;
    return { low: BMI_LOW * h2, high: BMI_HIGH * h2 };
  }

  // Adult BMI category. Never call for age < 18 (handled separately).
  function bmiCategory(bmi) {
    if (bmi < 18.5) return 'underweight';
    if (bmi < 25) return 'healthy';
    if (bmi < 30) return 'overweight';
    return 'obesity';
  }

  // Position (0–1) of a BMI value on the visual scale, clamped to the track.
  function scalePosition(bmi) {
    const p = (bmi - SCALE_MIN) / (SCALE_MAX - SCALE_MIN);
    return Math.min(1, Math.max(0, p));
  }

  // ---- validation ----
  // Parses a raw string into a finite number, or returns NaN.
  function parseNum(raw) {
    if (raw === null || raw === undefined) return NaN;
    const s = String(raw).trim().replace(',', '.');
    if (s === '') return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  // Validates one numeric field. `required` decides empty-string handling.
  // Returns { value } on success or { error } on failure.
  function checkField(raw, key, label, required) {
    const lim = LIMITS[key];
    if (String(raw).trim() === '') {
      return required
        ? { error: `Please enter your ${label}.` }
        : { value: null };
    }
    const n = parseNum(raw);
    if (Number.isNaN(n)) {
      return { error: `Your ${label} must be a number (for example ${lim.min}).` };
    }
    if (n <= 0) {
      return { error: `Your ${label} must be greater than zero.` };
    }
    if (n < lim.min || n > lim.max) {
      return { error: `Your ${label} must be between ${lim.min} and ${lim.max} ${lim.unit}.` };
    }
    return { value: n };
  }

  // Validates the whole form.
  // data: { unit: 'metric'|'imperial', cm, ft, inch, kg, lb, age } (raw strings)
  // Returns { ok, errors: {fieldId: message}, values: {heightM, weightKg|null, age, unit} }
  function validate(data) {
    const errors = {};
    const values = { unit: data.unit, heightM: NaN, weightKg: null, age: NaN };

    if (data.unit === 'imperial') {
      const ft = checkField(data.ft, 'ft', 'height in feet', true);
      const inch = checkField(data.inch, 'inch', 'height in inches', true);
      if (ft.error) errors['height-ft'] = ft.error;
      if (inch.error) errors['height-in'] = inch.error;
      if (!ft.error && !inch.error) {
        values.heightM = inchesToMeters(ft.value, inch.value);
      }
      const lb = checkField(data.lb, 'lb', 'weight in pounds', false);
      if (lb.error) errors['weight-lb'] = lb.error;
      else if (lb.value !== null) values.weightKg = lbToKg(lb.value);
    } else {
      const cm = checkField(data.cm, 'cm', 'height in centimetres', true);
      if (cm.error) errors['height-cm'] = cm.error;
      else values.heightM = cmToMeters(cm.value);
      const kg = checkField(data.kg, 'kg', 'weight in kilograms', false);
      if (kg.error) errors['weight-kg'] = kg.error;
      else if (kg.value !== null) values.weightKg = kg.value;
    }

    const age = checkField(data.age, 'age', 'age in years', true);
    if (age.error) errors['age'] = age.error;
    else values.age = Math.floor(age.value);

    return { ok: Object.keys(errors).length === 0, errors, values };
  }

  // ---- result description ----
  // Compares a weight against the healthy range. Returns null when no weight given.
  function describeDifference(weightKg, range) {
    if (weightKg === null || weightKg === undefined) return null;
    const round1 = (n) => Math.round(n * 10) / 10;
    if (weightKg < range.low) {
      const gap = range.low - weightKg;
      return {
        state: 'below',
        gapKg: round1(gap),
        gapLb: round1(kgToLb(gap)),
        text: 'below your healthy range',
      };
    }
    if (weightKg > range.high) {
      const gap = weightKg - range.high;
      return {
        state: 'above',
        gapKg: round1(gap),
        gapLb: round1(kgToLb(gap)),
        text: 'above your healthy range',
      };
    }
    return { state: 'within', gapKg: 0, gapLb: 0, text: 'inside your healthy range' };
  }

  function formatWeight(kg, unit) {
    const round1 = (n) => (Math.round(n * 10) / 10).toFixed(1);
    if (unit === 'imperial') {
      return `${round1(kgToLb(kg))} lb (${round1(kg)} kg)`;
    }
    return `${round1(kg)} kg (${round1(kgToLb(kg))} lb)`;
  }

  return {
    CM_PER_IN, KG_PER_LB, BMI_LOW, BMI_HIGH, SCALE_MIN, SCALE_MAX, LIMITS,
    cmToMeters, inchesToMeters, kgToLb, lbToKg,
    calcBmi, healthyRangeKg, bmiCategory, scalePosition,
    parseNum, checkField, validate,
    describeDifference, formatWeight,
  };
})();

// Export for Node unit tests; harmless in the browser.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WC;
}

/* ============================================================
   DOM wiring — only runs in the browser.
   ============================================================ */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('calc-form');
    const results = document.getElementById('results');
    const unitRadios = form.querySelectorAll('input[name="units"]');

    const groups = {
      metric: document.getElementById('height-metric-group'),
      imperial: document.getElementById('height-imperial-group'),
    };
    const weightFields = {
      metric: document.getElementById('weight-metric-field'),
      imperial: document.getElementById('weight-imperial-field'),
    };

    const FIELDS = ['height-cm', 'height-ft', 'height-in', 'weight-kg', 'weight-lb', 'age'];

    function currentUnit() {
      const checked = form.querySelector('input[name="units"]:checked');
      return checked ? checked.value : 'metric';
    }

    function setError(fieldId, message) {
      const input = document.getElementById(fieldId);
      const err = document.getElementById(fieldId + '-error');
      if (!input || !err) return;
      if (message) {
        err.textContent = message;
        err.hidden = false;
        input.setAttribute('aria-invalid', 'true');
      } else {
        err.textContent = '';
        err.hidden = true;
        input.removeAttribute('aria-invalid');
      }
    }

    function clearAllErrors() {
      FIELDS.forEach((id) => setError(id, ''));
    }

    function applyUnitMode(unit) {
      const isMetric = unit === 'metric';
      groups.metric.hidden = !isMetric;
      groups.imperial.hidden = isMetric;
      weightFields.metric.hidden = !isMetric;
      weightFields.imperial.hidden = isMetric;
      clearAllErrors();
      try { localStorage.setItem('hw-units', unit); } catch (e) { /* storage unavailable */ }
    }

    // Restore the user's last unit choice.
    try {
      const saved = localStorage.getItem('hw-units');
      if (saved === 'imperial' || saved === 'metric') {
        form.querySelector(`input[name="units"][value="${saved}"]`).checked = true;
      }
    } catch (e) { /* storage unavailable */ }
    applyUnitMode(currentUnit());

    unitRadios.forEach((radio) => {
      radio.addEventListener('change', () => applyUnitMode(currentUnit()));
    });

    function readForm() {
      return {
        unit: currentUnit(),
        cm: document.getElementById('height-cm').value,
        ft: document.getElementById('height-ft').value,
        inch: document.getElementById('height-in').value,
        kg: document.getElementById('weight-kg').value,
        lb: document.getElementById('weight-lb').value,
        age: document.getElementById('age').value,
      };
    }

    // Scroll that respects the user's reduced-motion preference.
    function scrollToEl(el, block) {
      const reduce = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: block || 'start' });
    }

    function renderResults(values) {
      const { heightM, weightKg, age, unit } = values;
      const range = WC.healthyRangeKg(heightM);
      const isMinor = age < 18;

      // --- healthy range (always shown, both units) ---
      document.getElementById('range-low').textContent =
        unit === 'imperial' ? WC.kgToLb(range.low).toFixed(1) : range.low.toFixed(1);
      document.getElementById('range-high').textContent =
        unit === 'imperial' ? WC.kgToLb(range.high).toFixed(1) : range.high.toFixed(1);
      document.getElementById('range-unit').textContent = unit === 'imperial' ? 'lb' : 'kg';
      document.getElementById('range-alt').textContent =
        unit === 'imperial'
          ? `That's ${range.low.toFixed(1)} – ${range.high.toFixed(1)} kg.`
          : `That's ${WC.kgToLb(range.low).toFixed(1)} – ${WC.kgToLb(range.high).toFixed(1)} lb.`;
      document.getElementById('range-explain').textContent =
        'Estimated from the healthy adult BMI band (18.5–24.9) for your height.';

      // --- BMI + category (only when weight provided) ---
      const bmiBlock = document.getElementById('bmi-block');
      const verdict = document.getElementById('verdict');
      const minorNotice = document.getElementById('minor-notice');
      const marker = document.getElementById('scale-marker');

      if (weightKg !== null) {
        const bmi = WC.calcBmi(weightKg, heightM);
        bmiBlock.hidden = false;
        document.getElementById('bmi-value').textContent = bmi.toFixed(1);

        const chip = document.getElementById('bmi-category');
        const explain = document.getElementById('bmi-explain');
        if (isMinor) {
          chip.hidden = true;
          explain.textContent = 'BMI shown for reference only — adult categories don\u2019t apply under 18.';
          minorNotice.hidden = false;
          minorNotice.textContent =
            'You\u2019re under 18, so adult BMI categories don\u2019t apply to you. Healthy weight for young people ' +
            'is judged with age- and sex-specific growth charts — a doctor or school nurse can interpret those with you.';
        } else {
          const cat = WC.bmiCategory(bmi);
          chip.hidden = false;
          chip.textContent = { underweight: 'Underweight', healthy: 'Healthy', overweight: 'Overweight', obesity: 'Obesity' }[cat];
          chip.className = 'category-chip chip-' + cat;
          explain.textContent = 'Based on standard adult BMI cut-offs (18.5 / 25 / 30).';
          minorNotice.hidden = true;
        }

        // --- difference vs range ---
        const diff = WC.describeDifference(weightKg, range);
        verdict.hidden = false;
        verdict.classList.toggle('warn', diff.state !== 'within');
        if (diff.state === 'within') {
          verdict.textContent = `Your current weight of ${WC.formatWeight(weightKg, unit)} is inside your healthy range.`;
        } else {
          verdict.textContent =
            `Your current weight of ${WC.formatWeight(weightKg, unit)} is ` +
            `${diff.gapKg.toFixed(1)} kg (${diff.gapLb.toFixed(1)} lb) ${diff.text}.`;
        }

        // --- scale marker ---
        marker.hidden = false;
        // Set after paint so the CSS transition animates the pin.
        requestAnimationFrame(() => {
          marker.style.left = (WC.scalePosition(bmi) * 100).toFixed(2) + '%';
        });
        document.getElementById('marker-label').textContent = 'BMI ' + bmi.toFixed(1);
        document.getElementById('scale-desc').setAttribute(
          'aria-label',
          `BMI scale from 12 to 40. Your BMI is ${bmi.toFixed(1)}, ` +
          (isMinor ? 'shown for reference only.' : `category: ${WC.bmiCategory(bmi)}.`)
        );
      } else {
        bmiBlock.hidden = true;
        verdict.hidden = true;
        minorNotice.hidden = true;
        marker.hidden = true;
        document.getElementById('scale-desc').setAttribute(
          'aria-label',
          'BMI scale from 12 to 40 showing underweight, healthy, overweight and obesity bands.'
        );
      }

      document.getElementById('scale-note').textContent =
        `For your height, the green “Healthy” band equals ` +
        `${range.low.toFixed(1)}\u2013${range.high.toFixed(1)} kg ` +
        `(${WC.kgToLb(range.low).toFixed(1)}\u2013${WC.kgToLb(range.high).toFixed(1)} lb).`;

      results.hidden = false;
      scrollToEl(results, 'start');
      document.getElementById('results-heading').setAttribute('tabindex', '-1');
      document.getElementById('results-heading').focus({ preventScroll: true });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      clearAllErrors();
      const { ok, errors, values } = WC.validate(readForm());
      if (!ok) {
        Object.entries(errors).forEach(([fieldId, msg]) => setError(fieldId, msg));
        results.hidden = true;
        const firstBad = document.getElementById(Object.keys(errors)[0]);
        if (firstBad) firstBad.focus();
        return;
      }
      renderResults(values);
    });

    form.addEventListener('reset', () => {
      clearAllErrors();
      results.hidden = true;
      // Keep the chosen unit; move focus back to the first visible height input.
      setTimeout(() => {
        const target = currentUnit() === 'imperial'
          ? document.getElementById('height-ft')
          : document.getElementById('height-cm');
        if (target) target.focus();
      }, 0);
    });

    document.getElementById('recalc-btn').addEventListener('click', () => {
      scrollToEl(document.getElementById('calculator'));
      const target = currentUnit() === 'imperial'
        ? document.getElementById('height-ft')
        : document.getElementById('height-cm');
      if (target) target.focus({ preventScroll: true });
    });
  });
}
