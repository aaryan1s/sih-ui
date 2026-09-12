# Legal Metrology Compliance System — Authenticated Application Plan

**Scope of this document:** frontend architecture, authentication/authorization design, and dashboard UI/UX planning for the Inspector and Government portals. No backend, OCR, or compliance implementation is covered — only where they will plug in later.

**Status:** **Approved.** Incorporates review clarifications (declaration data model · extraction vs compliance separation · Supabase authorization · enforcement vs system recommendation) and final corrections (declaration contract fields · password reset flow · authorization wording). Implementation in progress per §11.

---

## 1. Current Project Assessment

### Stack
| Layer | Today |
|---|---|
| Framework | React 19 + Vite 8, plain JSX (no TypeScript) |
| Routing | **None** — single-screen app |
| State | Local `useState` only; one context (`LanguageContext`) |
| Styling | Vanilla CSS with design tokens (`variables.css`), no CSS framework |
| Icons | lucide-react + 4 hand-drawn inline SVGs (Scan / Verify / Detect / Report) |
| Lint/Build | oxlint (0 errors), vite build clean |

### Existing structure
```
src/
├── App.jsx                      # LanguageProvider → SkipLink → split landing layout
├── context/LanguageContext.jsx  # EN/HI dictionary + <html lang>/title sync
├── styles/                      # variables, reset (sr-only, skip-link, reduced-motion),
│                                # landing (layout + anim-rise), left-hero, login-card
├── components/
│   ├── common/                  # Logos (Emblem, JagoGrahakWave, Aadhaar, DigiLocker),
│   │                            # DemoModal (focus-trapped dialog, Esc, focus restore)
│   ├── LeftHero/                # GovHeader, HeroTitle, FeatureCardsRow, StatsRow, TrustStrip
│   └── RightLogin/              # InspectorLoginCard, LoginTabs, LoginForm, SSOCards,
│                                # CardFooter, ParliamentFooter, LangToggle
└── main.jsx
```

### What the login already gives us
- Credential form: validation states, error banner, Caps Lock hint, loading/success/error mock machine (`error123` → failure state).
- Tabbed auth (Credentials / Govt. SSO) with Aadhaar, DigiLocker, Jan Parichay demo modals.
- The landing page's visual language is fully tokenized: navy palette, `--gov-blue`, `--accent-green #26d07c`, 4 feature colors, radii 6/10/14/22, Plus Jakarta Sans + Inter, glass trust-strip, compact-density media queries.

### Gaps (what does not exist yet)
- No router, no protected routes, no auth/session state.
- No app-level reusable components (Card, Table, Badge, Tabs, Stepper, Drawer, EmptyState).
- No service/data layer — everything is hardcoded presentational JSX.
- No app shell (sidebar/topbar) pattern.

