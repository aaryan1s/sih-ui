/**
 * Compliance engine — deterministic, rule-based evaluation of extracted
 * declarations against the Legal Metrology (Packaged Commodities) Rules 2011.
 *
 * STRICT SEPARATION (spec §12): this module answers only
 * "does the detected information satisfy the applicable requirement?".
 * It never extracts text and never guesses values — it consumes the output
 * of extractionService and returns findings:
 *   check · result (PASS/FAIL/REVIEW) · reason · rule_reference · severity
 *
 * Honest limits: where a rule needs measurements the OCR cannot provide
 * (e.g. true font size in mm), the engine returns REVIEW — never a verdict.
 */

const RESULT = { PASS: 'ok', FAIL: 'bad', REVIEW: 'warn', NA: 'na', UNKNOWN: 'unknown' };

const RULES = {
  MRP: 'Rule 2(1)(m), LM (PC) Rules 2011',
  NET_QUANTITY: 'Rule 3, LM (PC) Rules 2011',
  MANUFACTURER: 'Rule 6(1), LM (PC) Rules 2011',
  MFG_DATE: 'Rule 6(4), LM (PC) Rules 2011',
  BEST_BEFORE: 'Rule 6(3), LM (PC) Rules 2011',
  BATCH: 'Rule 6(6), LM (PC) Rules 2011',
  FSSAI: 'FSS Act 2006 §31 / LM (PC) Rule 2(1)',
  COUNTRY_ORIGIN: 'Rule 6(7), LM (PC) Rules 2011',
  FONT_SIZE: 'Rule 9(4), LM (PC) Rules 2011',
};

const MANDATORY = [
  { key: 'MRP', label: 'MRP (Incl. of all taxes)' },
  { key: 'NET_QUANTITY', label: 'Net Quantity' },
  { key: 'MANUFACTURER', label: 'Manufacturer Name & Address' },
  { key: 'MFG_DATE', label: 'Month & Year of Manufacture' },
  { key: 'BEST_BEFORE', label: 'Expiry / Best Before' },
];

const patterns = {
  mrp: /(?:mrp|max\.?retail|₹|rs\.?|inr)\s*[:.]?\s*₹?\s*(\d+(?:[.,]\d{1,2})?)/i,
  netQty: /(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|ltr|litre|liter)\b/i,
  date: /(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})|(\d{2,4}[-/.]\d{1,2})|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-/.\s]?\d{2,4}/i,
  batch: /(?:batch|lot|b\.?no)\s*[:.#]?\s*([a-z0-9-]{3,})/i,
  fssai: /\b(\d{14})\b/,
};

const findDecl = (declarations, key) => {
  // Normalize BOTH sides (the needle too — NET_QUANTITY → NETQUANTITY),
  // otherwise underscored mandatory keys never match their declarations.
  const needle = key.toUpperCase().replace(/[^A-Z]/g, '');
  return declarations.find((d) => (d.key || d.name || '').toUpperCase().replace(/[^A-Z]/g, '').includes(needle));
};

const severityFor = (key) =>
  key === 'MRP' || key === 'NET_QUANTITY' || key === 'MANUFACTURER' ? 'severe'
    : key === 'BEST_BEFORE' || key === 'MFG_DATE' ? 'major'
    : 'minor';

const finding = (key, label, result, value, reason, extras = {}) => ({
  id: key.toLowerCase(),
  check: label,
  result,
  value: value ?? null,
  reason,
  rule_reference: RULES[key] || 'LM (PC) Rules 2011',
  severity: result === RESULT.FAIL ? severityFor(key) : result === RESULT.REVIEW ? 'minor' : null,
  dimensions: {
    presence: result,
    correctness: extras.correctness ?? (result === RESULT.PASS ? RESULT.PASS : RESULT.NA),
    placement: extras.placement ?? RESULT.NA,
    readability: extras.readability ?? RESULT.NA,
    font_size: extras.font_size ?? RESULT.NA,
    confidence: extras.confidence ?? null,
  },
  bounding_box: extras.bbox ?? null,
  violation_type: result === RESULT.FAIL ? extras.violation_type || 'missing' : null,
});

