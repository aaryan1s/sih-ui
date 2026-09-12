# Deployment & Operations — Legal Metrology Compliance System

## Architecture (two modes, one codebase)

The frontend is a single React SPA that runs correctly in two modes with **no code changes**:

```
Mode A (zero setup):  local adapter → persisted localStorage store + in-browser OCR
Mode B (full stack):  supabase adapter → Postgres + Auth + Storage, RLS as the boundary
```

Mode A is the default whenever `VITE_SUPABASE_URL` is absent — useful for judging demos, offline work, and onboarding. Mode B activates automatically when **both** Supabase env vars are present.

```
React SPA
  │
  ├─ Mode A (no .env): repo.js → dataStore (localStorage)
  │                       extractionService → tesseract.js WebWorker (in-browser)
  │                       authService → demo directory
  │
  └─ Mode B (.env present): repo.js → supabase (REST/PostgREST + Auth + Storage)
                             extractionService → tesseract.js (browser) OR VITE_OCR_ENDPOINT
                             authService → real Supabase Auth
```

The switch is automatic. The UI, routes, and components are identical in both modes.

## Required environment variables

Create `.env.local` (copied from `.env.example`). Keys:

```
VITE_SUPABASE_URL=                 # Supabase project URL (app.nu supabase.co)
VITE_SUPABASE_ANON_KEY=            # Publishable anon key — NEVER the service-role key
VITE_OCR_ENDPOINT=                 # (optional) external OCR service endpoint
```

| Variable | When required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | For Mode B | Supabase Auth, Postgres, Storage — auto-activates the supabase adapter |
| `VITE_OCR_ENDPOINT` | Optional, in either mode | When set, the OCR step POSTs the image here instead of running tesseract.js in the browser |

**TL;DR:** with no `.env.local`, the app runs locally, fully. With the two Supabase vars, it connects to a real project. With `VITE_OCR_ENDPOINT` too, OCR is delegated to your model service. **No secrets are committed — `.env.local` is gitignored.**

Security rule: the **frontend key is always the anon/publishable key**. The service-role key never reaches the browser. Row Level Security (RLS) enforces data access, not keys.

## Mode A — local / demo (zero setup)

```
npm install
npm run dev
```

Open the URL. Sign in using the demo directory (the Inspector and Government Officer demo chips on the login cards). The store persists to localStorage, so created inspections, manufacturers, and cases survive a reload within the same browser.

Good for: judging, demos, screenshots, offline work, onboarding, and verifying the UI flow before touching infra.

Limitations: data is per-browser and per-device; there is no cross-user sync, no real auth, and evidence images live as data URLs in localStorage (size-capped).

## Mode B — Supabase-backed (full stack)

### 1. Create the Supabase project

