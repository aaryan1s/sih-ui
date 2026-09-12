# PROJECT_TECHNICAL_OVERVIEW.md

**Status:** OCR upgrade pass complete (2026-09-11). Every claim below was verified by running the real application in headless Chrome end-to-end (empty store → wizard → change-image round-trip → PDF → Hindi round-trip on both portals → officer visibility), not by reading code alone.

**Data model:** the application holds ZERO seed/demo records. The store starts empty; every inspection, manufacturer, violation, case and report originates from user actions. Manufacturers are derived from inspection data (provisional until a department officer verifies them); the system only FLAGS cases for review — enforcement decisions remain officer-only.

**Pipeline architecture:** `image → imageProcessingService (CV boundary, honest pass-through) → extractionService (OCR provider: local PaddleOCR service or in-browser Tesseract fallback) → shared extraction heuristics → complianceService → inspector review → inspectionsRepo → history/monitoring/reports`. The CV stage reports `performed: false` — no fabricated results — and is replaceable without touching any consumer.

`npm run dev` starts both the PaddleOCR service and the frontend together.
Vite may print "Port 5173 is in use, trying another one..." when a previous
session is still bound — harmless; use the URL it prints. The frontend POSTs
the uploaded image to the service and adapts the payload (text + 0–100
confidence + bbox in original-image pixels) into the same words/lines/fields
contract as before — extraction heuristics, compliance, UI, persistence and
reports are engine-agnostic. Tesseract.js is retained as the automatic
fallback when no endpoint is configured. No cloud, no API keys, ₹0.

**OCR (current):** primary engine is a **local Python PaddleOCR service**
(`ocr-service/`, FastAPI + PP-OCRv5 mobile det+rec, port 8100). If analysis
fails (service not running), the wizard shows the real error with **Retry
analysis**, **Back to capture** and **Enter details manually** — the OCR
service never blocks manual inspection entry.

---

## 1. Stack (actual, verified against `package.json`)

| Layer | Technology | Notes |
|---|---|---|
| UI | React 19 + Vite 8, plain JSX | No UI kit; vanilla CSS design tokens |
| Routing | react-router-dom 7 | Nested portal layouts + role guards |
| State/data | `src/services/dataStore.js` (pub/sub + localStorage) → `repo.js` seam | Single source of truth for both portals |
| Backend (optional) | Supabase (Auth / Postgres / Storage / RLS) | Activates only when env vars present |
| OCR | **PaddleOCR 3.7 (local Python service, PP-OCRv5 mobile)** — primary | `ocr-service/`; ~15 s cold (model load), ~3 s warm on the sample label photo |
| OCR fallback | tesseract.js 7, browser-side (no endpoint configured) | ~287 ms warm; kept deliberately as offline fallback |
| Image preprocessing | PIL: EXIF-orientation fix, working-band resize, image-aware unsharp/contrast/grayscale | Original image untouched for evidence; notes returned in payload |
| Compliance | Deterministic rule engine (`complianceEngine.js`) | Strictly separate from OCR |
| PDF | pdf-lib 1.17 (programmatic) | No browser print |
| Lint | oxlint | 0 errors / 19 dev-only warnings |

## 2. Architecture

```
Landing/Login (visual source of truth, unchanged)
   ↓ authService (role from server-side claim/directory — never client-chosen)
   ↓ RequireRole guards
   ├── /inspector  → InspectorLayout → AppShell (fixed sidebar, independently scrolling main)
   └── /gov        → GovLayout       → AppShell
Data: every screen reads/writes through repo.js → dataStore (demo) or Supabase adapter (Mode B).
```

**Routes.** `/` landing · `/unauthorized` · `/inspector`: dashboard, `inspections/new` (6-step wizard), `inspections`, `inspections/:id`, `manufacturers`, `manufacturers/:id`, `reports`, `profile`, `settings` · `/gov`: dashboard, `inspections`, `inspections/:id`, `violations`, `cases`, `cases/:id`, `manufacturers`, `analytics`, `repository`, `reports`, `profile`, `settings`.

