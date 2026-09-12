/**
 * extractionService — OCR pipeline (Phase 8).
 *
 * Answers ONLY: "what information is present on the package?" (spec §12).
 * Compliance verdicts come from complianceEngine.evaluate() — never here.
 *
 * Provider contract (swap without touching UI):
 *   analyze(imageFile, { onStage }) → {
 *     imageUrl, fields: [{ key, label, value, confidence, bbox }],
 *     words: [{ text, confidence, bbox }], provider
 *   }
 *
 * Providers:
 *  - 'server' (when VITE_OCR_ENDPOINT is set): POST the image to the local
 *    PaddleOCR service (ocr-service/, see its README). Primary engine —
 *    returns text + confidence + bounding boxes per detected region; the
 *    payload is adapted below into the SAME words/lines/fields contract the
 *    browser provider produces, so extraction heuristics and everything
 *    downstream are engine-agnostic.
 *  - 'tesseract-browser' (fallback when no endpoint is configured): real OCR
 *    in-browser via tesseract.js WebWorker. CPU-only, ~60 MB, 1–6 s first
 *    pass (cached after). Free, ₹0. Retained deliberately as the offline
 *    fallback so the workflow stays usable without the Python service.
 */

let workerPromise = null;
const loadTesseract = () => import('tesseract.js');

async function getWorker(onLog) {
  if (!workerPromise) {
    workerPromise = loadTesseract().then((Tesseract) =>
      Tesseract.createWorker('eng', 1, {
        logger: (m) => onLog?.(m),
      })
    );
  }
  return workerPromise;
}

/* ---------- word-grouping heuristics (post-processing) ---------- */

/* ---------- extraction: normalization → classification → field mapping ----------
   Real packaging does not use consistent labels, so extraction NEVER relies on
   exact keyword matching. This stage consumes the OCR response only (the OCR
   service itself is untouched) and works in four steps:
     1. Text normalization — whitespace, punctuation, case tolerance.
     2. Line classification — a label-synonym dictionary (Mfd./Pkd./Best Before/
        Net Wt./Max. Retail Price/…) + value grammars (amounts, quantities,
        dates, GSTIN, FSSAI, phones, e-mails).
     3. Contextual mapping — labeled lines yield values; manufacturer/packer,
        consumer-care and address blocks are assembled from multi-line
        relationships; product name / brand are inferred from POSITIONAL
        prominence (font size + location), never from an expected label.
     4. Confidence assessment — (OCR confidence) × (evidence weight): labeled
        matches weigh most, contextual inference less, positional inference
        least. Below MIN_FIELD_CONFIDENCE the field stays BLANK for the
        inspector instead of risking a wrong value — no hallucinations.
*/

/** Label-synonym dictionary. Order of testing matters (see classifyLabel). */
const LABEL_RES = {
  MRP: /\b(?:m\.?r\.?p\.?|max(?:imum)?\.?\s*retail(?:\s*price)?\.?|retail\s*price)\b/i,
  OTHER_PRICE: /\b(?:selling\s*price|unit\s*price|our\s*price|discount(?:ed)?\s*price|offer\s*price)\b/i,
  NET_QTY: /\b(?:net(?:t)?\s*(?:qty\.?|wt\.?|weight|volume|quantity|contents?)|quantity|contents?)\b/i,
  BATCH: /\b(?:batch(?:\s*(?:no\.?|number))?|lot(?:\s*(?:no\.?|number))?|b\.?no\.?)\b/i,
  GSTIN: /\b(?:gstin(?:\s*no\.?)?|gst\s*(?:no\.?|number|regd?\.?(?:\s*no\.?)?|registration(?:\s*no\.?)?))\b/i,
  FSSAI: /\bfssai\b/i,
  ORIGIN: /\b(?:country\s*of\s*origin|origin|made\s*in|product\s*of)\b/i,
  CONSUMER: /\b(?:consumer\s*care|customer\s*care|for\s*complaints?|feedback|helpline|toll\s*free|contact\s*(?:us|no)?\.?|phone|tel(?:ephone)?\.?|e-?mail|call\s*(?:us|at)?)\b/i,
  BARCODE: /\b(?:barcode|bar\s*code|ean|upc)\b/i,
  PRODUCT: /^(?:product(?:\s*name)?|name\s*of\s*(?:the\s*)?product|description)\b/i,
  BRAND: /^brand(?:\s*name)?\b/i,
};

/** Value grammars — recognise values with or without a preceding label. */
const VALUE_RES = {
  MRP: /(\d{1,6})\s*[-\u2013]\s*(\d{2})\b|(?:₹|₨|rs\.?|inr\.?|r\.\s?)\s*(\d+(?:[.,]\d{1,2})?)|\b(\d+(?:[.,]\d{1,2})?)\s*\/-?\b/i,
  NET_QTY: /(?:(\d+(?:[.,]\d+)?)\s*[xX*]\s*)?(\d+(?:[.,]\d+)?)\s*(kgs?|gms?|grams?|g|ltrs?|litres?|liters?|l|mls?|millilitres?)\b\.?/i,
  DATE: /(?:\d{1,2}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{2,4})|(?:\d{1,2}\s*[-/.]\s*\d{4})|(?:\d{4}\s*[-/.]\s*\d{1,2})|(?:\d{1,2}\s*[-/. ]?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[-/. ]?\s*\d{2,4})|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[-/. ]?\s*\d{2,4})|(?:\d{1,2}\s*[-/.]\s*\d{1,2}\b)/i,
  RELATIVE_PERIOD: /(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(month|year|day)s?\b/i,
  GSTIN: /\b(\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]{3})\b/,
  FSSAI: /\b(\d{14})\b/,
  PHONE: /(?:\+91[\s-]?)?(?:[6-9]\d{9}|0\d{2,4}[\s-]?\d{6,8}|1\d{3}[\s-]?\d{3}[\s-]?\d{3,4})/,
  EMAIL: /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/,
  BATCH: /^[A-Za-z0-9][A-Za-z0-9./+-]{2,}$/,
  BARCODE: /^(?:\d{8}|\d{13})$/,
  PINCODE: /\b(\d{6})\b/,
};

