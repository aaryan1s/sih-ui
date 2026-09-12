/**
 * pdfReport — programmatic PDF builder for the inspection report (pdf-lib).
 *
 * Pure module: no browser APIs (tested directly in Node). The government
 * layout, data honesty rules ("Not detected"/"Not provided") and palette are
 * documented in reportsService.js.
 *
 * Future backend swap: the same record contract can feed a server-side
 * generator; only this module would move.
 */

// Palette mirrors the app's design tokens (navy government identity)
const C = {
  navy: [0.031, 0.216, 0.431], // #08376e
  body: [0.102, 0.137, 0.2], // #1a2333
  muted: [0.353, 0.42, 0.51], // #5a6b82
  border: [0.847, 0.878, 0.918], // #d8e0ea
  fill: [0.933, 0.953, 0.976], // #eef3f9
  ok: [0.082, 0.502, 0.239], // #15803d
  bad: [0.725, 0.11, 0.11], // #b91c1c
  warn: [0.706, 0.325, 0.035], // #b45309
  okSoft: [0.925, 0.992, 0.961],
  badSoft: [0.996, 0.949, 0.949],
  warnSoft: [1, 0.984, 0.922],
};

const RESULT_COLOR = {
  ok: C.ok, pass: C.ok, compliant: C.ok,
  bad: C.bad, fail: C.bad, non_compliant: C.bad,
  warn: C.warn, review: C.warn, warning: C.warn, under_review: C.warn,
};
const RESULT_FILL = { ok: C.okSoft, pass: C.okSoft, bad: C.badSoft, fail: C.badSoft, warn: C.warnSoft, review: C.warnSoft };
export const RESULT_GLYPH = { ok: 'PASS', pass: 'PASS', bad: 'FAIL', fail: 'FAIL', warn: 'REVIEW', review: 'REVIEW' };

export const STATUS_LABEL = {
  compliant: 'COMPLIANT',
  non_compliant: 'NON-COMPLIANT',
  warning: 'REQUIRES REVIEW',
  under_review: 'UNDER REVIEW',
};

// Helvetica (WinAnsi) — replace glyphs outside the encoding rather than crash
const ascii = (value) =>
  String(value ?? '')
    .replaceAll('₹', 'Rs. ')
    .replaceAll(/[✓✕⚠→·—–]/g, '-')
    .replaceAll(/[^\x20-\x7E\u00A0-\u00FF\n]/g, '')
    .replaceAll('\t', '  ');

export const notDetected = (value) =>
  value === null || value === undefined || value === '' ? 'Not detected' : String(value);
export const notProvided = (value) =>
  value === null || value === undefined || value === '' || value === '—' ? 'Not provided' : String(value);

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// A4 page geometry (72dpi points) and content margins.
// M.top is sized to clear the letterhead: 40pt top offset + emblem/title band
// (~79pt) + breathing room, so content never collides with the header.
const A4 = { W: 595.28, H: 841.89 };
const M = { top: 126, bottom: 64, x: 48 };
const CONTENT_W = A4.W - M.x * 2;

/**
 * Letterhead composition (drawn identically on EVERY page):
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ [EMBLEM]  GOVERNMENT OF INDIA                │  ← emblem fixed 36pt,
 *   │           Department of Consumer Affairs     │    identity stacked
 *   │           Legal Metrology                    │    beside it
 *   │                                              │
 *   │        INSPECTION & COMPLIANCE REPORT        │  ← clear hierarchy:
 *   │ ════════════════════════════════════════════ │    title on its own band,
 *   │ ──────────────────────────────────────────── │    classic double rule
 *   └──────────────────────────────────────────────┘
 *
 * The emblem is the app's single official public asset, scaled to a constant
 * width on all pages; text never overlaps it (identity block starts 14pt to
 * its right). No fabricated logos.

/**
 * writePdf(inspection, { assets })
 *
 * assets.emblem: PNG bytes of the State Emblem of India (optional but
 * recommended). The caller supplies the bytes — browser callers fetch the
 * app's existing public asset (the same official emblem shown on the landing
 * page); Node tests read it from disk. Without it the header degrades to
 * text-only. No emblem is ever fabricated by this module.
 */