**Entities:** profiles → inspections → products/declarations/evidence; manufacturers → products; cases → case_events; reports. Full schema + RLS in `supabase/migrations/0001_init.sql` (declaration rows carry value, confidence, presence/correctness/placement/readability/font_size, violation_type, rule_reference, bounding_box, verified, ocr_value).

## 3. Real vs mocked functionality

| Capability | Status | Evidence |
|---|---|---|
| Authentication (demo adapter: sign-in/out, session, role gating) | **REAL** (demo backend) | Verified in browser; role comes from server-side directory, `error123` simulates failure |
| Authentication (Supabase adapter) | **PARTIAL** | Code complete; needs env vars + migration applied |
| Role-based authorization / separation | **REAL** | Officer → `/inspector` redirected to `/unauthorized` (tested) |
| Database (local store + localStorage) | **REAL** | Submitted inspection survived reload and was visible to the officer session |
| Database (Supabase Postgres + RLS) | **PARTIAL** | Schema/RLS written, not yet applied to a live project |
| Image upload / preview / replace / remove | **REAL** | Tested through the wizard |
| OCR (PaddleOCR local service) | **REAL — PRIMARY** | Verified end-to-end in-browser: 10 regions, mean confidence 0.94, boxes in original pixels; 4.5–4.8 s analysis on the sample label photo |
| OCR (tesseract.js in-browser fallback) | **REAL — fallback when `VITE_OCR_ENDPOINT` unset** | Provider selection verified in-browser |
| Field extraction (text → declarations) | **PARTIAL** | Heuristic regex mapping (UNTOUCHED); strong on clean label photos, weak on stylized/low-contrast art |
| **CV / dedicated image-processing stage** | **NOT IMPLEMENTED — PIPELINE READY** | `imageProcessingService` boundary exists with an honest pass-through contract; `VITE_OCR_ENDPOINT` remains the swap point for a real CV+OCR pipeline |
| Compliance engine | **REAL** | Deterministic rules over inspector-reviewed values; re-evaluates on every edit; font-size always REVIEW (no physical measurement) |
| Inspector verification vs OCR provenance | **REAL** | `ocr_value` + `verified` + per-field confidence preserved; manual edits never inherit OCR confidence |
| Inspection submission + persistence | **REAL** | LM-1043 created in browser → history, detail page, officer monitoring all reflected it |
| Manufacturer rollups / search | **REAL** (local) / **PARTIAL** (Supabase search wired, unverified live) | Debounced search against the single data source |
| Government monitoring / violations / cases | **REAL** (UI + data over shared store) | Enforcement decisions are manual officer actions; system only flags |
| PDF generation | **REAL** | pdf-lib, GOI header, 8 sections, embedded evidence, page X of Y; valid PDF 1.7 generated from a real submission and visually inspected |
| Hindi localization | **REAL** on shell/wizard/history/dashboard/settings; **PARTIAL** elsewhere | Central `t.app` dictionary, English fallback (no `undefined`), persisted via localStorage; round-trip verified in browser |
| Analytics | **PARTIAL** | Charts compute from real store data; geographic views need real location data |

## 4. Environment variables (no secrets in repo)

| Var | Purpose | Absent behaviour |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Demo/local adapter |
| `VITE_SUPABASE_ANON_KEY` | Publishable anon key only (RLS is the boundary) | Demo/local adapter |
| `VITE_OCR_ENDPOINT` | POST endpoint of the local PaddleOCR service (`http://localhost:8100/ocr`); absent → in-browser Tesseract fallback | Tesseract fallback |

**OCR service env vars** (optional, see `ocr-service/README.md`): `OCR_PADDLE_LANG` (en), `OCR_PADDLE_VARIANT` (mobile\|server), `OCR_PADDLE_USE_TEXTLINE` (false), `OCR_MAX_UPLOAD_BYTES` (12 MB), `OCR_CORS_ORIGINS` (localhost dev ports).

