# Backend + End-to-End Phase — Status

Built on top of the existing frontend prototype. No pages, architecture, or landing page were thrown away.

## What was implemented in this phase

**Phase 1 — Architecture plan**
`docs/BACKEND_PLAN.md` — Supabase-backed backend (DB + Auth + Storage + RLS), real role-based authorization, OCR/model integration contract, compliance engine separation, report architecture, free-tier deployment model.

**Phase 2 — Supabase schema + RLS**
`supabase/migrations/0001_init.sql` — full relational schema (profiles, manufacturers, products, inspections, inspection_products, declarations, evidence, violations, cases, case_events, reports), consistency triggers (manufacturer count rollups), Row Level Security on every table, two private storage buckets with role-checked policies. Run in the Supabase SQL editor or via `supabase db push`.

**.env + client layer**
- `.env.example` — the env surface (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_OCR_ENDPOINT`).
- `.gitignore` — `.env.local`, `dist`, `node_modules` excluded.
- `src/services/supabaseClient.js` — lazy Supabase client; `SUPABASE_ENABLED` auto-detected from env vars.

**Phase 4 — Unified data-access seam**
`src/services/repo.js` — one interface (`listInspections`, `getInspection`, `createInspection`, `listManufacturers`, `searchManufacturers`, `listCases`, `listReports`, `uploadEvidence`) backed by either the Supabase adapter (when env vars are present) or the local `dataStore` adapter (demo/offline). `DATA_BACKEND` is auto-selected.

**Phase 5 — Manufacturer repository + real search**
`GovManufacturers.jsx` now performs debounced real search against the repo (Supabase `ilike` on name/GSTIN/license in Mode B; local store filter in Mode A), with loading / no-results / error / retry / clear states. The earlier spacing bug (`.history-search { flex: 1 }` leaking into the column-flex page) was fixed in `app.css`.

**Phase 8 — OCR extraction service (real, in-browser baseline)**
`src/services/extractionService.js` — `analysisService.analyze(imageFile)` using tesseract.js in a WebWorker. Returns `fields` in the declaration contract (key/label/value/confidence/bbox), plus words/lines. Two providers: `tesseract-browser` (default, user CPU, ₹0) and `server` (when `VITE_OCR_ENDPOINT` is set — the integration point for the team's own model). No upload to a third party in the browser baseline.

**Phase 9 — Compliance engine (separate from extraction)**
`src/services/complianceEngine.js` — `complianceService.evaluate(declarations)` returns findings with check / result (PASS/FAIL/REVIEW) / reason / rule reference / severity / dimensions (presence, correctness, placement, readability, font_size) / bounding box / violation type. Honest limits: font-size is REVIEW where physical measurement is unavailable; no legal certainty claimed.

The engine's key-matching bug (mandatory-check needles kept underscores while the haystack stripped them, so MANDATORY presence checks could falsely FAIL on real extraction output) was fixed.

**Phase 7 + 10 — Wizard end-to-end pipeline**
The 6-step New Inspection wizard now flows through the real services:
1. Details (establishment, license, address, location, inspection type, date/time, remarks) → Start Inspection.
2. Capture (barcode tab / upload-image tab, file-validated upload ≤5 MB, remove/replace, product preview).
3. Extraction — `extractionService.analyze()` with a staged progress overlay (Upload → Process → Extract → Check → Prepare), retry on failure, image change re-triggers analysis.
4. Compliance — renders real `complianceService.evaluate()` findings; expandable rows expose the full §9 dimension detail (presence/correctness/placement/readability/font_size/confidence/bbox).
5. Evidence — real upload/remove of evidence photos (image-validated, capped at 6), highlighted violation-region overlay from bounding-box data, notes, confirmation checkbox.
6. Report — real findings drive counts, violations, the donut, and the submitted record; Download PDF / Editable Report actually trigger `reportsService` downloads (not dead toasts); Submit flows through `inspectionsRepo.create()`.

Data preservation holds across steps — the draft object is a single source of truth in the wizard container.

**Phase 13 — Report generation (real downloads)**
`src/services/reportsService.js` — `downloadReport(inspection, { format })`:
- PDF: opens a formatted print view and invokes the browser print dialog → "Save as PDF" (standard dependency-free client-side path).
- Editable: generates a `.doc` (HTML-based Word format) via Blob download.

Wired at: wizard Report step, Inspector detail page, Gov inspection detail page, Gov Case Review page, Gov Reports (Department Reports) page.

## What changed

- `.env.example`, `.gitignore` extended.
- `src/services/authService.js` — already an adapter; Forgot Password path (`resetPassword`) now both adapters implement it. The login card's Forgot Password modal now calls `authService.resetPassword(email)` for real instead of showing a static message (the Supabase path triggers a real password-reset email; the demo path confirms the email format).
- `src/services/repo.js` — added `createInspection(record, files)` to the Supabase adapter (Mode B); local adapter already existed. Manufacturer and product are linked by lookup only (official records are government-managed; RLS: officer-only writes), never created by the inspector.
- `src/services/complianceEngine.js` — key-matching fix above; otherwise unchanged.
- `src/pages/inspector/NewInspection.jsx` — pipeline wired through the real services; report step reads from real findings; download buttons live.
- `src/pages/gov/GovPlaceholder.jsx` — `GovReports` is now a real working page (report table + PDF/editable downloads) in the placeholder file; `AppRoutes` imports it from there.
- `docs/DEPLOYMENT.md` — written in this phase (two runbooks: zero-setup local/demo mode and Supabase-backed full-stack mode, env surface, OCR migration path, storage, free-tier summary, verification checklist).

## What is still dependent on the backend / model

- **Auth is real-capable but environment-gated.** The Supabase auth adapter activates only when `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set. Without them, the demo directory is used — still functional, still role-gated, but not a real auth mechanism. Role still comes from the auth layer (server claim in Mode B; demo directory in Mode A), never from client input.
- **Database is schema-ready but not applied.** `supabase/migrations/0001_init.sql` is written; it must be run in a Supabase project before Mode B reads/writes a real DB.
- **Manufacturer/product records are linkable by lookup but not creatable by the inspector.** Official records (manufacturers, products) are government-only to write under RLS — that is intentional and correct. An inspector who doesn't know the manufacturer still submits the inspection with the label snapshot; the rollup to a manufacturer happens when one matches.
- **OCR is a working baseline, not a claim of legal-metrology-grade extraction.** tesseract.js in the browser is heuristic + regex; swap to a better model by setting `VITE_OCR_ENDPOINT`. Font-size compliance is REVIEW, never a verdict — the engine lacks physical measurements.
- **PDF is browser print-based.** True server-side PDF generation arrives when that backend capability is wired; the UI contract (`downloadReport`) is already in place.
- **Local mode data is per-browser.** Cross-device / cross-user reality is Mode B with Supabase.
- **Gov Analytics, Gov Repository, Gov Settings, Inspector settings, and a few inspector secondary pages** are scaffolded/placeholder where the plan marked them as later deliverables or where the data simply isn't there yet. The pages that are implemented are functional; the ones that aren't are clearly marked, not faked.

## Build / lint status

- `npm run lint` — 0 errors (16 warnings, all dev-only: fast-refresh context patterns, the documented Supabase/tesseract dynamic-import note).
- `npm run build` — clean (`dist/` produced).

## How to verify

```
npm run lint
npm run build
npm run dev
```

Then:
1. Landing → sign in as Inspector or Govt. Officer (demo chips or real Supabase user with an `app_role` claim) → correct portal.
2. Inspector: Dashboard → New Inspection wizard (all 6 steps, upload an image, watch the staged analysis overlay, confirm the compliance table shows real findings, attach evidence, submit, then check History + Reports for the new record).
3. Government: Command Dashboard, Inspection Monitoring (search/filter/sort), Violations, Cases (open a case, record a decision + notes, confirm the timeline + KPI update), Manufacturers (search + Add Manufacturer modal), Analytics (period filter recomputes the figures), Repository, Department Reports (download any report).
4. Forgot Password on the login card: enter an email → the demo path confirms the format; the Supabase path emails a reset link.
5. Confirm the sidebar stays fixed and only the main content scrolls in both portals.

## Honest limitations (not hidden, not faked)

- The OCR baseline is tesseract.js heuristic extraction, not a certified legal-metrology compliance engine. The compliance engine is rule-based and clearly returns REVIEW where it cannot decide.
- The AI must not and does not autonomously ban, suspend, or seize a manufacturer's license. Enforcement actions are recorded only by a government officer through the case workflow, and only after review.
- Nothing here adds a paid service automatically. Supabase and tesseract.js are free-tier / ₹0 for the baseline. A server-side model, if ever needed, is opted into by setting `VITE_OCR_ENDPOINT`.
