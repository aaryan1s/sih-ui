# Legal Metrology Compliance System — SIH Prototype

An AI-enabled solution for checking compliance of packaged commodities under the **Legal Metrology (Packaged Commodities) Rules, 2011** (Department of Consumer Affairs, Ministry of Consumer Affairs, Food & Public Distribution, Government of India).

Built as a high-fidelity frontend prototype for the **Smart India Hackathon (SIH)**.

---

## 🚀 Features

- **Split Screen Layout**:
  - **Left Hero (54%)**: Photographic supermarket backdrop with packaged goods inspection label, barcode, and green compliance stamp (`COMPLIANT MARKET STRONGER INDIA`), official Government of India Ashoka emblem branding, hero typography, 4 circular feature blocks (Scan Products, Verify Declarations, Detect Violations, Generate Reports), and bottom trust badges (*Fair Trade*, *Accountable Markets*, *Safe & Transparent*).
  - **Right Login Panel (46%)**: Centered **Inspector Login Card** with circular lock icon, dual-tab switcher (Credentials vs Govt. SSO), User ID/Email input with clear action, Password input with visibility toggle, "Remember me" checkbox, Forgot Password action, primary login action with loading/authenticated/error demo state, and alternative SSO cards for **Aadhaar** and **DigiLocker**.
- **Bilingual (English / हिंदी)**: One-click language toggle switches every string on the page and syncs `document.title` and `lang` attributes.
- **Motion & Polish**: Staggered entrance animations, animated AI scan-line over the packaged-commodity showcase, ambient background orbs, pulsing portal-status pill, and full `prefers-reduced-motion` support.
- **Trust Signals**: Impact statistics row (inspections, accuracy, avg. time), live portal-status indicator, and the "AI Scanning" badge over the showcase image.
- **Login UX**: Inline field validation with error/warning states, Caps Lock detection, error demo state (password `error123`), and a unified accessible demo modal replacing all `alert()` dialogs.
- **Accessibility**: Skip-to-content link, focus-trapped dialogs with Esc close and focus restoration, arrow-key tab navigation with proper ARIA tab semantics, visible focus rings, and `aria-live` status/error regions.
- **Responsive & Zoom-Proof**:
  - **Unified single-page flow** — both columns grow with their content and scroll together as one page; no internal scroll panes, nothing clipped at any zoom level (100%, 90%, 80%…).
  - Fluid `clamp()`-based typography, gutters, and component sizing adapt continuously from large desktops down to small laptops.
  - Compact card density automatically kicks in on short laptop viewports (≤820px height) so the login card and footer fully fit at 100% zoom.
  - Product showcase scales proportionally at every zoom level (aspect-ratio locked, no crops).
  - Stacks vertically on tablets/mobile (≤1024px) with zero horizontal overflow on phones from 320px to 414px.
- **Frontend Architecture**:
  - React 19 + Vite.
  - Vanilla CSS design tokens (`variables.css`, `landing.css`, `left-hero.css`, `login-card.css`).
  - Lucide React icon library.

---

## 🛠️ Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your browser.

### 3. Build for Production
```bash
npm run build
```

### 4. Preview Production Build
```bash
npm run preview
```

---

## 📂 Project Structure

```
├── index.html                   # Entry HTML with Google Fonts & Indian Emblem favicon
├── package.json                 # Dependencies & build scripts
├── vite.config.js               # Vite config
├── public/
│   └── assets/                  # High-res visual assets & logos
│       ├── aadhaar-logo.png
│       ├── digilocker-logo.png
│       ├── india-emblem.png
│       ├── jago-grahak-jago.png
│       ├── packaged-product.jpg
│       ├── parliament-illustration.png
│       ├── tricolor-left.png
│       └── tricolor-right.png
└── src/
    ├── main.jsx                 # React root
    ├── App.jsx                  # Language provider, skip link, main split container
    ├── context/
    │   └── LanguageContext.jsx  # EN/HI translations & language state
    ├── styles/
    │   ├── variables.css        # Color palette, spacing, shadows
    │   ├── reset.css            # Base reset, sr-only, skip link, reduced motion
    │   ├── landing.css          # Split 54/46 proportion, anim utilities & responsive queries
    │   ├── left-hero.css        # Left hero, scan-line, orbs, stats, package showcase
    │   └── login-card.css       # Login card, lang toggle, error states & right panel styling
    └── components/
        ├── common/
        │   ├── Logos.jsx        # SVG logos for Aadhaar, DigiLocker, Emblem, Flag
        │   └── DemoModal.jsx    # Accessible focus-trapped demo dialog
        ├── LeftHero/
        │   ├── LeftHero.jsx
        │   ├── GovHeader.jsx
        │   ├── HeroTitle.jsx
        │   ├── FeatureCardsRow.jsx
        │   ├── StatsRow.jsx
        │   └── TrustStrip.jsx
        └── RightLogin/
            ├── RightLogin.jsx
            ├── JagoGrahakHeader.jsx
            ├── LangToggle.jsx
            ├── InspectorLoginCard.jsx
            ├── LoginTabs.jsx
            ├── LoginForm.jsx
            ├── SSOCards.jsx
            ├── CardFooter.jsx
            └── ParliamentFooter.jsx
```
