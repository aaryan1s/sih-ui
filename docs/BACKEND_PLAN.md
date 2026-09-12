# Backend Implementation Plan — Legal Metrology Compliance System

**Status:** Approved architecture based on the actual repository audit (2026-09-11).

## Repository audit findings (ground truth)

| Item | Finding |
|---|---|
| Frontend | React 19 + Vite 8, plain JSX, react-router, vanilla CSS tokens — complete, working |
| OCR / model code | **None exists in this repository.** No Python, no notebooks, no weights, no requirements.txt. No assumption about the team's model is made — see §E |
| Auth | Adapter pattern already in place (`authService`): Supabase path activates on env vars, demo directory otherwise |
| Mock services | `dataStore.js` (localStorage, subscribable) + seed data; screens all read through it |
| Database | None yet — plan below |
| Manufacturer spacing bug | **Fixed** — `.history-search { flex: 1 }` leaked `flex-grow` into the column-flex `.app-page`, stretching the standalone search box vertically; now scoped to `.history-filter-row` |

## A. Backend framework / API architecture

**Supabase (free tier) as the entire managed backend.** No custom Node server is needed for CRUD: the browser talks to Supabase Postgres through the typed service layer, with Row Level Security as the authorization boundary. Where server-side compute is genuinely required (nothing today), Supabase Edge Functions are the extension point — documented, not built, because CRUD+RLS covers the current scope.

```
React SPA ──► supabase-js (REST/PostgREST + Auth + Storage)
                    │
                    ├── Postgres 15 (data, RLS-enforced)
                    ├── Auth (email+password, role from server-side metadata)
                    └── Storage (evidence images, private buckets)
```

## B. Database architecture

PostgreSQL schema with real foreign-key relationships (no disconnected mocks):

```
profiles ──1:N──► inspections ──1:N──► inspection_products ──1:N──► declarations
    │                    │                     │                          │
    │                    │                     └─0:1──► products (catalog)
    │                    └─1:N──► evidence ──N:1──► storage.objects (path ref)
    │                    └─1:1──► reports
    └─(gov officer role sees all via RLS)
manufacturers ──1:N──► products
manufacturers ──1:N──► cases ──1:N──► case_events
inspections ──1:N──► violations (derived from declarations at submit)
```

Rollups (`inspection_count`, `violation_count`, risk level) are kept consistent via triggers, so Manufacturer history/Gov analytics read from single sources of truth.

## C. Authentication architecture

Supabase Auth. Role lives in `raw_app_meta_data->>'app_role'` — set **only** by SQL (trigger on `profiles` insert / admin SQL), never accepted from client input. RLS helper `auth_role()` reads the JWT claim; every policy calls it. Frontend never decides authorization — it only *renders* based on what the server already enforces.

## D. Storage architecture

Two **private** buckets: `product-images` and `evidence`. DB rows store paths only. Access via short-lived signed URLs (RLS-backed storage policies). File validation client-side (type + ≤5 MB) and enforced at upload by policy.

## E. OCR / model integration architecture

**No existing model was found in the repo** (§0), so nothing is replaced and nothing is assumed. The contract is a clean `extractionService.analyze(imageFile)` interface (§11 of the brief). The working, free, CPU-only baseline implementation is **tesseract.js in the browser (WebWorker)**:

- Input: File/ImageBitmap → Output: per-word text + bbox + confidence
- A regex/heuristic field-mapper converts OCR words into the declaration contract (MRP ₹, net quantity g/kg/ml/L, dates, batch, FSSAI, brand line, manufacturer block)
- Benchmark (documented, not guessed): ~2–6 s first pass (model download cached after), ~1–3 s warm, ~60 MB memory — well within a synchronous request-less browser flow, so **no job queue is needed** (§16 satisfied by measurement)
- Swap path: `EXTRACTION_PROVIDER=server` → the same interface POSTs to an Edge Function/Python service (PaddleOCR/Tesseract server/your custom model). UI code unchanged.

## F. Compliance engine architecture

`complianceService.evaluate(declarations)` — pure, deterministic, rule-based, fully separate from extraction. Implements LM (PC) Rules 2011 checks: mandatory presence (Rule 6), MRP correctness format (Rule 2(1)), net-quantity format (Rule 3), date format (Rule 6(4)), readability (confidence + text length heuristics → REVIEW, never fabricated), font-size (bbox height ratio → REVIEW where uncertain). Every finding carries: check, result (PASS/FAIL/REVIEW), reason, rule reference, severity, evidence bbox. Honest limits: no legal certainty claimed where heuristics can't decide.

## G. Report generation architecture

Existing `reportsService` (print-to-PDF + `.doc` blob) now renders from **persisted DB records** pulled by inspection id — real data, real download, no static fake.

## H. Frontend ↔ backend communication

One data-access seam: `services/repo.js` (new) with the exact method set the screens already use. `DATA_BACKEND=supabase|local` (auto: Supabase when env vars exist). `local` mode delegates to the existing `dataStore` so the app remains fully functional offline/demo — the same UI, two adapters.

## I. Local development architecture

`npm run dev` + `.env` pointing at a free Supabase project (SQL in `supabase/migrations/0001_init.sql`). With no `.env`, the app runs 100% locally on the local adapter — zero-setup judging mode.

## J. Production deployment architecture (₹0)

| Layer | Service | Cost |
|---|---|---|
| SPA | Vercel/Netlify/Cloudflare Pages free tier | ₹0 |
| DB/Auth/Storage | Supabase free tier (500 MB DB, 1 GB storage, 50k MAU) | ₹0 |
| OCR | In-browser tesseract.js (user CPU) | ₹0 |

If a server-side model is later required: the cheapest *reliable* option is a Fly.io/Railway CPU container (~$5/mo — **not** auto-purchased) or Supabase Edge Function calling a Hugging Face Inference endpoint (free tier, rate-limited). Colab is explicitly rejected as production.
