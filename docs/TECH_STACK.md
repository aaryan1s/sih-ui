# Technology Stack Report — Legal Metrology Compliance System

**Status:** Current as of 2026-09-11. Reflects what is actually in the repository (`package.json` is the source of truth), not aspirational choices.

---

## 1. Stack at a glance

| Layer | Technology | Version | Cost |
|---|---|---|---|
| UI framework | React | 19.2.x | Free (MIT) |
| Build tool | Vite | 8.2.x | Free (MIT) |
| Routing | react-router-dom | 7.18.x | Free (MIT) |
| Styling | Vanilla CSS (design tokens) | — | Free |
| Icons | lucide-react | 1.44.x | Free (ISC) |
| Backend (BaaS) | Supabase (Postgres 15 + Auth + Storage + RLS) | supabase-js 2.116.x | Free tier |
| OCR (baseline) | tesseract.js (in-browser) | 7.0.x | Free (Apache-2.0) |
| Compliance engine | Custom deterministic rule module | in-repo | — |
| PDF generation | pdf-lib (programmatic) | 1.17.x | Free (MIT) |
| Linting | oxlint | 1.79.x | Free (MIT) |
| Hosting (planned) | Static host (Vercel/Netlify/Cloudflare Pages) + Supabase cloud | — | Free tier |

**Total running cost at current scope: ₹0 / month.** No paid service is required or used.

---

## 2. Frontend

### React 19 + Vite 8 (plain JSX, no TypeScript)
- **Why:** The team's existing prototype and skillset are React; Vite gives instant HMR and a fast production build (~300ms in this repo). React 19 is the current stable major.
- **Alternatives considered:** Next.js (rejected — this is an SPA behind auth, SSR adds deployment complexity with no benefit for a government intranet-style tool), Svelte/Vue (rejected — would discard the existing codebase for zero functional gain).
- **No UI kit** (MUI/Ant/Chakra) — deliberately. The application has its own government-grade design language inherited from the landing page (navy/green identity, defined radii/spacing/shadows via `src/styles/variables.css` tokens). A component kit would fight that identity and produce the generic "admin template" look the product explicitly avoids.

### react-router-dom 7
- **Why:** File-simple route config, nested layouts (one shared `AppShell` for both portals), guards via wrapper components (`RequireRole`), URL search params for global search (`?q=`).
- **Alternatives considered:** TanStack Router (fine, but no advantage at this scale).

### Vanilla CSS with design tokens
- **Why:** Single source of truth for color/radius/shadow/spacing in `variables.css`; zero runtime CSS-in-JS cost; full control over the enterprise look. Landing page and portals share the same token set, which is why the authenticated app reads as the same product.
- **Alternatives considered:** Tailwind (rejected — utility sprawl makes the government look harder to keep consistent across 25+ pages; tokens + BEM-ish classes serve the design system better here).

---

## 3. Backend — Supabase (managed BaaS)

### Why Supabase over a custom API server
- The workload is CRUD + auth + file storage + row-level authorization — exactly Supabase's core offering. A Node/Express server would add an artifact to deploy, secure, and pay for, while reimplementing what Postgres RLS does natively.
- **Free tier fit:** 500 MB Postgres, 1 GB storage, 50k MAU auth — comfortably above prototype/judging load.
- **Security model:** the anon (publishable) key ships to the browser; the service-role key never leaves the server. Authorization = Supabase Auth (JWT) + Postgres RLS policies reading `app_role` from server-managed auth metadata. **The frontend can never grant itself a role** — the role is read from the server-issued identity, and RLS enforces data access regardless of what the client claims.

### Adapter architecture (the key design decision)
Every data read/write goes through one seam (`src/services/repo.js`) with two interchangeable adapters behind an identical async interface:
- **supabase adapter** — active when `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set. Real Postgres + Storage + RLS.
- **local adapter** — `dataStore.js` (persisted, subscribable localStorage store) so the app is fully functional with zero setup (demo/judging/offline mode).

The UI never knows which is active. Screens, dashboards, history, manufacturer rollups and the government portal all read the same records either way — one inspection created anywhere appears everywhere.

### Schema entities
`profiles → inspections → inspection_products → declarations → violations → cases → case_events`, plus `manufacturers`, `products`, `evidence`, `reports` — with foreign-key relationships so manufacturer history, violation registers and analytics are derived, never duplicated. Migration: `supabase/migrations/0001_init.sql` (schema + RLS + storage buckets).

---

## 4. OCR / extraction pipeline

### Baseline: tesseract.js 7 (in-browser, CPU, WebWorker)
- **Why:** real OCR with zero server cost and zero deployment surface; ~1–6 s first pass (model cached after), ~300 ms warm; works offline in demo mode.
- **Contract:** `extractionService.analyze(image)` → `{ fields, words, lines, rawText, confidence, provider }`. Field keys follow the declaration contract: `PRODUCT_NAME, BRAND, MANUFACTURER, NET_QUANTITY, MRP, MFG_DATE, BEST_BEFORE, BATCH, FSSAI…`, each with value + confidence + bounding box.
- **v7 note (fixed):** v7 removed the flat `data.words` array; word-level data now requires `{ text: true, blocks: true }` output options and flattening `blocks → paragraphs → lines → words`.

### Swap path: server model via one env var
Setting `VITE_OCR_ENDPOINT` flips `EXTRACTION_PROVIDER` to `'server'`: the image is POSTed as multipart/form-data and the response (same declaration contract) is consumed unchanged — UI, compliance engine, and review flow untouched. **This is the integration point for the team's own model (e.g. PaddleOCR pipeline) when it exists.** The repository currently contains no model weights or Python training code; no assumption about the team's model was made.

### Strict separation of concerns (non-negotiable)
```
IMAGE → EXTRACTION (what is on the label?) → STRUCTURED DECLARATIONS
      → COMPLIANCE ENGINE (does it satisfy the rule?) → FINDINGS
      → INSPECTOR REVIEW (confirmed values) → FINAL RECORD