- Go to [supabase.com](https://supabase.com), create a free project.
- Grab the **Project URL** and **anon public key** from Project Settings → API.
- Paste them into `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### 2. Run the schema migration

The initial schema, triggers, RLS, and storage buckets live in:

```
supabase/migrations/0001_init.sql
```

**Option 1 — Supabase SQL editor (no CLI):** open the project → Editor → paste the file contents → Run.

**Option 2 — Supabase CLI:** if you have it, `supabase db push` from the project root runs the migration against your linked project.

The migration creates:

- `profiles` (1:1 with `auth.users`)
- `manufacturers`, `products`, `inspections`, `inspection_products`, `declarations`, `evidence`, `violations`, `cases`, `case_events`, `reports`
- Foreign keys, indexes, consistency triggers (manufacturer count rollups on inspection insert)
- Row Level Security on every table
- Two private storage buckets: `product-images`, `evidence`
- RLS storage policies (inspector uploads / both-roles read for evidence; inspector uploads / authenticated read for product images)

### 3. Set the role claim for each user

Roles live in server-side metadata, not client input. The `auth_role()` SQL helper reads `raw_app_meta_data->>'app_role'`. Set the claim **in SQL**, never from the frontend.

For an existing user:

```sql
-- inspector
update auth.users set raw_app_meta_data = jsonb_set(raw_app_meta_data, '{app_role}', '"inspector"')
where id = 'USER_UUID_HERE';

-- government officer
update auth.users set raw_app_meta_data = jsonb_set(raw_app_meta_data, '{app_role}', '"gov_officer"')
where id = 'USER_UUID_HERE';
```

For new signups, wire the claim into your signup path (e.g., a server-side resolver, a trusted admin endpoint, or the `handle_new_user` extension path) — the rule is: **the client does not get to declare its own role.**

A user with no `app_role` claim is not authorized for either portal.

### 4. Seed initial data (optional)

If you want manufacturer records, seed cases, or sample inspections in the DB, insert them directly via the SQL editor or the Supabase dashboard. The frontend will read them through the supabase adapter once auth + role are in place.

### 5. Run the app

```
npm run dev
```

Sign in with a real Supabase user that has an `app_role` claim. The dashboard, history, manufacturers, wizard, and government portal all read/write through the real DB with RLS enforced.

## OCR model — current baseline and migration path

**Current baseline (Mode A and Mode B without `VITE_OCR_ENDPOINT`):** tesseract.js running in the browser via a WebWorker, on the user's device CPU. No server needed, no cost, no upload of the image to a third party — the image is processed locally and only the extracted structured declarations leave the device via the repo layer.

**If a better model exists later:** set `VITE_OCR_ENDPOINT` to your model service. The extraction contract (`analyze(imageFile) → { fields, words, ... }`) stays identical; the UI does not change. The server endpoint just needs to accept a multipart image upload and return the same shape.

**Not recommended as final architecture:** a personal Colab session — it is not a reliable, persistent, production API and will time out or require re-auth. For a server-side model, the cheapest *reliable* options are a small CPU container on Fly.io/Railway (~$5/mo) or a Supabase Edge Function fronting a Hugging Face Inference endpoint (free tier, rate-limited). None of these are created automatically — they are only used if you configure them.

**Honest performance caveat:** tesseract.js is CPU-bound in the browser. First run downloads the model (~60 MB, cached after). Warm runs are faster. If you need much faster or more accurate extraction, that is the integration point to swap in a server model via `VITE_OCR_ENDPOINT` — the frontend is already built to accept that.

## Storage and evidence

Both buckets are private. Evidence and product images are accessed via the Supabase storage APIs with RLS policies in place. The DB stores **paths only**, never image bytes. Evidence upload in the wizard currently stores as a data URL in local mode and uploads to the `evidence` bucket in Supabase mode.

## Reports

Reports are generated client-side from the persisted inspection record:

- **PDF:** opens a formatted print view and invokes the browser print dialog, which offers "Save as PDF" on every OS. This is the standard dependency-free path for client-side structured PDF export.
- **Editable:** generates a `.doc` file (HTML-based Word format) via Blob download — opens in Word / Google Docs / LibreOffice.

For a server-generated PDF later, replace `reportsService.downloadReport` with an Edge Function that returns a signed URL — the UI contract stays the same.

## Free-tier summary

| Layer | Service | Free tier | Notes |
|---|---|---|---|
| SPA hosting | Vercel / Netlify / Cloudflare Pages | Yes | Static deploy of the built `dist/` |
| Database + Auth + Storage | Supabase | Yes (500 MB DB, 1 GB storage, 50k MAU) | RLS is the security boundary |
| OCR | tesseract.js in-browser | Yes | ₹0, user's CPU, no upload to third parties |
| Server-side model (later, optional) | Fly.io / Railway CPU container or HF Inference via Edge Function | Cheap / free-tier rate-limited | Only if you configure it |

The app is deployable without spending money. No paid service is introduced automatically.

## Deploying the SPA (Mode B)

1. Build: `npm run build` → outputs `dist/`.
2. Host `dist/` on any static host (Vercel, Netlify, Cloudflare Pages, S3+CloudFront, etc.).
3. Point the host's environment/env placeholders at the same `.env.local` values during build (Vite embeds `import.meta.env` at build time).

Local dev `npm run dev` uses Vite's dev server; production uses the built static output.

## Local verification checklist

After any change, run:

```
npm run lint      # 0 errors expected
npm run build     # clean build expected
npm run dev       # smoke-test the routes and wizard
```

Then walk:

1. Landing → sign in (demo or Supabase) → correct portal by role.
2. Inspector: Dashboard stats, New Inspection wizard (Details → Capture → Extraction → Compliance → Evidence → Report → submit), History table, Manufacturer lookup.
3. Government: Command Dashboard, Monitoring, Violations, Cases, Manufacturers (search + Add Manufacturer), Analytics, Repository, Reports.
4. Confirm a submitted inspection appears in History, Reports, and the Government monitoring view (Mode B) or the local store (Mode A).
5. Confirm download buttons on the Report step and detail pages actually trigger a download (PDF or editable), not a toast.

## Known honest limitations (not hidden)

- OCR is heuristic/tesseract-based in the browser baseline; it is a working **baseline**, not a claim of production-grade legal metrology extraction. Swap via `VITE_OCR_ENDPOINT` when a better model exists.
- Font-size compliance is REVIEW, not a verdict — the engine does not have physical measurements.
- PDF is browser print-based; true server-side PDF arrives when the backend PDF generation is wired.
- Local mode data is per-browser; cross-device reality is Mode B.