/** Evaluate extracted declarations → structured compliance findings. */
export function evaluate(declarations = [], context = {}) {
  const findings = [];

  // 1. Mandatory presence checks
  for (const { key, label } of MANDATORY) {
    const decl = findDecl(declarations, key);
    if (!decl || !decl.value) {
      findings.push(finding(key, label, RESULT.FAIL, null, 'Required declaration could not be detected on the label.', { violation_type: 'missing' }));
    } else {
      // 2. Correctness heuristics per type
      const text = String(decl.value);
      let correct = true;
      let reason = 'Declaration detected and appears valid.';

      if (key === 'MRP' && !patterns.mrp.test(text)) {
        correct = false;
        reason = 'MRP detected but not in the prescribed "₹ / MRP" format — verify manually.';
      }
      if (key === 'NET_QUANTITY' && !patterns.netQty.test(text)) {
        correct = false;
        reason = 'Net quantity detected without a standard unit (g/kg/ml/L).';
      }
      if ((key === 'MFG_DATE' || key === 'BEST_BEFORE') && !patterns.date.test(text)) {
        correct = false;
        reason = 'Date declaration found but format is not recognisable — verify manually.';
      }

      // Null confidence = inspector-entered/authoritative value — never treated
      // as a low-confidence OCR read (typeof check keeps null out of the
      // comparison, so a manual value takes the normal evaluation path).
      const lowConfidence = typeof decl.confidence === 'number' && decl.confidence < 0.6;
      const readability = lowConfidence ? RESULT.REVIEW : RESULT.PASS;

      if (!correct) {
        findings.push(finding(key, label, RESULT.REVIEW, decl.value, reason, {
          correctness: RESULT.REVIEW,
          readability,
          confidence: decl.confidence,
          bbox: decl.bbox,
          violation_type: 'uncertain_value',
        }));
      } else if (lowConfidence) {
        findings.push(finding(key, label, RESULT.REVIEW, decl.value, 'Declaration detected with low OCR confidence — readability requires review.', {
          readability: RESULT.REVIEW,
          confidence: decl.confidence,
          bbox: decl.bbox,
        }));
      } else {
        findings.push(finding(key, label, RESULT.PASS, decl.value, reason, {
          readability,
          confidence: decl.confidence,
          bbox: decl.bbox,
        }));
      }
    }
  }

  // 3. Conditional declarations
  const batch = findDecl(declarations, 'BATCH');
  findings.push(
    batch?.value
      ? finding('BATCH', 'Batch / Lot Number', RESULT.PASS, batch.value, 'Batch number detected.', { confidence: batch.confidence, bbox: batch.bbox })
      : finding('BATCH', 'Batch / Lot Number', RESULT.REVIEW, null, 'Batch number not detected — required for certain commodity classes; verify manually.', {})
  );

  const fssai = findDecl(declarations, 'FSSAI');
  if (fssai?.value) {
    const ok = patterns.fssai.test(String(fssai.value).replace(/\s/g, ''));
    findings.push(finding('FSSAI', 'FSSAI License Number', ok ? RESULT.PASS : RESULT.REVIEW, fssai.value,
      ok ? '14-digit FSSAI number detected.' : 'FSSAI-like number found but not 14 digits — verify manually.',
      { correctness: ok ? RESULT.PASS : RESULT.REVIEW, confidence: fssai.confidence, bbox: fssai.bbox }));
  }

  const origin = findDecl(declarations, 'COUNTRY');
  if (origin?.value) {
    findings.push(finding('COUNTRY_ORIGIN', 'Country of Origin', RESULT.PASS, origin.value, 'Country of origin detected.', { confidence: origin.confidence }));
  }

  // 4. Font-size verification — needs physical measurements OCR cannot give.
  // If extraction provides bbox heights we flag the smallest relative line for review.
  const bboxes = declarations.filter((d) => d.bbox && d.bbox.h).map((d) => ({ name: d.name || d.key, h: d.bbox.h }));
  if (bboxes.length >= 3) {
    const smallest = bboxes.reduce((min, b) => (b.h < min.h ? b : min));
    const ratio = smallest.h / Math.max(...bboxes.map((b) => b.h));
    findings.push({
      id: 'font_size',
      check: 'Font Size — Declarations',
      result: RESULT.REVIEW,
      value: `${(ratio * 100).toFixed(0)}% of largest declaration`,
      reason: 'Font-size verification against prescribed minimums requires physical measurement — flagged for inspector review.',
      rule_reference: RULES.FONT_SIZE,
      severity: 'minor',
      dimensions: { presence: RESULT.PASS, correctness: RESULT.NA, placement: RESULT.NA, readability: RESULT.NA, font_size: RESULT.REVIEW, confidence: null },
      bounding_box: null,
      violation_type: null,
    });
  }

  const passCount = findings.filter((f) => f.result === RESULT.PASS).length;
  const failCount = findings.filter((f) => f.result === RESULT.FAIL).length;
  const reviewCount = findings.filter((f) => f.result === RESULT.REVIEW).length;

  return {
    findings,
    summary: {
      overall: failCount > 0 ? 'non_compliant' : reviewCount > 0 ? 'warning' : 'compliant',
      compliantCount: passCount,
      warnCount: reviewCount,
      violationCount: failCount,
      undeterminedCount: 0,
      engineVersion: 'lm-pc-2011-heuristics-v1',
      disclaimer:
        'Automated findings are advisory. Where heuristics cannot determine compliance the result is REVIEW, and the inspector confirms the final verdict.',
    },
  };
}

export const complianceService = { evaluate };
