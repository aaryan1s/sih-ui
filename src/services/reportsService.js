/**
 * Report generation service — REAL programmatic PDF (pdf-lib).
 *
 * Replaces the previous browser-print approach: the generated document is a
 * proper PDF file (downloaded as a Blob), so it never contains browser chrome,
 * URLs, print headers/footers or page metadata — only the report itself.
 *
 * Layout: official government inspection document —
 *   GOVERNMENT OF INDIA / DEPARTMENT OF CONSUMER AFFAIRS / LEGAL METROLOGY
 *   header on every page, page X of Y footer, sectioned body:
 *   Inspection info → Product info → Compliance summary → Declaration
 *   verification → Violations → Evidence images → Remarks → Verification.
 *
 * Data rules: the PDF is built from the ACTUAL inspection record. Missing
 * values are rendered as "Not detected" / "Not provided" — never invented.
 *
 * Future backend swap: replace writePdf() with an Edge Function returning a
 * signed URL; the UI contract downloadReport(record, { format }) stays.
 */

import { writePdf, STATUS_LABEL, RESULT_GLYPH, notDetected, notProvided } from './pdfReport';

/** Trigger a browser file download for the given blob. */
function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const reportsService = {
  /** Build and download the report. PDF is programmatic; editable is a Word-compatible file. */
  async downloadReport(inspection, { format = 'pdf' } = {}) {
    if (!inspection) throw new Error('Report requires an inspection record');
    const fileName = `LM-Report-${inspection.id}`;

    if (format === 'pdf') {
      // State Emblem of India — the same official public asset the landing
      // page uses. Fetched here (browser context); failures degrade to a
      // text-only header, never a fabricated emblem or a crashed download.
      let assets;
      try {
        const emblemResponse = await fetch('/assets/india-emblem.png');
        if (emblemResponse.ok) assets = { emblem: await emblemResponse.arrayBuffer() };
      } catch {
        /* no emblem — text-only header */
      }
      const bytes = await writePdf(inspection, { assets });
      saveBlob(new Blob([bytes], { type: 'application/pdf' }), `${fileName}.pdf`);
      return { ok: true, fileName: `${fileName}.pdf` };
    }

    const html = renderEditableHtml(inspection);
    saveBlob(new Blob(['\ufeff', html], { type: 'application/msword' }), `${fileName}.doc`);
    return { ok: true, fileName: `${fileName}.doc` };
  },
};

/* ================================================================== */
/* PDF generation (pdf-lib)                                            */
/* ================================================================== */

/* PDF building blocks live in pdfReport.js (pure, Node-testable). The
   browser-only download plumbing stays here. */

/* ================================================================== */
/* Editable (.doc) export — same data, Word-compatible                 */
/* ================================================================== */

function renderEditableHtml(inspection) {
  const escapeHtml = (value) =>
    String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const rows = (inspection.declarations || [])
    .map(
      (d) => `<tr>
        <td><strong>${escapeHtml(d.name)}</strong></td>
        <td>${escapeHtml(notDetected(d.value))}</td>
        <td>${escapeHtml(d.rule_reference || 'LM (PC) Rules 2011')}</td>
        <td>${escapeHtml(RESULT_GLYPH[d.presence] || 'REVIEW')}</td>
      </tr>`
    )
    .join('');
  const s = inspection.summary || {};

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Inspection Report ${escapeHtml(inspection.id)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #1a2333; margin: 32px; font-size: 12px; }
  h1 { color: #08376e; font-size: 19px; margin: 0 0 4px 0; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #08376e; border-bottom: 1px solid #d8e0ea; padding-bottom: 4px; margin: 22px 0 8px 0; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { border: 1px solid #d8e0ea; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #eef3f9; font-size: 10.5px; text-transform: uppercase; color: #33455e; }
  .kv { display: grid; grid-template-columns: 170px 1fr; gap: 4px 12px; }
  .kv .k { color: #5a6b82; font-weight: bold; }
  .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #d8e0ea; color: #5a6b82; font-size: 10.5px; }
</style>
</head>
<body>
  <h1>Legal Metrology Inspection &amp; Compliance Report</h1>
  <div style="color:#5a6b82;">Department of Consumer Affairs · Legal Metrology · Government of India</div>

  <h2>Inspection Information</h2>
  <div class="kv">
    <span class="k">Inspection ID</span><span>${escapeHtml(inspection.id)}</span>
    <span class="k">Inspector</span><span>${escapeHtml(inspection.inspector || 'Not recorded')}</span>
    <span class="k">Date / Time</span><span>${escapeHtml(notProvided(inspection.date))} ${escapeHtml(inspection.time || '')}</span>
    <span class="k">Establishment</span><span>${escapeHtml(notProvided(inspection.establishment))}</span>
    <span class="k">Address</span><span>${escapeHtml(notProvided(inspection.address))}</span>
    <span class="k">Product</span><span>${escapeHtml(notDetected(inspection.product))}</span>
    <span class="k">Manufacturer</span><span>${escapeHtml(notDetected(inspection.manufacturer && inspection.manufacturer !== '—' ? inspection.manufacturer : null))}</span>
  </div>

  <h2>Declaration Verification</h2>
  <table>
    <thead><tr><th>Declaration</th><th>Detected Value</th><th>Requirement (Rule)</th><th>Result</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">No declaration checks recorded.</td></tr>'}</tbody>
  </table>

  <h2>Compliance Summary</h2>
  <div class="kv">
    <span class="k">Overall Result</span><span>${escapeHtml(STATUS_LABEL[inspection.status] || '—')}</span>
    <span class="k">Checks Passed</span><span>${escapeHtml(String(s.compliantCount ?? '—'))}</span>
    <span class="k">Requires Review</span><span>${escapeHtml(String(s.warnCount ?? '—'))}</span>
    <span class="k">Violations</span><span>${escapeHtml(String(s.violationCount ?? '—'))}</span>
  </div>

  <h2>Inspector Remarks</h2>
  <p>${escapeHtml(notProvided(inspection.remarks || inspection.notes))}</p>

  <div class="footer">
    Generated by the Legal Metrology Compliance System · This document is a system-generated record of the inspection findings above.
  </div>
</body>
</html>`;
}