export async function writePdf(inspection, { assets } = {}) {
  const doc = await PDFDocument.create();
  let emblem = null;
  try {
    emblem = assets?.emblem ? await doc.embedPng(assets.emblem) : null;
  } catch {
    emblem = null; // degrade to text-only header, never crash the report
  }

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = (pt) => ({ size: pt, font: regular });
  const width = (text, pt, f) => (f || regular).widthOfTextAtSize(text, pt);

  // ---- state for the multi-page pass --------------------------------
  let page = doc.addPage([A4.W, A4.H]);
  let y = A4.H - M.top;
  const pages = [page];

  const newPage = () => {
    page = doc.addPage([A4.W, A4.H]);
    pages.push(page);
    y = A4.H - M.top;
  };
  const ensure = (needed) => {
    if (y - needed < M.bottom) newPage();
  };

  // ---- shared primitives --------------------------------------------

  /** Government letterhead + footer on EVERY page. Call AFTER content so X of Y is total. */
  const drawPageChrome = () => {
    const headerTop = A4.H - 40; // top edge of the letterhead band

    for (const p of pages) {
      // Emblem: fixed 36pt width on every page (consistent sizing), flush with
      // the left margin, top-aligned with the identity block.
      let identityX = M.x;
      if (emblem) {
        const w = 36;
        const h = (emblem.height / emblem.width) * w;
        p.drawImage(emblem, { x: M.x, y: headerTop - h, width: w, height: h });
        identityX = M.x + w + 14; // 14pt gutter — text can never touch the emblem
      }

      // Identity block: three stacked lines, top-aligned with the emblem.
      p.drawText('GOVERNMENT OF INDIA', { x: identityX, y: headerTop - 11, size: 11, font: bold, color: rgb(...C.navy) });
      p.drawText('Department of Consumer Affairs', { x: identityX, y: headerTop - 25, size: 9.5, font: regular, color: rgb(...C.muted) });
      p.drawText('Legal Metrology', { x: identityX, y: headerTop - 37.5, size: 9.5, font: regular, color: rgb(...C.muted) });

      // Report title: its own centered band below the identity block — clearly
      // distinguishable from (and larger than) the department identity.
      const title = 'INSPECTION & COMPLIANCE REPORT';
      const titleW = width(title, 14.5, bold);
      p.drawText(title, { x: (A4.W - titleW) / 2, y: headerTop - 63, size: 14.5, font: bold, color: rgb(...C.navy) });

      // Divider: classic official double rule — thick navy over thin light.
      p.drawLine({ start: { x: M.x, y: headerTop - 76 }, end: { x: A4.W - M.x, y: headerTop - 76 }, thickness: 1.75, color: rgb(...C.navy) });
      p.drawLine({ start: { x: M.x, y: headerTop - 80.5 }, end: { x: A4.W - M.x, y: headerTop - 80.5 }, thickness: 0.75, color: rgb(...C.border) });

      // Footer
      p.drawLine({ start: { x: M.x, y: 46 }, end: { x: A4.W - M.x, y: 46 }, thickness: 0.75, color: rgb(...C.border) });
      p.drawText('Legal Metrology Compliance System · Department of Consumer Affairs · Government of India', {
        x: M.x, y: 34, size: 7.5, font: regular, color: rgb(...C.muted),
      });
      const pageLabel = `Page ${pages.indexOf(p) + 1} of ${pages.length}`;
      p.drawText(pageLabel, {
        x: A4.W - M.x - width(pageLabel, 7.5), y: 34, size: 7.5, font: regular, color: rgb(...C.muted),
      });
    }
  };

  const text = (str, opts = {}) => {
    const { x = M.x, pt = 9.5, f = regular, color = C.body, gap = 4 } = opts;
    ensure(pt + gap + 2);
    page.drawText(ascii(str), { x, y: y - pt, size: pt, font: f, color: rgb(...color) });
    y -= pt + gap;
  };

  const wrap = (str, maxW, pt, f = regular) => {
    const words = ascii(str).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (width(candidate, pt, f) > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };

  const sectionTitle = (label) => {
    ensure(30);
    y -= 8;
    page.drawText(ascii(label), { x: M.x, y: y - 10.5, size: 10, font: bold, color: rgb(...C.navy) });
    page.drawLine({ start: { x: M.x, y: y - 16 }, end: { x: A4.W - M.x, y: y - 16 }, thickness: 0.75, color: rgb(...C.border) });
    y -= 24;
  };

  /** Label/value grid: 1 or 2 column pairs per row. */
  const kv = (pairs, { colW = CONTENT_W } = {}) => {
    const labelW = 128;
    for (const [label, value] of pairs) {
      const lines = wrap(notProvided(value), colW - labelW - 8, 9);
      ensure(lines.length * 12 + 4);
      page.drawText(ascii(label), { x: M.x, y: y - 9, size: 9, font: regular, color: rgb(...C.muted) });
      lines.forEach((line, i) => {
        page.drawText(line, { x: M.x + labelW, y: y - 9 - i * 12, size: 9, font: regular, color: rgb(...C.body) });
      });
      y -= Math.max(lines.length, 1) * 12 + 4;
    }
  };

  /** Simple bordered table with a shaded header row. rows: string[][]. */
  const table = (columns, rows, { widths } = {}) => {
    const cols = widths || columns.map(() => CONTENT_W / columns.length);
    const drawHead = () => {
      ensure(22);
      page.drawRectangle({ x: M.x, y: y - 18, width: CONTENT_W, height: 18, color: rgb(...C.fill) });
      let x = M.x;
      columns.forEach((col, i) => {
        const headLines = wrap(col, cols[i] - 10, 7.5, bold);
        headLines.forEach((line, li) => {
          page.drawText(line, { x: x + 5, y: y - 9 - li * 8.5, size: 7.5, font: bold, color: rgb(...C.navy) });
        });
        x += cols[i];
      });
      y -= 22;
    };
    drawHead();

    rows.forEach((row) => {
      const cellLines = row.map((cell, i) => wrap(String(cell ?? '—'), cols[i] - 10, 8.5));
      const rowH = Math.max(...cellLines.map((l) => l.length)) * 11 + 8;
      if (y - rowH < M.bottom) {
        newPage();
        drawHead();
      }
      page.drawLine({ start: { x: M.x, y: y - rowH }, end: { x: A4.W - M.x, y: y - rowH }, thickness: 0.5, color: rgb(...C.border) });
      let x = M.x;
      cellLines.forEach((lines, i) => {
        lines.forEach((line, li) => {
          page.drawText(line, { x: x + 5, y: y - 11 - li * 11, size: 8.5, font: regular, color: rgb(...C.body) });
        });
        x += cols[i];
        if (i < cols.length - 1) {
          page.drawLine({ start: { x: x, y: y }, end: { x: x, y: y - rowH }, thickness: 0.5, color: rgb(...C.border) });
        }
      });
      y -= rowH;
    });
    y -= 6;
  };

  /** Colored result chip (status pill). */
  const verdictChip = (status) => {
    const label = STATUS_LABEL[status] || String(status || 'UNDER REVIEW').toUpperCase();
    const color = RESULT_COLOR[status] || C.warn;
    const chipW = width(label, 10, bold) + 28;
    const chipH = 24;
    ensure(chipH + 12);
    page.drawRectangle({ x: M.x, y: y - chipH, width: chipW, height: chipH, color: rgb(...(RESULT_FILL[status] || C.warnSoft)), borderColor: rgb(...color), borderWidth: 1.25 });
    page.drawText(label, { x: M.x + 14, y: y - chipH + 8, size: 10, font: bold, color: rgb(...color) });
    y -= chipH + 12;
  };

  // ================= CONTENT =================

  // The letterhead carries the report title; content opens with the
  // inspection identity and the verdict.
  text(`Inspection ID ${inspection.id}  ·  ${notProvided(inspection.date)}${inspection.time ? ` · ${inspection.time}` : ''}`, { pt: 10.5, f: bold, color: C.body, gap: 8 });
  verdictChip(inspection.status);

  sectionTitle('1. Inspection Information');
  kv([
    ['Inspection ID', inspection.id],
    ['Inspector', inspection.inspector || 'Not recorded'],
    ['Department', inspection.department || 'Weights & Measures — Legal Metrology'],
    ['Date / Time', `${notProvided(inspection.date)}${inspection.time ? ` · ${inspection.time}` : ''}`],
    ['Inspection Type', notProvided(inspection.inspectionType ? String(inspection.inspectionType) : null)],
    ['Establishment', notProvided(inspection.establishment)],
    ['Address', notProvided(inspection.address)],
    ['License No.', notProvided(inspection.licenseNo)],
    ['Location', notProvided(inspection.location)],
  ]);

  // Product info from the label snapshot (reviewed values), falling back to summary fields
  const label = inspection.label || {};
  const declValue = (needle) => {
    const decl = (inspection.declarations || []).find((d) => (d.name || '').toUpperCase().replace(/[^A-Z]/g, '').includes(needle));
    return decl?.value ?? null;
  };
  sectionTitle('2. Product Information');
  kv([
    ['Product Name', notDetected(label.name || declValue('PRODUCT'))],
    ['Brand', notDetected(label.brand || declValue('BRAND'))],
    ['Manufacturer', notDetected(inspection.manufacturer && inspection.manufacturer !== '—' ? inspection.manufacturer : declValue('MANUFACTURER'))],
    ['Net Quantity', notDetected(label.net_quantity || declValue('NETQUANTITY'))],
    ['MRP', notDetected(label.mrp || declValue('MRP'))],
    ['Manufacturing Date', notDetected(label.mfg || declValue('MFGDATE'))],
    ['Expiry / Best Before', notDetected(label.expiry || declValue('BESTBEFORE'))],
    ['Batch / Lot No.', notDetected(label.batch || declValue('BATCH'))],
    ['Barcode', notDetected(label.barcode)],
  ]);

  // Compliance summary
  const s = inspection.summary || {};
  sectionTitle('3. Compliance Summary');
  kv([
    ['Overall Result', STATUS_LABEL[inspection.status] || String(inspection.status || '—').toUpperCase()],
    ['Checks Passed', String(s.compliantCount ?? '—')],
    ['Requires Review', String(s.warnCount ?? '—')],
    ['Violations', String(s.violationCount ?? '—')],
  ]);
  if (s.disclaimer) {
    wrap(s.disclaimer, CONTENT_W, 8).forEach((line) => text(line, { pt: 8, color: C.muted, gap: 2 }));
    y -= 6;
  }

  // Declaration verification table
  const dims = ['presence', 'correctness', 'placement', 'readability', 'font_size'];
  const GLYPH = { ok: 'OK', pass: 'OK', warn: 'REVIEW', review: 'REVIEW', bad: 'FAIL', fail: 'FAIL', na: '—', unknown: '?' };
  sectionTitle('4. Declaration Verification');
  const declRows = (inspection.declarations || []).map((d) => {
    const result = RESULT_GLYPH[d.presence || d.correctness] || 'REVIEW';
    const failedDims = dims.filter((dim) => d[dim] === 'bad' || d[dim] === 'warn').map((dim) => dim.replace('_', ' '));
    return [
      d.name || '—',
      notDetected(d.value),
      d.rule_reference || 'LM (PC) Rules 2011',
      result,
      failedDims.length ? `Review: ${failedDims.join(', ')}` : 'Meets checks',
    ];
  });
  if (declRows.length) {
    table(
      ['Declaration', 'Detected Value', 'Requirement (Rule)', 'Result', 'Remarks'],
      declRows,
      { widths: [105, 105, 145, 55, 134] }
    );
  } else {
    text('No declaration checks were recorded for this inspection.', { pt: 9, color: C.muted });
  }

  // Violations / findings
  const violations = (inspection.declarations || []).filter((d) => d.violation_type);
  sectionTitle('5. Violations / Findings');
  if (violations.length) {
    table(
      ['Violation', 'Severity', 'Reason', 'Rule Reference'],
      violations.map((d) => [
        `${d.name} — ${String(d.violation_type).replace(/_/g, ' ')}`,
        d.presence === 'bad' ? 'Major' : 'Minor',
        d.presence === 'bad' ? 'Required declaration could not be verified on the label.' : 'Detected value requires inspector review.',
        d.rule_reference || 'LM (PC) Rules 2011',
      ]),
      { widths: [135, 55, 205, 149] }
    );
  } else {
    text('No violations recorded.', { pt: 9, color: C.muted });
  }

  // Evidence images
  sectionTitle('6. Evidence');
  const evidence = (inspection.evidence || []).filter((e) => e.url || e.dataUrl);
  if (evidence.length === 0) {
    text('No evidence images attached to this inspection.', { pt: 9, color: C.muted });
  } else {
    for (const [index, item] of evidence.entries()) {
      try {
        const response = await fetch(item.dataUrl || item.url);
        const bytes = await response.arrayBuffer();
        let embedded;
        const head = new Uint8Array(bytes.slice(0, 4));
        const isPng = head[0] === 0x89 && head[1] === 0x50;
        embedded = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const maxW = 300;
        const maxH = 170;
        const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
        const w = embedded.width * scale;
        const h = embedded.height * scale;
        ensure(h + 26);
        page.drawRectangle({ x: M.x - 1, y: y - h - 1, width: w + 2, height: h + 2, borderColor: rgb(...C.border), borderWidth: 0.75 });
        page.drawImage(embedded, { x: M.x, y: y - h, width: w, height: h });
        page.drawText(ascii(`Evidence ${index + 1}: ${item.label || 'Photograph'}`), {
          x: M.x + w + 12, y: y - h / 2, size: 8.5, font: regular, color: rgb(...C.muted), maxWidth: CONTENT_W - w - 12,
        });
        y -= h + 18;
      } catch {
        text(`Evidence ${index + 1} (${item.label || 'photograph'}) could not be embedded.`, { pt: 8.5, color: C.muted });
      }
    }
  }

  // Remarks
  sectionTitle('7. Inspector Remarks');
  const remarks = inspection.remarks || inspection.notes;
  if (remarks) {
    wrap(remarks, CONTENT_W, 9).forEach((line) => text(line, { pt: 9 }));
  } else {
    text('Not provided.', { pt: 9, color: C.muted });
  }

  // Verification block
  sectionTitle('8. Inspector Verification');
  kv([
    ['Inspector Name', inspection.inspector || 'Not recorded'],
    ['Employee ID', inspection.inspectorId || 'Not recorded'],
    ['Verification', 'The findings above were reviewed and confirmed by the inspecting officer.'],
  ]);
  ensure(46);
  page.drawLine({ start: { x: M.x, y: y - 26 }, end: { x: M.x + 220, y: y - 26 }, thickness: 0.75, color: rgb(...C.border) });
  page.drawText('Signature & Date', { x: M.x, y: y - 38, size: 8, font: regular, color: rgb(...C.muted) });
  y -= 46;

  // Chrome on every page (after pagination is final), then serialize
  drawPageChrome();
  return doc.save();
}