### Local run — full stack

`npm run dev` is the one-command start. A Vite plugin (`scripts/ocrService.mjs`)
owns the local PaddleOCR service: it is started automatically with the dev
server (bootstrapping `ocr-service/.venv` on the very first run), restarted
automatically by a watchdog if it ever dies mid-session, and stopped when the
dev server stops. This works no matter how the dev server is launched —
`npm run dev`, `npx vite`, or an IDE run button — so the analysis service can
no longer be "not reachable" because a separate launch step was forgotten.
An already-running service is reused, never double-started.

```bash
npm run dev        # OCR service + frontend together (recommended)
npm run ocr        # OCR service only, stays alive until Ctrl+C
```

Manual alternative (unchanged):

```bash
cd ocr-service && source .venv/bin/activate && uvicorn app:app --port 8100
npm run dev        # detects the running service and reuses it
```

### API contract — `POST /ocr`

Request: `multipart/form-data`, field `image` (JPG/PNG/WebP ≤ 12 MB). Response:

```json
{
  "success": true,
  "provider": "paddleocr-local",
  "image": { "width": 830, "height": 318 },
  "preprocessing": ["resized 830x318 -> 2506x960", "unsharp mask (small-text enhancement)"],
  "results": [{ "text": "MRP₹120.00", "confidence": 97.4, "bbox": { "x0": 115, "y0": 144, "x1": 241, "y1": 181 } }],
  "meanConfidence": 0.9377,
  "rawText": "…"
}
```

Errors: 413 too large · 415 unsupported type · 422 corrupted image · 500 engine failure — each with human-readable `detail`. Frontend adds a 120 s timeout → clean failure → Retry / manual entry.

## 5. End-to-end verification result (this audit)

Real-browser run, 0 runtime console errors: inspector login → dashboard → New Inspection (details → real product image upload → **PaddleOCR analysis: 6 declarations auto-filled in ~4.5 s** → 9-field complete editable form with "Not detected — enter manually" placeholders → manual edit → compliance → evidence confirm → report) → **PDF downloaded (valid PDF, opened for inspection)** → submit → detail page → history (1 row) → officer login → gov dashboard → **monitoring shows the inspector's record** → change image → new PaddleOCR analysis replaces prior result (stale fields cleared) → service killed → honest error state → "Enter details manually" opens the complete form → submission path intact. Provider fallback (no endpoint → tesseract-browser) verified. Production build clean; lint 0 errors.

## 6. Known limitations / technical debt

1. **CV stage absent** — preprocessing is basic PIL work; the next upgrade is text-region detection / deskew / perspective correction inside `imageProcessingService` (or behind the OCR endpoint). Extraction heuristics still mis-read stylized/rotated/low-contrast label art.
2. Supabase mode unverified against a live project until the migration is applied and roles are set in `raw_app_meta_data`.
3. Demo data persists per-browser only (localStorage); cross-device reality requires Mode B.
4. Remaining secondary pages (some gov analytics views, a few inspector profile sub-sections) still show English when Hindi is selected — fallback, never broken labels.
5. PDF font is a standard base-14 font; ₹ renders as "Rs." (no embedded Unicode font yet).
6. PaddleOCR model weights download on first service start (~10 MB) and cache in `~/.paddlex`; offline first run needs the cache pre-populated.
7. oxlint warnings (19) are dev-only patterns (fast-refresh context exports, one documented dynamic-import note).

## 7. Documentation set

`docs/IMPLEMENTATION_PLAN.md` (frontend) · `docs/BACKEND_PLAN.md` (architecture) · `docs/TECH_STACK.md` (technology choices) · `docs/DEPLOYMENT.md` (Mode A/B runbooks) · `docs/README_BACKEND_PHASE.md` (phase status) · this file (authoritative state).

**OCR IMPLEMENTED: YES (PaddleOCR local service, primary) · OCR FALLBACK: Tesseract.js in-browser · CV IMPLEMENTED: BASIC PREPROCESSING ONLY**