### Reuse verdict
**Reuse:** design tokens (extend, don't replace), LanguageContext + i18n pattern, DemoModal (generalize into the base Modal), logos/emblem (app header), status-pill language (→ StatusBadge), button/badge/tab card styles, `anim-rise` utility, a11y patterns (skip link, `:focus-visible` rings, `aria-live`), compact-density approach for short laptop screens.
**Add:** router, AuthProvider + mock authService, portal shells, design-system component set, mock data services.

---

## 2. Proposed Application Architecture

### Flow
```
Landing (/)
   │  login card (existing) — submit
   ▼
authService.signIn(credentials)        [mock now → Supabase Auth later]
   │  returns session + user{ role }
   ▼
Role determination (server claim in future; demo account mapping now)
   ├── INSPECTOR          → /inspector        (field-operations portal)
   ├── GOVERNMENT_OFFICER → /gov              (department command portal)
   └── ADMIN              → deferred (see §12)
   ▼
Portal AppShell (sidebar + topbar, role-branded)
   ▼
Role-specific dashboard → deep pages
Unauthorized role hitting a portal → /unauthorized (403) screen
Expired/absent session → redirect to / (landing + login)
```

### Inspection pipeline (conceptual — stages stay distinct; engines are future work)

```
Image → Automated Extraction (OCR) → Structured Declarations
      → Rule-Based Compliance Engine → Compliance Findings
      → Inspector Verification → Submitted Inspection
```

Extraction determines **what** was detected; the rules engine determines **whether** it satisfies the applicable requirement; the inspector reviews and confirms. All inspection UI uses this vocabulary — *Automated Extraction · Compliance Checks · Rule Findings · Inspector Verification* — and the process is never labelled generically as "AI analysis".

### Layered design
```
Presentation     pages/, components/           (dumb, mock-data driven)
Application      routes/ (guards), context/AuthContext, portal shells
Service layer    services/  authService, extractionService, complianceService,
                            inspectionsService, manufacturersService,
                            violationsService, analyticsService, reportsService
Mock data        data/      static datasets that mimic future API shapes
```

**Key architectural rule:** *every screen reads through a service, never directly from a data file.* The service signatures are shaped like the future Supabase queries, so Phase "backend integration" is a service-adapter swap — zero UI rewrites.

### Proposed directory additions
```
src/
├── routes/AppRoutes.jsx         # router table + guards
├── context/AuthContext.jsx      # session state machine, role, logout
├── services/                    # *Service.js  (mock adapters)
├── data/                        # mock datasets (inspections, manufacturers, violations…)
├── components/
│   ├── common/                  # extended: Modal, StatusBadge, DataTable, Tabs, Stepper,
│   │                            # EmptyState, Drawer, FilterBar, ConfirmDialog, Toaster
│   ├── shell/                   # AppShell, Sidebar, TopBar, PortalBadge, UserMenu
│   └── inspection/              # DeclarationRow (multi-dimension status), DimensionChips,
│                                # ConfidenceMeter, BBoxOverlay, EvidenceGrid
├── layouts/InspectorLayout.jsx  # wraps AppShell with inspector nav/accent
├── layouts/GovLayout.jsx
└── pages/
    ├── inspector/…
    ├── gov/…
    └── errors/ (Forbidden, NotFound)
```

**New dependency (1):** `react-router-dom`. Nothing else — charts will be small custom SVG components (§12) to keep the bundle and the visual identity fully in-house.

---

## 3. Inspector Portal Sitemap

> Purpose: **conduct inspections, analyze products, document evidence, submit results.** Action-first, minimal analytics.

```
/inspector  (Dashboard)
│   ├─ Stat cards: Total Inspections · Compliant · Non-Compliant · Pending Review
│   ├─ Primary CTA: "New Inspection"  + quick actions (Scan, History, Manufacturer, Reports)
│   └─ Recent inspections list (last 5) → detail
│
├── /inspector/inspections                (My Inspection History)
│   │      search + filters (date, product, manufacturer, status, ID) + table
│   └── /inspector/inspections/:id        (Inspection Detail, read-only after submit)
│          summary · extracted declarations · compliance result · evidence · report links
│
├── /inspector/inspections/new            (New Inspection — 5-step wizard, single route,
│   │                                      internal stepper, draft resumable)
│   │      1 Capture         upload/camera image of label
│   │      2 Extract+Checks  automated extraction (mocked) → structured declarations,
│   │                        then rule-based compliance findings (distinct stages)
│   │      3 Review          edit/confirm fields — extracted vs inspector-verified
│   │      4 Evidence     photos, highlighted areas, notes, attachments
│   │      5 Submit       final decision + summary → receipt
│   └── exit guard: confirm discard / save draft
│
├── /inspector/manufacturers              (Lookup — search + list, READ-ONLY)
│   └── /inspector/manufacturers/:id      (Profile — details, history, risk; NO admin actions)
│
├── /inspector/reports                    (Generate + list; PDF / editable download)
├── /inspector/settings                   (Profile, language, demo helpers)
└── errors → /unauthorized, * (NotFound)
```

Navigation (left sidebar, navy, green active state): **Dashboard · Inspections · Manufacturers · Reports · Settings**, with "New Inspection" as a persistent primary button above the nav (it's an action, not a destination).

Improvements over the proposed list: "New Inspection" is promoted to a CTA rather than a nav item; "Scan Product" folds into step 1 of the wizard instead of being a separate top-level item.

---

## 4. Government Portal Sitemap

> Purpose: **Monitor → Investigate → Manage → Enforce.** Department-wide visibility, analytics-first, case workflow.

```
/gov  (Command-Center Dashboard)
│   ├─ KPI band: inspections · compliance rate · violations · open cases
│   │            manufacturers · high-risk count · pending reviews
│   ├─ Trends (compliance over time, violations by category)
│   ├─ High-risk manufacturers watchlist · recent inspections feed
│   └─ Open enforcement cases queue preview
│
├── /gov/inspections                      (Department-wide monitoring)
│   │      filters: inspector, manufacturer, date, status, violation type
│   └── /gov/inspections/:id              (Full inspection review incl. evidence, read-only)
│
├── /gov/violations                       (Violation register: severity/status/type/location)
│
├── /gov/cases                            (Case & Enforcement queue — flagged cases first)
│   └── /gov/cases/:id                    (Case Review)
│          evidence · extracted data · inspector verification · violation & history timeline
│          → SYSTEM flag (advisory: repeated/severe violations) → "Recommended for Review"
│          → OFFICER decision (authoritative): No Action · Warning · Notice ·
│            Follow-up · Investigation · License Review · Suspension · Other
│          → every action recorded with reason (audit trail)
│
├── /gov/manufacturers                    (Management — full CRUD per permissions)
│   └── /gov/manufacturers/:id            (Profile: legal/trade name, GSTIN, license, contacts)
│       └── tab: Risk Profile             (explainable: factors that produced the level)
│
├── /gov/analytics                        (Compliance rate, violations over time & by category,
│   │                                      risk distribution, repeat offenders, geography, trends)
├── /gov/repository                       (Global search: product, manufacturer, GSTIN,
│   │                                      barcode, inspection ID, report ID, license no.)
├── /gov/reports                          (Department report generation)
├── /gov/settings
└── errors → /unauthorized, *
```

Navigation (same shell, distinct branding): **Dashboard · Inspections · Violations · Cases & Enforcement · Manufacturers · Analytics · Repository · Reports · Settings**, with a saffron/gold portal accent and "Department Command Center" topbar label — visibly a different world from the inspector's field tool.

Improvements over the proposed list: "Violations" and "Cases & Enforcement" are separate (the violation register feeds the case workflow — a judging-relevant distinction); "Reports" stays a small utility page since exports also live in context elsewhere; Admin is deferred (§12).

---

## 5. Feature Matrix

| Feature | Inspector | Government Officer | Admin (deferred) |
|---|:---:|:---:|:---:|
| Dashboard | Action-first, personal | Command-center, department-wide | — |
| Conduct new inspection | ✅ | ❌ (view-only) | ❌ |
| View inspections | Own only | All department | All |
| Review evidence | Own uploads | All inspections | All |
| Edit extracted fields (pre-submit) | ✅ | ❌ | ❌ |
| Final compliance decision (per inspection) | ✅ | ❌ | ❌ |
| Manufacturer search | ✅ read-only | ✅ full | ✅ |
| Create/edit manufacturer records | ❌ | ✅ per permission | ✅ |
| License status changes | ❌ | ✅ via workflow | ✅ |
| Violation register | Own inspections' | Full register | Full |
| Case review & enforcement action | ❌ | ✅ | ✅ |
| System flag → recommended for review (advisory) | ❌ (system-generated) | ✅ officer decides | — |
| Risk profile (explainable) | View-only | ✅ | ✅ |
| Department analytics | ❌ (by design) | ✅ | ✅ |
| Global repository search | ❌ | ✅ | ✅ |
| Report generate/download | Own reports | Department reports | All |
| Manage users/roles | ❌ | ❌ | ✅ |
| Audit trail access | ❌ | ✅ read | ✅ |

The separation is structural, not cosmetic: the inspector has **no route, no nav item, and no service method** for any government-only capability — and vice versa for conducting inspections.

---

## 6. Dashboard Wireframes

### Inspector Dashboard
```
┌──────────┬──────────────────────────────────────────────────────────────┐
│ LOGO     │  Inspector Portal            🔔   [AVG] R. Sharma ▾          │
│──────────│──────────────────────────────────────────────────────────────│
│ ▶ NEW    │  Good morning, Inspector Sharma          ◉ Portal: Operational│
│   INSPEC-│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐             │
│   TION   │  │ 124     │ │ 98      │ │ 19      │ │ 7       │             │
│──────────│  │ Inspec- │ │ Compli- │ │ Non-    │ │ Pending │             │
│ ▣ Dash-  │  │ tions   │ │ ant     │ │ compliant│ │ Review │             │
│ ▢ Inspec-│  └─────────┘ └─────────┘ └─────────┘ └─────────┘             │
│   tions  │                                                              │
│ ▢ Manu-  │  ┌─ Recent Inspections ────────────┐  ┌─ Quick Actions ────┐ │
│   fact-  │  │ #LM-1042  ⚠ Non-compliant  2h   │  │ ▸ Scan Product     │ │
│   urers  │  │ #LM-1041  ✓ Compliant      5h   │  │ ▸ Inspection Hist. │ │
│ ▢ Reports│  │ #LM-1040  ⚠ Warning        1d   │  │ ▸ Manufacturer     │ │
│ ▢ Sett-  │  │ #LM-1039  ✓ Compliant      1d   │  │   Lookup           │ │
│   ings   │  │ #LM-1038  ? Under review   2d   │  │ ▸ Reports          │ │
│          │  └────────────────────────────────┘  └────────────────────┘ │
│ (navy,   │                                                              │
│  green   │  ── inspector's own stats only — no department analytics ──  │
│  active) │                                                              │
└──────────┴──────────────────────────────────────────────────────────────┘
```

### Government Dashboard (Command Center)
```
┌──────────┬──────────────────────────────────────────────────────────────┐
│ LOGO     │  Department Command Center    [Dept: Food & Civil Supplies]  │
│──────────│──────────────────────────────────────────────────────────────│
│ ◎ Dash-  │ ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐                          │
│   board  │ │1240││88.4││217 ││ 38 ││ 412││ 14 │   KPI band w/ deltas     │
│ ▢ Inspec-│ │insp││% ok││viols││cases││mfrs││high│                          │
│   tions  │ └────┘└────┘└────┘└────┘└────┘└────┘                          │
│ ▢ Viol-  │ ┌─ Compliance Trend (12 wk) ─────┐ ┌─ Violations by Type ──┐ │
│   ations │ │        ╱╲    ___               │ │ ██████ MRP display 62 │ │
│ ▢ Cases &│ │   ___╱    ╲_╱                  │ │ █████ Net qty     48  │ │
│   Enf.   │ └────────────────────────────────┘ │ ████ Address     31   │ │
│ ▢ Manu-  │ ┌─ High-Risk Manufacturers ──────┐ │ ██ Other          19  │ │
│   fact-  │ │ ⬤ CRIT  M/s XYZ Foods   7 viol │ └───────────────────────┘ │
│   urers  │ │ ⬤ HIGH  ABC Pack      4 viol   │ ┌─ Open Cases ──────────┐ │
│ ▢ Analyt-│ │ ⬤ MODR  …                      │ │ CASE-077 ⚠ Severe  3d │ │
│   ics    │ └────────────────────────────────┘ │ CASE-071 ⚠ Major  1w  │ │
│ ▢ Repos- │ ┌─ Recent Inspections (dept-wide) ──────────────────────────┐ │
│   itory  │ │ inspector · product · manufacturer · status · violations  │ │
│ ▢ Reports│ └───────────────────────────────────────────────────────────┘ │
│ ▢ Sett-  │                                                              │
│   ings   │  ── analytics, geography, watchlist: GOV ONLY ──             │
└──────────┴──────────────────────────────────────────────────────────────┘
```

### Inspection — Extraction & Checks (wizard step 2, shared component reused in read-only views)
```
┌────────────────────────────────────────────────────────────────────────┐
│ ①Capture ─ ②Extract·Checks ─ ③Review ─ ④Evidence ─ ⑤Submit [Save Draft]│
│────────────────────────────────────────────────────────────────────────│
│ ┌─ Product Image ────────────┐  AUTOMATED EXTRACTION (what was detected) │
│ │ ┌────────────────────┐     │ ┌──────────────────────────────────────┐  │
│ │ │   [label photo]    │ ◱geo│ │ declaration    value       conf  bbox │  │
│ │ │  ▢ bounding box    │     │ │ MRP            ₹ 45.00      0.97  ▢   │  │
│ │ │  ▢ highlighted     │     │ │ Net Qty        500 ml       0.94  ▢   │  │
│ │ │    problem area    │     │ │ Mfg Date       02/2026      0.41  ▢   │  │
│ │ └────────────────────┘     │ │ FSSAI No.      illegible    0.22  ▢   │  │
│ │  re-upload / retake        │ └──────────────────────────────────────┘  │
│ └────────────────────────────┘                                           │
│ ┌ COMPLIANCE CHECKS — RULE FINDINGS (whether it satisfies the rule) ───┐ │
│ │ declaration │ pres │ value │ place │ read │ size │ violation · rule │ │
│ │ MRP         │  ✓   │   ✓   │   ✓   │  ✓   │  ✓   │ —                │ │
│ │ Net Qty     │  ✓   │   ✓   │   ⚠   │  ✓   │  ✓   │ placement §2(1)  │ │
│ │ Mfg Date    │  ✓   │   ⚠   │   ✓   │  ⚠   │  ✕   │ font size §9(4)  │ │
│ │ Best Before │  ✕   │   —   │   —   │  —   │  —   │ missing §6(3)    │ │
│ │ FSSAI No.   │  ✓   │   ?   │   ✓   │  ✕   │  —   │ illegible §2(1)  │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│  Legend: ✓ ok  ⚠ review  ✕ non-compliant  ? undetermined  — n/a         │
│  bbox overlay toggles · zoom · per-declaration evidence jump-links      │
└────────────────────────────────────────────────────────────────────────┘
```
(The four landing-page feature icons — Scan/Verify/Detect/Report — become the wizard's step icons, carrying the brand through.)

### Inspector Review (step 3)
```
│ Field             │ Extracted (AI)      │ Inspector verified        │ Chg │
│───────────────────┼─────────────────────┼───────────────────────────┼─────│
│ MRP               │ ₹45.00 (0.97)       │ [ ₹45.00        ] ✓match  │ ─   │
│ Net quantity      │ 500 ml  (0.94)      │ [ 500 ml        ] ✓match  │ ─   │
│ Mfg date          │ 02/2026 (0.41) ⚠    │ [ 02/2026       ] ✎edited │ ▲   │
│ Best before       │ — not found ✕       │ [ MISSING       ] confirm │ ─   │
│  provenance chip: "Extracted" (grey) vs "Verified" (green) per field    │
│ Notes [____________________]   Final decision: (●) Compliant ( ) Notice │
```

### Manufacturer Profile (shared; actions differ by role)
```
│ M/s Sundar Foods Pvt Ltd            [License: ACTIVE] [Risk: HIGH ⬤]   │
│ Legal/Trade name · GSTIN · Address · Contact · Categories               │
│ Tabs: Overview │ Inspections (14) │ Violations (5) │ Risk Profile │     │
│ Risk Profile (explainable, no black box):                               │
│   severity mix ▓▓▓░  recurrence ▓▓░░  recency ▓▓▓░  enforcement ▓░░░    │
│   "HIGH because: 5 violations in 6 months, 2 severe, 1 prior notice."   │
│ Inspector sees: read-only.     Gov sees: Edit record · License actions  │
```

### Case Review (Government)
```
│ CASE-077 · M/s XYZ Foods · §6(3) Missing Best-Before · SEVERE          │
│ ┌ Evidence & Data ──────────┐ ┌ Case Timeline ────────────────────────┐│
│ │ photos · bboxes · fields  │ │ SYSTEM flag (advisory): 3rd repeat    ││
│ │ inspector verification ✓  │ │   offense → "Recommended for Review"  ││
│ │ inspection link #LM-1042  │ │ ↓ assigned → Officer Kumar            ││
│ └───────────────────────────┘ │ ↓ [current] UNDER REVIEW              ││
│ ┌ History & Risk ───────────┐ │ ↓ OFFICER DECISION (authoritative):   ││
│ │ prev violations: 2 (list) │ │   No Action · Warning · Notice ·      ││
│ │ historical compliance ▁▃▂ │ │   Follow-up · Investigation ·         ││
│ │ risk: CRITICAL — because… │ │   License Review · Suspension · Other ││
│ │                           │ │   [ records action + written reason ] ││
│ └───────────────────────────┘ └───────────────────────────────────────┘│
```

---

## 7. Authentication Flow

### Frontend state machine (AuthContext)
```
status: 'loading' → 'unauthenticated' ⇄ 'authenticated'
user: { id, name, role: 'inspector'|'gov_officer', department, initials }
```
- `signIn(userId, password)` → authService (mock latency, `error123` failure preserved) → resolves user **with role** → router redirects by role.
- `signOut()` → clears session → redirect to `/` (landing) with a "signed out" toast.
- Session persisted in `sessionStorage` (demo); expiry → `SessionExpired` state → re-login.
- `VITE_DEMO_MODE=true` adds a clearly-labelled demo account picker on the login card (Inspector / Officer) so judges can enter each portal in one click. Hidden in normal builds; **not** a security mechanism — just a demo affordance.

### Route protection
- `<RequireAuth>` — no session → redirect `/` (login).
- `<RequireRole role='inspector'>` — wrong role → `/unauthorized` (403 screen with "return to my portal").
- Guard components are **UX only**. Real authorization contract (documented now, enforced in the backend phase):

  `Authenticated User → Authorized Application Role → Role-specific permissions → Database/API authorization policies`

  - The application role is a **server-side claim** on the auth identity (Supabase `app_metadata` / JWT claim) — **not** a separate PostgreSQL database role per portal, and **not** client state.
  - Data access is enforced by **Supabase Row Level Security policies that read the server-side claim**. The frontend can never grant itself elevated permissions by changing a client-side role value.
  - Inspector and Government Officer roles remain strictly separated at the policy level (every §5 matrix cell maps to a policy).
  - No credentials, tokens, or role logic hardcoded in the bundle.

### Required auth screens/states
| State | Screen |
|---|---|
| Invalid credentials | Existing inline error banner (landing) |
| Account exists, no role assigned | "Account pending role assignment" modal |
| Wrong portal | `/unauthorized` 403 screen |
| Session expired | Modal → re-login |
| Signed out | Toast + landing |
| Loading/refresh | Full-screen emblem splash (no layout flash) |

---

## 8. Design System (inherited from the landing page)

### Tokens (extend `variables.css`, never fork it)
| Token family | Source (landing) | App addition |
|---|---|---|
| Brand navy | `--navy-deep/mid/light`, `--gov-blue*` | sidebar bg `--navy-deep→mid` gradient, topbar white |
| Accent | `--accent-green #26d07c` | inspector active/CTA; **gov accent: saffron `--accent-saffron #f59e0b`** (subtle, ribbon-level only) |
| Status | — (new) | `--status-ok #16a34a` · `--status-warn #d97706` · `--status-bad #dc2626` · `--status-info #2563eb` · `--status-unknown #64748b` |
| Surfaces | `--bg-right #f0f4f9`, `--card-bg`, `--card-shadow`, `--card-border` | page bg = `--bg-right`; cards identical to login card |
| Radii | 6 / 10 / 14 / 22 | tables & inputs 10, cards 14, modals 22 |
| Type | Plus Jakarta Sans (headings) + Inter (body/data) | 12 / 13 / 14 / 19–22 / 28 scale, tabular numerals in tables |
| Motion | `--transition-fast/normal`, `anim-rise` | reuse; motion only on state change & page enter |

### Component set (all derived from landing primitives)
- **StatusBadge** ← from the four-declaration glyph language (✓ ⚠ ✕ ?) + status pill.
- **Card / StatCard** ← login card surface, shadow, radius.
- **PrimaryBtn** ← `.primary-login-btn` (navy gradient, arrow); SecondaryBtn ← `.sso-card-btn`; TextBtn ← `.forgot-password-link`.
- **DataTable** ← trust-strip row rhythm, Inter, sticky header, compact density.
- **Tabs** ← `LoginTabs` (pill-in-track, active underline).
- **Modal** ← generalized `DemoModal` (focus trap, Esc, restore).
- **AppShell**: fixed navy sidebar (emblem + portal label + user menu bottom) + white topbar (breadcrumb, portal badge, lang toggle, status pill). Inspector = green accents; Gov = saffron accents + denser layout.
- **Extracted vs Verified chip** (grey "Extracted" vs green "Verified" provenance per field), **DimensionChips** (presence · correctness · placement · readability · font size), **ConfidenceMeter**, **BBox overlay**, **Stepper**, **FilterBar**, **EmptyState**, **Toaster** (new, in the same language).
- Iconography: lucide only, 16/18/22 sizes; the four landing SVGs become section/wizard motifs.
- Empty/loading/error states are first-class: skeleton rows, `EmptyState` with action, error card with retry — no blank tables.

---

## 9. Data Requirements per Screen (frontend contracts only)

### Declaration data model (planned now so inspection screens never need redesign)

Every declaration in every inspection screen (analysis, review, detail — both portals) is modeled as:

```
Declaration
├── value            # extracted value (text/number)
├── confidence       # automated extraction confidence (0–1)
├── presence         # presence / completeness of the declaration (present · missing · partial)
├── correctness      # value correct / incorrect / unverifiable
├── placement        # label placement compliant?
├── readability      # legible print quality?
├── font_size        # meets minimum size requirement?
├── violation_type   # if non-compliant (missing · illegible · undersized · misplaced …)
├── rule_reference   # applicable rule (e.g. Rule 6(3), LM (PC) Rules 2011)
└── bounding_box     # detected region on the product image
```

This contract covers the SIH-required compliance dimensions explicitly: **presence, correctness, completeness** (via presence), **placement, readability, and font-size** compliance. Mock data populates all dimensions from Phase 3 onward. When OCR, font-size detection and placement detection arrive later, they fill these existing fields — the UI does not change.

| Screen | Needs |
|---|---|
| Inspector Dashboard | counts by status (own), recent 5 inspections (id, product, manufacturer, status, time) |
| Inspection Detail / Analysis | product image URL, declarations[] (declaration model above), compliance summary (per-declaration findings + overall result), evidence [{type, url, note}], inspector, timestamps |
| Inspection History | paged list + filters (date range, product, manufacturer, status, inspection ID) |
| New Inspection (draft) | draft id, captured image, analysis result (mock), review edits, evidence set, decision |
| Manufacturer Profile | legal/trade name, GSTIN, address, contact, license {no, status}, categories, inspections summary, violations summary, risk {level, factors[]} |
| Gov Dashboard | department KPIs + deltas, trend series, violations-by-category, watchlist, open cases, recent inspections |
| Violations register | severity, type, manufacturer, product, inspector, date, status, evidence ref |
| Case Review | case {id, status, timeline[]}, linked inspection (full), manufacturer history, risk explanation, action catalog |
| Enforcement queue | flagged cases with system-generated flag reasons (recurrence/severity) — advisory recommendations only; every decision is a recorded officer action |
| Analytics | pre-aggregated series: compliance rate over time, violations by category/time, risk distribution, repeat offenders, region breakdown |
| Repository | one query across products/manufacturers/inspections/violations/reports; field list per §4 |
| Reports | report metadata, generate payload, download formats (PDF / editable) |
| Auth/session | user profile {id, name, role, department}, session token/expiry (future) |

---

## 10. Future Backend Integration Points (identified, not built)

| Integration | Boundary (service) | Future implementation |
|---|---|---|
| Authentication | `authService` | Supabase Auth (email/password + optional MeriPehchaan SSO later); role from JWT claim; `@supabase/ssr` cookie session |
| Authorization | route guards + service layer | Supabase RLS policies + application roles/claims + server-side authorization (enforces every §5 matrix cell) |
| Automated extraction — WHAT was detected | `extractionService.analyze(image)` | Edge Function → OCR model; returns declarations with value, presence, confidence, bounding_box |
| Compliance engine — WHETHER it satisfies the rule | `complianceService.evaluate(declarations)` | Deterministic rules engine implementing LM (PC) Rules 2011; returns per-dimension findings (correctness, placement, readability, font_size), violation_type, rule_reference — strictly separate from extraction |
| Risk scoring | `manufacturersService.riskProfile(id)` | Deterministic, rule-based, explainable factors — **never** autonomous enforcement |
| Evidence storage | `evidenceService` | Supabase Storage buckets with signed URLs, per-role read policy |
| Reports | `reportsService` | Edge Function → PDF/DOCX generation |
| Monitoring realtime | `inspectionsService.subscribe` | Supabase Realtime channel for the Gov dashboard feed |
| Audit trail | `auditService` | Append-only audit table written on every enforcement action |

---

## 11. Implementation Roadmap

| Phase | Deliverable | Contents |
|---|---|---|
| **0. Foundations** | App skeleton | router + `AuthContext` + mock `authService` + AppShell (both portal themes) + design-system components (Card, StatCard, StatusBadge, DataTable, Tabs, Modal, EmptyState, Toaster) + landing/login wired into router |
| **1. Auth UX** | End-to-end login flow | role-based redirect, demo account picker (flagged), 403/404 screens, session-expiry modal, logout, splash |
| **2. Inspector portal core** | 5 pages | Dashboard, History (+detail), Manufacturer lookup (+profile read-only), Reports, Settings |
| **3. Inspection workflow** | Wizard | Capture → Extraction & Checks (mock declarations across all dimensions + rule findings) → Review (extracted vs verified) → Evidence → Submit + drafts + exit guard |
| **4. Government portal** | 8 pages | Command dashboard, Monitoring (+detail), Violations, Cases (+review + enforcement actions), Manufacturers (+edit + risk profile), Analytics, Repository |
| **5. Polish & i18n** | Ship-quality | Hindi for all app screens, a11y pass (keyboard, aria-live), responsive (desktop-first, tablet, mobile fallback), density for short screens, empty/loading/error states everywhere |
| **6. Backend integration** | Real data | Swap mock adapters → Supabase (auth, RLS, storage, realtime) per §10 |
| **7. Intelligence** | AI layer | OCR + compliance engine + risk signals behind the same services |

Phases 0–4 are pure frontend and demo-ready with mock data; 5–7 progressively make it real.

---

## 12. Recommendations

1. **Demo role picker (flagged, judge-friendly):** one click into each portal during SIH judging — implemented as a visible "Demo mode" affordance, not a hidden bypass.
2. **Explainable risk as a first-class component:** rule-factor bars + a one-sentence justification on every risk display. Judges will look for exactly this ("AI must not autonomously decide enforcement").
3. **Enforcement audit trail visible in the UI:** every case action shows who/when/why — turns a UI into governance evidence.
4. **Reuse the four landing feature icons as the wizard steps and section motifs** — cheapest possible "one product" signal.
5. **Hand-rolled SVG charts (trend line, category bars, risk donut)** instead of a chart library: ~3 tiny components, perfect style match, tiny bundle. Revisit only if analytics grow.
6. **Skip a separate Admin portal for SIH.** Model an Admin as a Government Officer with elevated permissions; add a user-management screen only if time remains.
7. **Keep bilingual dashboards.** Extending LanguageContext with `inspector.*` / `gov.*` namespaces is high-judging-value, low-cost.
8. **Deliberately NOT building:** real charts infra, notification center, multi-language beyond EN/HI, mobile-native capture flow — all out of scope until the core two portals are flawless.

---

## 13. Secondary Reference Integration (10-screen UI/UX reference)

**Status:** adopted as the secondary reference for the authenticated app. The landing page remains the primary branding source; the reference contributes workflow + layout patterns. The approved architecture, role separation, sitemaps and roadmap are unchanged.

### Screen-by-screen disposition (Inspector portal)
| # | Reference screen | Disposition |
|---|---|---|
| 1 | Login | **Skipped** — existing landing/login is the primary design and is not modified |
| 2 | Dashboard | **Adopted** — icon-chip stat cards (inspections / compliant / non-compliant / pending reports), dual-line inspections trend (compliant vs non-compliant), recent-inspections list with "View all", 2×2 Quick Actions grid, prominent New Inspection CTA (already in sidebar) |
| 3 | Profile (My Profile) | **Adopted** — shared profile page for both portals: avatar, name/role/department, Employee ID, Email, Phone, Department, Designation, Region, Date of Joining, Digital Signature status (✓ Registered), Edit Profile (mock), breadcrumb |
| 4 | New Inspection (details form) | **Adopted as wizard step 1** — Retailer/Establishment, License no. (optional), Address, Location (+ Detect Location mock), Inspection type radio (Routine / Complaint / Special Drive), Date, Time, Remarks → Start Inspection |
| 5 | Scan / Upload Product | **Adopted as wizard step 2** — Scan Barcode / Upload Image tabs, framed preview with corner brackets, barcode result + basic detected product card |
| 6 | AI Extraction & Review | **Adopted as wizard step 3** — product image + "Extracted Details (Automated)" field list with confidence, per-field Edit, provenance chips (Extracted vs Inspector-verified) — terminology keeps extraction separate from compliance |
| 7 | Compliance Check | **Adopted as wizard step 4** — professional table: Check · Rule Reference · Status · Remarks, with expandable per-check dimension detail (presence · correctness · placement · readability · font-size · confidence · bounding box · evidence) — the §9 declaration contract, surfaced |
| 8 | Evidence / Review | **Adopted as wizard step 5** — photo grid, additional evidence, highlighted violation regions (bbox overlay), inspector notes, confirmation checkbox |
| 8b | Inspection Report | **Adopted as wizard step 6** — report layout with ID, inspector, date/time, establishment, product, manufacturer, compliance result (donut + checks passed), violations, evidence, remarks, Download PDF / Editable report (mock toasts); on submit the inspection is prepended to history |
| 9 | Inspection History | **Adopted** — status tab segments (All / Compliant / Non-Compliant / Pending), search, table with Establishment column, View details action |
| 10 | Manufacturer Lookup | **Already implemented** (read-only lookup + profile) — restyled only where the reference improves it |
| 10b | Reports & Analytics | **Adopted** as Inspector Reports — stat band (Total / Compliance rate / Non-Compliant / Products checked), compliance-distribution donut, Top Non-Compliance Issues bar list, report records with downloads |

### Explicitly skipped (reference features not in the approved IA)
- **Products Database** nav item — for inspectors this duplicates Manufacturer Lookup; for government it is covered by Repository (Phase 4).
- **Notifications center** — topbar bell is a badge affordance only (demo toast); no page.
- **Help & Support** page — out of scope.
- **Map/location service** — "Detect Location" is a visual mock, no real geocoding.

### Government portal
Structure retained exactly (Command Dashboard, Inspections, Violations, Cases, Manufacturers, Analytics, Repository, Reports, Profile, Settings). From the reference it inherits only the shared shell upgrades: top search bar, notification bell, user chip, stat-card icon chips, donut/bar chart language. Enforcement decisions remain officer-controlled; system flags stay advisory. Gov Analytics/Repository/Reports remain Phase 4 deliverables.