```
Extraction never judges; the engine never guesses values. Inspector edits re-run the engine against the **reviewed** values, never stale OCR output.

---

## 5. Compliance engine

- **What:** `src/services/complianceEngine.js` — deterministic, rule-based evaluation of structured declarations against the Legal Metrology (Packaged Commodities) Rules 2011: mandatory presence, correctness heuristics (MRP/quantity/date formats), conditional declarations (batch, FSSAI 14-digit, country of origin), and font-size **REVIEW** (never a verdict — physical measurement is impossible from pixels alone).
- **Output per finding:** check · result (PASS/FAIL/REVIEW) · reason · rule reference · severity · per-dimension status (presence/correctness/placement/readability/font-size) · confidence · bounding box.
- **Why not an LLM/ML classifier:** legal findings must be explainable and reproducible. Every result carries its rule reference; unverifiable checks are marked REVIEW for the inspector rather than fabricated. `engineVersion` is stamped into every summary for auditability.

---

## 6. Report generation

- **PDF: pdf-lib (programmatic, client-side).** No browser print, no headless Chrome: the document is constructed directly (A4, government header on every page, page X of Y, 8 numbered sections, bordered tables, embedded evidence photographs, signature block) and downloaded as a real `.pdf` Blob. Missing data renders as "Not detected" / "Not provided" — the generator invents nothing. Pure builder module (`pdfReport.js`) is Node-testable without a browser.
- **Editable export:** Word-compatible `.doc` (HTML-based) generated from the same record.
- **Future swap point:** replace `reportsService.downloadReport` internals with an Edge Function returning a signed URL; the UI contract is unchanged.

---

## 7. Authentication & authorization

| Concern | Implementation |
|---|---|
| Sign-in | Supabase email+password (demo mode: mock directory with latency) |
| Role source | Server-side `app_role` in auth metadata — **never** client input |
| Data authorization | Postgres RLS policies keyed to the role claim |
| Route protection | `RequireRole` guards per portal; cross-portal access → `/unauthorized` |
| Session | Supabase managed (auto-refresh); demo mode: sessionStorage profile snapshot |
| Password reset | `resetPasswordForEmail` (real Supabase flow; demo path validates format) |
| Secrets | Only the publishable anon key reaches the browser; service-role key server-only |

---

## 8. Developer experience & quality

- **oxlint** — 0 errors on 59 files (warnings are dev-only patterns: fast-refresh context exports, documented dynamic imports).
- **Vite build** — clean production bundle (~144 KB gzip app chunk + tesseract/pdf-lib chunks loaded on demand).
- **Smoke-tested pipelines:** PDF generation verified in Node against real inspection records; OCR verified against the real sample image (287 ms warm inference).

---

## 9. Deployment architecture (planned, ₹0)

```
Browser (React SPA, static host free tier)
   ├── Supabase cloud  → Auth + Postgres + RLS + Storage (evidence images, private buckets)
   ├── OCR: in-browser tesseract.js (default)  ·  or  → VITE_OCR_ENDPOINT (team model server)
   └── Reports: generated client-side (pdf-lib) — no report server needed
```

Full runbooks (env vars, migration, role assignment, verification checklist): `docs/DEPLOYMENT.md`.

---

## 10. Deliberately NOT in the stack (and why)

| Excluded | Reason |
|---|---|
| Custom Node/Express API | RLS + PostgREST cover current scope; would add deploy/cost surface |
| Tailwind / component kits | Conflicts with the bespoke government design system |
| LLM-based compliance judgement | Findings must be explainable, deterministic and rule-referenced |
| Paid OCR APIs (Google Vision etc.) | Free baseline works; paid tier only if accuracy demands it — would be raised explicitly first |
| Redis/queues/job workers | OCR is synchronous-fast in-browser; job architecture documented as an option only if a slow server model is adopted |