/** Evidence weights: how strongly each signal type proves the field identity. */
const W = { LABELED: 1.0, NEXT_LINE: 0.9, GRAMMAR: 0.8, BLOCK: 0.85, CONTEXT: 0.7, POSITIONAL: 0.6 };
/** Below this, extraction stays silent — the inspector fills the field. */
const MIN_FIELD_CONFIDENCE = 0.55;

const clean = (s) => s.replace(/\s+/g, ' ').trim();
const strip = (s) => s.replace(/^[:.;#\-–—\s]+|[:;\s]+$/g, '').trim();

/**
 * Split a value-dense OCR line into its constituent declarations.
 * Real labels often print several declarations on one visual line
 * (":100g Rs.29-00 Nett Weight Maximum Retail Price FEB2014"). Splits ONLY
 * on strong boundaries — currency amounts and known label phrases — and only
 * when ≥2 boundaries exist, so ordinary lines pass through untouched.
 */
const SPLIT_LABEL_RE = /(?:₹\s*\d|₨\s*\d|rs\.?\s*\d|inr\.?\s*\d|max(?:imum)?\s*retail\s*price|m\.?r\.?p\.?|nett?\s*(?:wt\.?|weight|qty\.?|quantity)|net\s*(?:wt\.?|weight|qty\.?|quantity)|batch\s*no\.?|lot\s*no\.?|mfd\b|pkd\b|best\s*before|use\s*before|manufacturing\s*date|expiry\b|exp\b)/gi;
function splitDeclarations(text) {
  const t = clean(text);
  if (t.length < 18 || t.length > 120) return [t];
  SPLIT_LABEL_RE.lastIndex = 0;
  const points = [];
  let m;
  while ((m = SPLIT_LABEL_RE.exec(t))) if (m.index > 0) points.push(m.index);
  const uniq = [...new Set(points)].sort((a, b) => a - b);
  if (uniq.length < 2) return [t];
  const segs = [];
  let prev = 0;
  for (const p of uniq) {
    const s = strip(t.slice(prev, p)).replace(/^[^\p{L}\d₹]+/u, '');
    if (s) segs.push(s);
    prev = p;
  }
  const tail = strip(t.slice(prev)).replace(/^[^\p{L}\d₹]+/u, '');
  if (tail) segs.push(tail);
  return segs.length > 1 ? segs : [t];
}

/**
 * Classify a line's leading label. Deliberately ordered: the manufacturer
 * "… by" forms are tested before the date labels (MFD/PKD alone are DATES,
 * "Mfd. by" is a manufacturer), and specific labels are tested before
 * generic ones (BATCH before NET_QTY, GSTIN before the rest).
 */
function classifyLabel(text) {
  const t = clean(text);
  if (!t) return null;
  // Manufacturer / packer / marketer / importer — requires the trailing "by"
  // (or a bare "Manufacturer:" heading) so MFD/PKD date labels never collide.
  if (/\b(?:manufactured?|mfd\.?|mfg\.?|mkd\.?|marketed|imported|distributed|packed?|pkd\.?)\s*(?:&|and)?\s*(?:packed?\s*)?by\b/i.test(t)
    || /^manufacturer(?:'s)?\s*(?:name)?\s*[:.]?/i.test(t)
    || /^packer\s*[:.]?/i.test(t)) return 'MFR_BY';
  for (const key of ['GSTIN', 'FSSAI', 'MRP', 'BATCH', 'NET_QTY', 'ORIGIN', 'CONSUMER', 'BARCODE', 'BRAND', 'PRODUCT']) {
    if (LABEL_RES[key].test(t)) return key;
  }
  // Manufacturing / packing date labels (after the "… by" rule above)
  if (/\b(?:mfd\.?|mfg\.?|mfgd\.?|manufactured?(?:\s*on)?|manufacturing(?:\s*date)?|packing(?:\s*date)?|packed?(?:\s*on)?|pkd\.?|date\s*of\s*(?:mfg|mfd|packing|manufacture))\b/i.test(t)) return 'MFG';
  // Expiry / best before — including relative declarations
  if (/\b(?:exp\.?|expiry(?:\s*date)?|use\s*before|use\s*by|best\s*before)\b/i.test(t)) return 'EXP';
  return null;
}

/** Label-vocabulary tokens (normalized) — used to strip the label phrase
    ("Net Wt.", "Batch No.", "Use Before", "FSSAI Lic. No.", …) from a line,
    leaving only the value. Tokens are stripped ONLY from the line start and
    only while they remain label words, so values are never eaten. */
const LABEL_TOKENS = new Set([
  'm', 'r', 'p', 'mrp', 'max', 'maximum', 'retail', 'price', 'net', 'qty', 'wt', 'weight',
  'quantity', 'contents', 'batch', 'lot', 'no', 'number', 'b', 'gstin', 'gst', 'regd', 'reg',
  'registration', 'fssai', 'lic', 'license', 'licence', 'mfd', 'mfg', 'mfgd', 'mkd',
  'manufactured', 'manufacture', 'manufacturing', 'packing', 'packed', 'pkd', 'mfr', 'packer',
  'exp', 'expiry', 'best', 'before', 'use', 'by', 'on', 'date', 'country', 'of', 'origin',
  'made', 'in', 'product', 'name', 'brand', 'consumer', 'care', 'customer', 'toll', 'free',
  'helpline', 'contact', 'phone', 'tel', 'email', 'e', 'mail', 'feedback', 'complaints',
  'complaint', 'for', 's', 'kg', 'g', 'ml', 'l', 'nett', 'bno',
]);
const normToken = (w) => w.toLowerCase().replace(/[^a-z]/g, '');

/** Split "Label: value" / "Label value" / "Label - value" — returns the remainder.
    An explicit separator ( : ; - ) wins; otherwise leading label tokens are
    stripped ("Batch No. AB1234" → "AB1234", "Net Wt. 250 g" → "250 g"). */
function remainderAfterLabel(text) {
  const t = clean(text);
  const sepIdx = t.slice(0, 46).search(/[:;\-–—]/);
  if (sepIdx >= 0) return strip(t.slice(sepIdx + 1));
  const words = t.split(' ');
  let i = 0;
  // A token containing digits ("100g", "250ml") is a VALUE, never label text —
  // stop stripping there so leading values are never eaten.
  while (i < words.length - 1 && !/\d/.test(words[i]) && LABEL_TOKENS.has(normToken(words[i]))) i++;
  return strip(words.slice(i).join(' '));
}

/** Extract a typed value from free text; null when the text is not that type.
    `labeled` relaxes MRP to accept a bare number (value sits under an MRP label). */
function valueOf(kind, text, labeled = false) {
  const t = clean(text);
  if (!t) return null;
  switch (kind) {
    case 'MRP': {
      // "Rs.29-00" dash-decimal — normalize to dotted form FIRST, else the
      // currency alternative stops at "29" and the paise are lost.
      const t2 = t.replace(/(\d)\s*[-\u2013]\s*(\d{2})\b/g, '$1.$2');
      const hadDash = t2 !== t;
      const m = VALUE_RES.MRP.exec(t2);
      if (m) return m[3] || m[4] ? `₹ ${m[3] || m[4]}` : `₹ ${m[1]}.${m[2]}`;
      if ((labeled || hadDash) && /^\d{2,6}(?:[.,]\d{1,2})?$/.test(t2)) return `₹ ${t2.replace(',', '.')}`;
      return null;
    }
    case 'NET_QTY': {
      const m = VALUE_RES.NET_QTY.exec(t);
      if (!m) return null;
      const unit = { kg: 'kg', kgs: 'kg', g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g', l: 'l', ltr: 'l', ltrs: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l', ml: 'ml', mls: 'ml', millilitre: 'ml', millilitres: 'ml' }[m[3].toLowerCase()];
      return m[1] ? `${m[1]} x ${m[2]} ${unit}` : `${m[2]} ${unit}`;
    }
    case 'DATE': {
      const m = VALUE_RES.DATE.exec(t);
      return m ? clean(m[0]) : null;
    }
    case 'GSTIN': { const m = VALUE_RES.GSTIN.exec(t.replace(/\s/g, '')); return m ? m[1] : null; }
    case 'FSSAI': { const m = VALUE_RES.FSSAI.exec(t.replace(/[\s-]/g, '')); return m ? m[1] : null; }
    case 'PHONE': { const m = VALUE_RES.PHONE.exec(t); return m ? clean(m[0]) : null; }
    case 'EMAIL': { const m = VALUE_RES.EMAIL.exec(t); return m ? m[1] : null; }
    case 'BATCH': {
      if (/^(?:batch|lot|b)?\.?\s*no\.?$/i.test(t)) return null; // a bare "Lot No." label, not a value
      if (/^\d+[.,]\d{2}$/.test(t)) return null; // decimal amounts are prices, not batch codes
      return VALUE_RES.BATCH.test(t) ? t : null;
 }
    case 'BARCODE': { return VALUE_RES.BARCODE.test(t.replace(/\s/g, '')) ? t.replace(/\s/g, '') : null; }
    default:
      return null;
  }
}

/** True when the line is ONLY a value (no words that could be a name/label).
    Comparisons are space-insensitive ("200g" → "200 g" normalize equal).
    NOTE: a bare pincode is deliberately NOT "value-only" — it is far more
    likely an address fragment than a declaration, and treating it as a value
    truncated real manufacturer addresses. */
function isValueOnlyLine(text) {
  const t = clean(text);
  if (!t || t.length > 40) return false;
  const flat = t.replace(/\s/g, '').toLowerCase();
  const eq = (v) => v && v.replace(/[₹\s]/g, '').toLowerCase() === flat;
  return Boolean(
    eq(valueOf('MRP', t)) || eq(valueOf('NET_QTY', t)) || eq(valueOf('DATE', t))
    || valueOf('GSTIN', t) || valueOf('FSSAI', t) || eq(valueOf('PHONE', t))
    || eq(valueOf('EMAIL', t)) || valueOf('BARCODE', t)
  );
}

/** Heuristic: does this line look like a postal-address fragment? */
function isAddressish(text) {
  const t = clean(text);
  if (!t || t.length > 90) return false;
  if (isValueOnlyLine(t) || classifyLabel(t)) return false;
  return /\b(?:plot|survey|street|st\.?|road|rd\.?|sector|phase|area|nagar|village|po\b|post|dist(?:rict)?\.?|taluk|tehsil|block|state|pin\s*code|pincode|india)\b/i.test(t)
    || VALUE_RES.PINCODE.test(t)
    || (t.includes(',') && /\d/.test(t));
}

/** Company-keyword test — the strong signal a line is a firm name. */
const COMPANY_KEYWORD = /\b(?:pvt\.?|private|ltd\.?|limited|llp|industries|enterprises|foods?|products?|packers?|traders?|agro|dairy|beverages?|pharma|chemicals?|cosmetics?|company|corp(?:oration)?|firm|mills?|organics?)\b/i;

/** Heuristic: does this line look like a company/manufacturer name?
    strict=true requires the company keyword — used when scanning label-less
    regions, where otherwise headings like "Nutrient Values" (TitleCase)
    masquerade as firm names and produce hallucinated manufacturers. */
function isCompanyish(text, strict = false) {
  const t = clean(text);
  if (!t || t.length > 70) return false;
  if (isValueOnlyLine(t) || classifyLabel(t)) return false;
  if (/[:;]/.test(t)) return false; // "Each 100gm Contains:"-style headings
  if (COMPANY_KEYWORD.test(t)) return true;
  if (strict) return false;
  return /^[A-Z][A-Za-z&.' ]{3,}$/.test(t);
}

const bboxOf = (words) => {
  const boxes = words.map((w) => w.bbox).filter(Boolean);
  if (boxes.length === 0) return null;
  const x0 = Math.min(...boxes.map((b) => b.x0));
  const y0 = Math.min(...boxes.map((b) => b.y0));
  const x1 = Math.max(...boxes.map((b) => b.x1));
  const y1 = Math.max(...boxes.map((b) => b.y1));
  return { x0, y0, x1, y1 };
};

/** Join words into lines using vertical proximity. (Exported for tests.) */
export function toLines(words, medianHeight) {
  const sorted = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const lines = [];
  let current = [];
  for (const word of sorted) {
    if (
      current.length === 0 ||
      Math.abs(word.bbox.y0 - current[current.length - 1].bbox.y0) <= medianHeight * 0.6
    ) {
      current.push(word);
    } else {
      lines.push(current);
      current = [word];
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.map((lineWords) => ({
    text: lineWords.map((w) => w.text).join(' '),
    confidence: lineWords.reduce((s, w) => s + (w.confidence || 0), 0) / lineWords.length,
    bbox: bboxOf(lineWords),
    words: lineWords,
  }));
}

const normalizeBBox = (bbox, imageWidth, imageHeight) =>
  bbox
    ? {
        x: bbox.x0 / imageWidth,
        y: bbox.y0 / imageHeight,
        w: (bbox.x1 - bbox.x0) / imageWidth,
        h: (bbox.y1 - bbox.y0) / imageHeight,
      }
    : null;

/**
 * Map OCR lines → declaration contract fields (post-OCR stage only).
 *
 * Three passes over the SAME OCR response:
 *   1. LABEL pass  — a line whose leading label matches the synonym
 *      dictionary yields its value from the same line (after the label) or
 *      from the following lines until the next declaration begins.
 *   2. GRAMMAR pass — distinctive value grammars found on label-less lines
 *      (₹ amounts, quantities, GSTIN, 14-digit FSSAI, value-only dates).
 *   3. CONTEXT pass — manufacturer name+address assembled from multi-line
 *      blocks; product name / brand inferred from positional prominence
 *      (box height + vertical position), never from an expected label.
 *
 * Every field carries confidence = (OCR confidence) × (evidence weight);
 * below MIN_FIELD_CONFIDENCE the field is left BLANK — the inspector's
 * editable form stays the source of truth (no hallucinated values).
 */
export function mapLinesToFields(lines, imageWidth, imageHeight) {
  const fields = [];
  const have = (key) => fields.some((f) => f.key === key);
  const push = (key, label, value, conf100, weight, bbox) => {
    if (!value) return;
    const c = Math.min(1, (conf100 / 100) * weight);
    if (c < MIN_FIELD_CONFIDENCE) return; // preserve uncertainty — inspector fills manually
    fields.push({ key, label, value, confidence: c, bbox: normalizeBBox(bbox, imageWidth, imageHeight) });
  };

  const norm0 = lines.map((l) => ({ ...l, text: clean(l.text) })).filter((l) => l.text);
  // Multi-declaration lines are decomposed so each declaration can classify
  // independently (e.g. "…100g Rs.29-00 Nett Weight Maximum Retail Price…").
  const norm = [];
  for (const l of norm0) {
    for (const seg of splitDeclarations(l.text)) norm.push({ ...l, text: seg });
  }
  const taken = new Set(); // line indexes consumed by block extraction

  /** Value of `kind` on the next 1–4 lines after `i` (stops at next label).
      Labeled lookup context: relaxations (bare MRP number) allowed. */
  const nextValue = (i, kind) => {
    for (let j = i + 1; j < Math.min(i + 5, norm.length); j++) {
      if (taken.has(j)) return null;
      const v = valueOf(kind, norm[j].text, true);
      if (v) return { value: v, conf: norm[j].confidence, bbox: norm[j].bbox };
      if (classifyLabel(norm[j].text)) return null;
    }
    return null;
  };

  /** Value of `kind` around a label: forward first, then backward up to 3
      lines/segments. Backward handles the real-world column layout where the
      value is PRINTED ABOVE its label ("FEB2014" over "Manufacturing Date",
      ":100g … Nett Weight") — never hallucinated, only relocated. Unrelated
      labels are SKIPPED (columnar rows interleave value, label, label, value),
      but a label of the SAME family stops the scan so an MRP never crosses
      into expiry-date territory. */
  const RELATED = { MRP: ['MRP', 'OTHER_PRICE'], NET_QTY: ['NET_QTY'], DATE: ['MFG', 'EXP'], BATCH: ['BATCH'], BARCODE: ['BARCODE'], GSTIN: ['GSTIN'], FSSAI: ['FSSAI'] };
  const valueAround = (i, kind) => {
    const fwd = nextValue(i, kind);
    if (fwd) return fwd;
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      if (taken.has(j)) return null;
      const lbl = classifyLabel(norm[j].text);
      if (lbl) { if ((RELATED[kind] || [kind]).includes(lbl)) return null; continue; }
      const v = valueOf(kind, norm[j].text, true);
      if (v) {
        // Dates: only accept when the value sits on a token boundary at the
        // segment END ("… Price FEB2014" ✓) — never a date-shaped fragment
        // INSIDE a code ("TRI-74/98" must not yield "74/98").
        if (kind === 'DATE') {
          const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (!new RegExp(`(?:^|\\s)${esc}$`).test(norm[j].text.trim())) continue;
        }
        return { value: v, conf: norm[j].confidence, bbox: norm[j].bbox, srcText: norm[j].text };
      }
    }
    return null;
  };

  /** A price that is explicitly NOT the MRP (selling/unit/offer price) must
      never feed the MRP field. */
  const isOtherPrice = (text) => LABEL_RES.OTHER_PRICE.test(text);

  /* ---------- Pass 1: labeled lines ---------- */
  const mfgBlock = { fromLabel: false, nextIdx: -1, name: null, nameConf: 0, nameBbox: null, nameWeight: W.LABELED, address: null, addressConf: 0, addressBbox: null, bbox: null };
  const consumerBlock = { labelIdxs: [], bbox: null, conf: 0 };
  let relativeBestBefore = null;
  const dateOnly = [];

  norm.forEach((line, i) => {
    const label = classifyLabel(line.text);
    if (!label) return;
    const rest = remainderAfterLabel(line.text);

    switch (label) {
      case 'MFR_BY': {
        if (mfgBlock.nextIdx >= 0) break; // first manufacturer block wins
        mfgBlock.fromLabel = true;
        mfgBlock.nextIdx = i;
        mfgBlock.bbox = line.bbox;
        mfgBlock.conf = line.confidence;
        // "Manufactured & Packed by ABC Foods Pvt Ltd …" — name follows "by"
        const afterBy = /\bby\b\s*(.+)$/i.exec(line.text)?.[1];
        const nameSource = afterBy ? strip(clean(afterBy)) : strip(rest || '');
        if (nameSource && isCompanyish(nameSource)) {
          mfgBlock.name = nameSource;
          mfgBlock.nameConf = line.confidence;
          mfgBlock.nameBbox = line.bbox;
        }
        break;
      }
      case 'PRODUCT': {
        if (rest && !have('PRODUCT_NAME')) push('PRODUCT_NAME', 'Product Name', rest.slice(0, 42), line.confidence, W.LABELED, line.bbox);
        break;
      }
      case 'BRAND': {
        if (rest && !have('BRAND')) push('BRAND', 'Brand Name', rest.slice(0, 30), line.confidence, W.LABELED, line.bbox);
        break;
      }
      case 'MRP': {
        if (have('MRP')) break;
        const restV = rest && !isOtherPrice(rest) ? valueOf('MRP', rest, true) : null;
        // Columnar packs print the price to the LEFT of / above the label
        // (":100g Rs.29-00 | Nett Weight | Maximum Retail Price") — look
        // backward too; other-price lines are guarded out.
        const backV = valueAround(i, 'MRP');
        const v = restV || (backV && !isOtherPrice(backV.srcText) ? backV.value : null);
        if (v) push('MRP', 'MRP', v, line.confidence, W.LABELED, line.bbox);
        break;
      }
      case 'NET_QTY': {
        if (have('NET_QUANTITY')) break;
        const back = valueAround(i, 'NET_QTY');
        const v = (rest && valueOf('NET_QTY', rest)) || nextValue(i, 'NET_QTY')?.value || back?.value;
        if (v) push('NET_QUANTITY', 'Net Quantity', v, line.confidence, W.LABELED, line.bbox);
        break;
      }
      case 'BATCH': {
        if (have('BATCH')) break;
        const v = (rest && valueOf('BATCH', rest)) || nextValue(i, 'BATCH')?.value;
        if (v) push('BATCH', 'Batch / Lot No.', v, line.confidence, W.LABELED, line.bbox);
        break;
      }
      case 'GSTIN': {
        if (have('GSTIN')) break;
        const v = (rest && valueOf('GSTIN', rest)) || nextValue(i, 'GSTIN')?.value;
        if (v) push('GSTIN', 'GSTIN', v, line.confidence, W.LABELED, line.bbox);
        break;
      }
      case 'FSSAI': {
        if (have('FSSAI')) break;
        const v = (rest && valueOf('FSSAI', rest)) || nextValue(i, 'FSSAI')?.value;
        if (v) push('FSSAI', 'FSSAI License No.', v, line.confidence, W.LABELED, line.bbox);
        break;
      }
      case 'ORIGIN': {
        if (have('COUNTRY_ORIGIN')) break;
        const v = rest && !classifyLabel(rest) && rest.length <= 40 ? strip(rest) : nextValue(i, 'TEXT')?.value;
        if (v) push('COUNTRY_ORIGIN', 'Country of Origin', v, line.confidence, W.LABELED, line.bbox);
        break;
      }
      case 'MFG': {
        if (have('MFG_DATE')) break;
        const back = valueAround(i, 'DATE');
        const v = (rest && valueOf('DATE', rest)) || nextValue(i, 'DATE')?.value || back?.value;
        if (v) push('MFG_DATE', 'MFG Date', v, line.confidence, W.LABELED, line.bbox);
        break;
      }
      case 'EXP': {
        if (have('BEST_BEFORE')) break;
        // Relative declarations ("Best Before 9 Months From Packaging") are
        // preserved AS DECLARATIONS — never converted into an invented date.
        if (VALUE_RES.RELATIVE_PERIOD.test(rest) || VALUE_RES.RELATIVE_PERIOD.test(norm[i + 1]?.text || '')) {
          relativeBestBefore = { value: clean(line.text).slice(0, 60), conf: line.confidence, bbox: line.bbox };
          break;
        }
        const v = (rest && valueOf('DATE', rest)) || nextValue(i, 'DATE')?.value;
        if (v) push('BEST_BEFORE', 'Expiry / Best Before', v, line.confidence, W.LABELED, line.bbox);
        else if (!relativeBestBefore) relativeBestBefore = { value: clean(line.text).slice(0, 60), conf: line.confidence * 0.8, bbox: line.bbox };
        break;
      }
      case 'CONSUMER': {
        consumerBlock.labelIdxs.push(i);
        consumerBlock.bbox = consumerBlock.bbox || line.bbox;
        consumerBlock.conf = consumerBlock.conf || line.confidence;
        break;
      }
      case 'BARCODE': {
        if (have('BARCODE')) break;
        const v = (rest && valueOf('BARCODE', rest)) || nextValue(i, 'BARCODE')?.value;
        if (v) push('BARCODE', 'Barcode', v, line.confidence, W.LABELED, line.bbox);
        break;
      }
      default:
        break;
    }
  });

  /* ---------- Pass 2: distinctive grammars on label-less lines ---------- */
  norm.forEach((line, i) => {
    if (classifyLabel(line.text)) return;
    const t = line.text;
    if (!have('GSTIN')) { const v = valueOf('GSTIN', t); if (v) { push('GSTIN', 'GSTIN', v, line.confidence, W.GRAMMAR, line.bbox); return; } }
    if (!have('FSSAI')) { const v = valueOf('FSSAI', t); if (v) { push('FSSAI', 'FSSAI License No.', v, line.confidence, W.GRAMMAR, line.bbox); return; } }
    if (isValueOnlyLine(t)) {
      if (!have('MRP') && valueOf('MRP', t) && !isOtherPrice(t)) { push('MRP', 'MRP', valueOf('MRP', t), line.confidence, W.GRAMMAR, line.bbox); return; }
      if (!have('NET_QUANTITY') && t.length <= 24 && valueOf('NET_QTY', t)) { push('NET_QUANTITY', 'Net Quantity', valueOf('NET_QTY', t), line.confidence, W.GRAMMAR, line.bbox); return; }
      if (!have('BARCODE') && valueOf('BARCODE', t)) { push('BARCODE', 'Barcode', valueOf('BARCODE', t), line.confidence, W.GRAMMAR, line.bbox); return; }
      if (valueOf('DATE', t) === t && !mfgBlock?.name && !isAddressish(t) && !isOtherPrice(t)) dateOnly.push({ i, value: t, conf: line.confidence, bbox: line.bbox });
    } else {
      // A price stranded by a multi-declaration line split ("Rs.29-00" in a
      // columnar pack) still IS the MRP: distinct currency grammar (₹/Rs./
      // slash), guarded against selling/unit-price lines. A leading quantity
      // token ("100g Rs.29-00") is stripped first; never a bare number.
      if (!have('MRP') && !isOtherPrice(t) && !isAddressish(t) && !isCompanyish(t) && /(?:₹|₨|\brs\.?|\binr\.?|\/)/i.test(t)) {
        // Strip an optional leading quantity token (":100g ", "200g ") — the
        // pack weight often shares the split segment with the price.
        const t2 = t.replace(/^[^\d]*\d+(?:[.,]\d+)?\s*[a-zA-Z]{1,4}\.?\s*/, '');
        const pv = valueOf('MRP', t2);
        if (pv && t2.replace(/[^0-9]/g, '').length === pv.replace(/[^0-9]/g, '').length) {
          push('MRP', 'MRP', pv, line.confidence, W.GRAMMAR, line.bbox);
          return;
        }
      }
      // OCR often appends junk to a printed date ("06/05/2021 REDATE") —
      // accept a short line that STARTS with a full date and has ≤6 junk chars.
      const dm = /^\s*(\d{1,2}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{2,4}|\d{2,4}\s*[-/.]\s*\d{1,2})\b/.exec(t);
      if (dm && t.length - dm[1].length <= 8 && !mfgBlock?.name && !isAddressish(t) && !classifyLabel(t) && !isOtherPrice(t)) {
        dateOnly.push({ i, value: clean(dm[1]), conf: line.confidence, bbox: line.bbox });
      }
    }
  });

  // Unlabeled date-only lines: two → MFG + EXP in reading order; one → fill
  // whichever of the two is missing; ambiguous with both missing → skip.
  if (dateOnly.length && (!have('MFG_DATE') || !have('BEST_BEFORE')) && !relativeBestBefore) {
    if (!have('MFG_DATE') && !have('BEST_BEFORE') && dateOnly.length >= 2) {
      push('MFG_DATE', 'MFG Date', dateOnly[0].value, dateOnly[0].conf, W.GRAMMAR, dateOnly[0].bbox);
      push('BEST_BEFORE', 'Expiry / Best Before', dateOnly[1].value, dateOnly[1].conf, W.GRAMMAR * 0.9, dateOnly[1].bbox);
    } else if (!have('MFG_DATE') && dateOnly[0]) {
      push('MFG_DATE', 'MFG Date', dateOnly[0].value, dateOnly[0].conf, W.GRAMMAR, dateOnly[0].bbox);
    } else if (!have('BEST_BEFORE') && dateOnly[0]) {
      push('BEST_BEFORE', 'Expiry / Best Before', dateOnly[0].value, dateOnly[0].conf, W.GRAMMAR, dateOnly[0].bbox);
    }
  }

  /* ---------- Pass 3: contextual blocks + positional inference ---------- */

  // Manufacturer name + address from the lines following the label/anchor.
  if (mfgBlock.nextIdx >= 0) {
    const parts = [];
    for (let j = mfgBlock.nextIdx + 1; j < Math.min(mfgBlock.nextIdx + 5, norm.length); j++) {
      const l = norm[j];
      if (classifyLabel(l.text)) break;
      if (!mfgBlock.name && isCompanyish(l.text)) {
        mfgBlock.name = clean(l.text);
        mfgBlock.nameConf = l.confidence;
        mfgBlock.nameBbox = l.bbox;
        mfgBlock.nameWeight = W.NEXT_LINE;
        taken.add(j);
        continue;
      }
      if (isAddressish(l.text) && parts.length < 2) { parts.push(clean(l.text)); taken.add(j); continue; }
      break; // unknown content — never swallow the next declaration
    }
    if (parts.length) {
      mfgBlock.address = parts.join(', ').slice(0, 120);
      mfgBlock.addressConf = mfgBlock.conf;
      mfgBlock.addressBbox = mfgBlock.bbox;
    }
  } else {
    // No label at all: a company-name line directly followed by address
    // lines is still a manufacturer block (contextual, weighted lower).
    for (let i = 0; i < norm.length - 1; i++) {
      if (classifyLabel(norm[i].text) || isValueOnlyLine(norm[i].text)) continue;
      if (isCompanyish(norm[i].text, true) && isAddressish(norm[i + 1]?.text || '')) {
        const parts = [clean(norm[i + 1].text)];
        taken.add(i);
        taken.add(i + 1);
        for (let j = i + 2; j < Math.min(i + 4, norm.length) && isAddressish(norm[j].text) && parts.length < 2; j++) { parts.push(clean(norm[j].text)); taken.add(j); }
        mfgBlock.fromLabel = false;
        mfgBlock.nextIdx = i;
        mfgBlock.name = clean(norm[i].text);
        mfgBlock.nameConf = norm[i].confidence;
        mfgBlock.nameBbox = norm[i].bbox;
        mfgBlock.nameWeight = W.BLOCK;
        mfgBlock.address = parts.join(', ').slice(0, 120);
        mfgBlock.addressConf = norm[i + 1].confidence;
        mfgBlock.addressBbox = norm[i + 1].bbox;
        break;
      }
    }
  }
  if (mfgBlock.name) push('MANUFACTURER', 'Manufacturer / Packer', mfgBlock.name, mfgBlock.nameConf, mfgBlock.nameWeight, mfgBlock.nameBbox || mfgBlock.bbox);
  if (mfgBlock.address) push('MANUFACTURER_ADDRESS', 'Manufacturer Address', mfgBlock.address, mfgBlock.addressConf, W.BLOCK, mfgBlock.addressBbox || mfgBlock.bbox);

  // Consumer-care block: phone / e-mail / address from label rests + the
  // lines following the LAST consumer-care label.
  if (consumerBlock.labelIdxs.length) {
    const first = consumerBlock.labelIdxs[0];
    const scan = [];
    // Rests of every consumer-care label line ("Consumer Care: …",
    // "Toll Free 1800-…", "Email care@x.in" …).
    for (const li of consumerBlock.labelIdxs) {
      const rest = remainderAfterLabel(norm[li].text);
      // full kept: the dash-separator rule in remainderAfterLabel can split a
      // phone number ("Toll Free 1800-266-0123" → rest "266-0123"), so the
      // whole line is retried before giving up on phone/e-mail.
      if (rest) scan.push({ text: rest, full: norm[li].text, conf: norm[li].confidence, bbox: norm[li].bbox });
    }
    // Lines AFTER THE FIRST consumer label until a non-consumer label —
    // contact details often sit between "Consumer Care:" and "Toll Free …".
    for (let j = first + 1; j < Math.min(first + 6, norm.length); j++) {
      const lbl = classifyLabel(norm[j].text);
      if (lbl && lbl !== 'CONSUMER') break;
      if (consumerBlock.labelIdxs.includes(j)) continue;
      scan.push({ text: norm[j].text, conf: norm[j].confidence, bbox: norm[j].bbox });
      taken.add(j);
    }
    let phone = null, email = null;
    const addrParts = [];
    for (const s of scan) {
      if (!email && (valueOf('EMAIL', s.text) || valueOf('EMAIL', s.full || ''))) email = valueOf('EMAIL', s.text) || valueOf('EMAIL', s.full || '');
      else if (!phone && (valueOf('PHONE', s.text) || valueOf('PHONE', s.full || ''))) phone = valueOf('PHONE', s.text) || valueOf('PHONE', s.full || '');
      else if (addrParts.length < 2 && isAddressish(s.text)) addrParts.push(clean(s.text));
    }
    if (phone) push('CONSUMER_CARE_PHONE', 'Consumer Care Phone', phone, consumerBlock.conf, W.BLOCK, consumerBlock.bbox);
    if (email) push('CONSUMER_CARE_EMAIL', 'Consumer Care Email', email, consumerBlock.conf, W.BLOCK, consumerBlock.bbox);
    if (addrParts.length) push('CONSUMER_CARE_ADDRESS', 'Consumer Care Address', addrParts.join(', ').slice(0, 120), consumerBlock.conf, W.BLOCK, consumerBlock.bbox);
  }

  // Unlabeled contact fallback — real packs print the consumer number without
  // any label ("…call us at: 0124-4577000"). Taken only with contact-ish
  // context ON the line (never a bare number alone); W.CONTEXT keeps garbled
  // lines below the confidence gate → honest blank, not a guess.
  if (!have('CONSUMER_CARE_PHONE')) {
    for (const l of norm) {
      if (classifyLabel(l.text) || isValueOnlyLine(l.text)) continue;
      if (!/\b(?:call|contact|toll|free|helpline|phone|write|reach|us\s*at|e-?mail)\b/i.test(l.text)) continue;
      const ph = valueOf('PHONE', l.text);
      if (ph) { push('CONSUMER_CARE_PHONE', 'Consumer Care Phone', ph, l.confidence, W.CONTEXT, l.bbox); break; }
    }
  }

  // Product name / brand — positional prominence (font box height + height
  // of position on the label). Labels, values, addresses and known blocks
  // are excluded; no "Product Name:" label is expected.
  if (!have('PRODUCT_NAME') || !have('BRAND')) {
    const maxH = Math.max(...norm.map((l) => (l.bbox ? l.bbox.y1 - l.bbox.y0 : 0)), 1);
    const excluded = /ingredients?|nutrition|nutrient|allergen|storage|direction|usage|warning|caution|licence|license|perm\b|mrp|net\s|batch|lot\b|gstin|fssai|customer|consumer/i;
    const candidates = norm
      .filter((l) => {
        if (!l.bbox || taken.has(norm.indexOf(l))) return false;
        if (classifyLabel(l.text)) return false;
        if (isValueOnlyLine(l.text) || isAddressish(l.text)) return false;
        if (/[:;]$/.test(l.text) || /,\s*$/.test(l.text) || excluded.test(l.text)) return false; // trailing comma = ingredient/list fragment
        if (/\d/.test(l.text)) return false; // "TRI-74/98", "FEB2014" — codes/dates, not names
        if (/^[A-Z0-9 &.-]+$/.test(l.text)) return false; // ALLCAPS stamps/blocks
        const words = l.text.split(' ');
        return l.text.replace(/[^A-Za-z]/g, '').length >= 3 && words.length <= 6 && l.text.length <= 42;
      })
      .map((l) => {
        const h = (l.bbox.y1 - l.bbox.y0) / maxH;
        const y = l.bbox.y0 / imageHeight;
        const prominence = 0.6 * Math.min(1, h) + 0.4 * Math.max(0, 1 - y * 1.8);
        return { line: l, score: prominence * 0.6 + (l.confidence / 100) * 0.4, single: l.text.split(' ').length === 1 };
      })
      .sort((a, b) => b.score - a.score);
    const top = candidates[0];
    const second = candidates.find((c) => c !== top && c.line.text !== top?.line.text);
    if (top && !have('BRAND') && top.single) push('BRAND', 'Brand Name', top.line.text.slice(0, 30), top.line.confidence, W.POSITIONAL, top.line.bbox);
    else if (top && !have('PRODUCT_NAME')) push('PRODUCT_NAME', 'Product Name', top.line.text.slice(0, 42), top.line.confidence, W.POSITIONAL, top.line.bbox);
    if (second && !have('PRODUCT_NAME')) push('PRODUCT_NAME', 'Product Name', second.line.text.slice(0, 42), second.line.confidence, W.POSITIONAL, second.line.bbox);
    else if (second && !have('BRAND') && !top?.single) push('BRAND', 'Brand Name', second.line.text.split(' ')[0].slice(0, 30), second.line.confidence, W.POSITIONAL * 0.9, second.line.bbox);
  }

  // Relative best-before declaration preserved verbatim (never a fake date).
  if (relativeBestBefore && !have('BEST_BEFORE')) {
    push('BEST_BEFORE', 'Expiry / Best Before', relativeBestBefore.value, relativeBestBefore.conf, W.LABELED, relativeBestBefore.bbox);
  }
  // Spelled/numeric relative declarations anywhere ("BEST BEFORE THREE MONTHS
  // FROM MANUFACTURING" split by OCR across tokens) — label the line may omit.
  if (!have('BEST_BEFORE')) {
    const rel = norm.find((l) => /\b(?:best\s*before|use\s*before|use\s*by)\b/i.test(l.text) && VALUE_RES.RELATIVE_PERIOD.test(l.text))
      || norm.find((l) => VALUE_RES.RELATIVE_PERIOD.test(l.text) && /\b(?:from|after)\b/i.test(l.text));
    if (rel) push('BEST_BEFORE', 'Expiry / Best Before', clean(rel.text).slice(0, 60), rel.confidence, W.CONTEXT, rel.bbox);
  }

  return fields;
}

/* ---------- public API ---------- */

export const EXTRACTION_PROVIDER = import.meta.env.VITE_OCR_ENDPOINT ? 'server' : 'tesseract-browser';

/**
 * Analyze a product image.
 * @param {File|string} image File or object URL
 * @param {{ onStage?: (stage: string) => void }} options
 * Stage sequence: uploading → processing → extracting → done
 */
export async function analyze(image, { onStage = () => {} } = {}) {
  // Server provider: POST the image to the configured OCR endpoint
  // (local PaddleOCR service). The payload is adapted into the SAME
  // words/lines/fields contract the browser provider produces — the
  // grouping/extraction heuristics below are shared and untouched.
  if (EXTRACTION_PROVIDER === 'server') {
    onStage('uploading');
    // Accept a File/Blob directly, or resolve an object/data URL to a Blob
    // so the multipart body always carries real image bytes.
    let blob = image;
    if (typeof image === 'string') {
      const res = await fetch(image);
      if (!res.ok) throw new Error('Unsupported or corrupted image file.');
      blob = await res.blob();
    }
    const form = new FormData();
    form.append('image', blob, blob.name || 'product-image.jpg');

    // Bounded request: a hung service must never leave the inspector on the
    // analysis overlay indefinitely (timeout → clean failure → retry).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);

    let payload;
    try {
      const response = await fetch(import.meta.env.VITE_OCR_ENDPOINT, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) {
        let detail = `OCR service error (${response.status})`;
        try {
          const body = await response.json();
          if (body?.detail) detail = body.detail;
        } catch { /* non-JSON error body — keep the status message */ }
        throw new Error(detail);
      }
      payload = await response.json();
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new Error('Analysis timed out — the OCR service did not respond in time.');
      }
      if (err instanceof TypeError) {
        const e = new Error('OCR service is unreachable or blocked. Start it with: cd ocr-service && uvicorn app:app --port 8100');
        e.code = 'SERVICE_UNREACHABLE';
        throw e;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (payload.success === false) {
      throw new Error(payload.detail || 'OCR service could not process this image.');
    }

    onStage('extracting');
    // Standardized OCR result → app contract (same shape as the browser path).
    const imageWidth = payload.image?.width;
    const imageHeight = payload.image?.height;
    const words = (payload.results || [])
      .filter((w) => typeof w?.text === 'string' && w.text.trim().length > 0)
      .map((w) => ({
        text: w.text,
        confidence: typeof w.confidence === 'number' ? w.confidence : 0,
        bbox: w.bbox || null,
      }))
      .filter((w) => w.bbox && w.confidence > 30);
    if (!imageWidth || !imageHeight || words.length === 0) {
      // Honest empty result: nothing recognized → inspector fills the form
      // manually (the workflow must never depend on OCR succeeding).
      onStage('done');
      return {
        imageUrl: typeof image === 'string' ? image : URL.createObjectURL(blob),
        fields: [],
        words: [],
        lines: [],
        provider: payload.provider || 'server',
        rawText: payload.rawText || '',
        meanConfidence: payload.meanConfidence ?? null,
        preprocessing: payload.preprocessing || [],
      };
    }
    const heights = words.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b);
    const medianHeight = heights[Math.floor(heights.length / 2)] || 16;
    const lines = toLines(words, medianHeight);
    const fields = mapLinesToFields(lines, imageWidth, imageHeight);

    onStage('done');
    return {
      imageUrl: typeof image === 'string' ? image : URL.createObjectURL(blob),
      fields,
      words,
      lines,
      provider: payload.provider || 'server',
      rawText: payload.rawText || '',
      meanConfidence: payload.meanConfidence ?? null,
      preprocessing: payload.preprocessing || [],
    };
  }

  // Browser provider: real tesseract.js OCR
  onStage('uploading');
  const source = typeof image === 'string' ? image : URL.createObjectURL(image);
  const dimensions = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Unsupported or corrupted image file.'));
    img.src = source;
  });

  onStage('processing');
  const worker = await getWorker();
  // tesseract.js v7: word-level data (text/confidence/bbox) is only populated
  // when `blocks` is requested in the output options — the legacy flat
  // `data.words` array no longer exists.
  const { data } = await worker.recognize(source, {}, { text: true, blocks: true });

  onStage('extracting');
  // Flatten blocks → paragraphs → lines → words into the flat word shape the
  // grouping heuristics below expect.
  const flatWords = [];
  for (const block of data.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        for (const word of line.words || []) flatWords.push(word);
      }
    }
  }
  const words = flatWords.filter((w) => w.confidence > 30 && (w.text || '').trim().length > 0);
  const heights = words.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 16;
  const lines = toLines(words, medianHeight);
  const fields = mapLinesToFields(lines, dimensions.width, dimensions.height);

  onStage('done');
  return {
    imageUrl: source,
    fields,
    words,
    lines,
    provider: 'tesseract-browser',
    rawText: data.text || '',
    meanConfidence: typeof data.confidence === 'number' ? data.confidence / 100 : null,
  };
}

export const extractionService = { analyze, EXTRACTION_PROVIDER };
