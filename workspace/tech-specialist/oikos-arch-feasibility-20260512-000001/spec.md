# Oikos — Technical Architecture & Feasibility Spec

**Produced by:** Tech Specialist
**Task slug:** oikos-arch-feasibility-20260512-000001
**Date:** 2026-05-12
**Status:** Planning phase — no implementation started

---

## 1. Recommended Tech Stack

### Backend: Python + FastAPI

**Rationale:**
- FastAPI is async-native, which matters for Oikos's Claude API calls — multiple modules (finance analysis, gardening agent, savings suggestions) will be waiting on external HTTP responses. Synchronous Django would block on each.
- Python's ecosystem dominates in the libraries Oikos needs: Tesseract/EasyOCR/PaddleOCR, Pillow, financial calculation libs, barcode-adjacent tooling.
- Auto-generated OpenAPI docs via FastAPI aid iterative development for a solo dev.
- Pydantic v2 (bundled with FastAPI) gives strong data validation for financial figures with no extra cost.
- FastAPI + SQLAlchemy (async) + Alembic is a mature, stable combination in 2026.

**Weaknesses:**
- No built-in admin UI (Django has this). A simple admin panel (e.g. SQLAdmin) must be added separately if needed.
- More boilerplate for forms/auth compared to Django's batteries-included approach.

**Alternative considered: Django + Django REST Framework**
DRF is the obvious alternative. It wins on built-in admin, ORM maturity, and quicker scaffolding for CRUD. It loses on async support — Django's ORM async story is still partial in 2026, and Oikos will have multiple Claude API call paths that benefit from async I/O. FastAPI is the better fit here.

---

### Database: PostgreSQL (via SQLAlchemy async + Alembic migrations)

**Rationale:**
- Oikos is not a trivial read-only app. Finance Manager requires reliable concurrent writes (expense imports), full-text search on recipes, and potential complex joins across modules. PostgreSQL handles all of these cleanly.
- Finance data (account balances, transactions) deserves ACID guarantees. SQLite's serialized writer is adequate for single-user load, but PostgreSQL's JSON column support (for flexible expense metadata) and native date arithmetic are clear wins.
- SQLite is tempting for zero-ops setup (no Docker service), but the lack of native full-text search and its inability to handle schema migrations cleanly under file locking make it harder to maintain long-term.

**Weaknesses:**
- Requires running a Postgres service (Docker Compose adds one line; this is not a real problem for a server app).
- Slightly heavier local dev setup vs. SQLite.

**Alternative considered: SQLite**
Appropriate for a truly minimal read-heavy app. Rejected because Oikos has finance, recipes, pantry, investments — five+ modules writing regularly — and the risk of "SQLite worked fine until I added bulk expense import" is real. PostgreSQL from day one avoids a painful migration later.

---

### Frontend: SvelteKit

**Rationale:**
- SvelteKit produces smaller bundles than React equivalents, which matters for a self-hosted server where the user accesses the app from phone browsers (mobile-friendly requirement).
- The compile-to-vanilla-JS model means no runtime overhead; interactions like pantry scan UI and recipe image upload feel snappy even on slower connections.
- SvelteKit ships routing, SSR, API routes, and form handling out of the box — no need to assemble a React + React Router + React Query stack.
- Svelte's reactivity model (simple `$state`, no hooks, no dependency arrays) reduces cognitive overhead for a single developer iterating across 8 modules.
- In 2026, Svelte 5 is stable; the runes-based reactivity is production-ready.

**Weaknesses:**
- Ecosystem is smaller than React. UI component libraries (e.g. shadcn-svelte, Skeleton) are fewer and less mature than React equivalents.
- Camera/barcode scanner JavaScript libraries (ZXing, Quagga2) are JS-first and will need manual integration, but this is not SvelteKit-specific.

**Alternative considered: React + Vite (no Next.js)**
A React SPA with Vite is a valid choice with a larger ecosystem. Rejected because for a solo developer maintaining 8 modules, SvelteKit's simpler mental model and routing-included setup outweigh React's ecosystem advantages. Oikos is not a team project.

---

### Deployment: Docker Compose

Single `docker-compose.yml` with:
- `api` — FastAPI + Uvicorn
- `db` — PostgreSQL 16
- `frontend` — SvelteKit static build served via Nginx (or Caddy for HTTPS)
- `redis` (optional, see open questions) — for task queue

This is the standard self-hosted personal server setup in 2026: reproducible, easy to backup (`pg_dump`), and restartable.

---

## 2. Architecture Overview

```
Browser (SvelteKit SPA)
        │
        │ HTTPS
        ▼
  Nginx / Caddy (reverse proxy)
        │
   ┌────┴──────────────────────┐
   │     FastAPI Application    │
   │                            │
   │  /pantry    ──► Pantry Svc │
   │  /recipes   ──► Recipe Svc │
   │  /finance   ──► Finance Svc│
   │  /plants    ──► Plant Svc  │
   │  /shopping  ──► Shopping   │
   │  /ai        ──► AI Gateway │
   │                    │       │
   └────────────────────┼───────┘
                        │
             ┌──────────┴──────────┐
             │                     │
       Claude API              PostgreSQL
     (claude-3-5-sonnet         (all data)
      or claude-opus-4)
             │
      ┌──────┴──────┐
      │             │
  Finance       Gardening
  Analyst       Specialist
  (tool use)    (agent w/
                plant data
                as context)
```

**Data flow highlights:**

- **Pantry scan:** Browser camera → ZXing (JS barcode decode) → API `/pantry/scan` → Open Food Facts API lookup → product stored in DB.
- **Recipe OCR:** Image upload → FastAPI `/recipes/ocr` → EasyOCR (server-side) → extracted text → optional DeepL translation → structured recipe stored in DB.
- **Finance import:** CSV/PDF upload or manual entry → `/finance/import` → categorization (rule-based first, Claude API as fallback for ambiguous entries) → stored in DB.
- **Claude AI calls:** Routed through an `AIGateway` service class that wraps the Anthropic SDK, handles prompt construction, and manages context. All modules call this gateway — they do not call Anthropic directly.
- **Shopping list generation:** Read-only query over pantry state → low-stock/missing items → Shopping List module. No AI needed here.

---

## 3. Key Third-Party Integrations

### 3.1 Barcode Scanning — Open Food Facts

- **Library:** Open Food Facts REST API (no key required). Endpoint: `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`
- **Coverage:** 4M+ products globally; German EAN barcodes (EAN-13) have reasonable coverage for major supermarket products, but niche or store-brand items may be missing.
- **Gap strategy:** If OFF returns no result, fall back to a manual entry form. Consider a `product_source: "manual" | "off" | "user"` field on pantry items.
- **In-browser scanning:** Use **ZXing-js** (`@zxing/library`) or **html5-qrcode** library. ZXing-js is the more actively maintained option in 2026 and supports EAN-13, EAN-8, UPC-A. The browser requests camera access via `getUserMedia`. Works on all modern mobile browsers including iOS Safari (with HTTPS — mandatory).
  - **Important:** Camera access requires HTTPS. Local dev must use `localhost` (browsers exempt this) or a self-signed cert. Production must have TLS.

### 3.2 Recipe OCR

**Recommended: EasyOCR (server-side, Python)**

- Supports 80+ languages including German; no API key; self-hosted.
- Better multilingual performance than Tesseract for mixed German/English recipe cards.
- For **printed recipe cards/books**: EasyOCR accuracy is good (>90% on clean scans).
- For **handwritten recipe cards**: EasyOCR achieves ~84% character accuracy (CER ~0.16), which is acceptable for a first-pass extract-and-correct workflow. Full automated parsing of handwriting is unreliable — the UX should always show the extracted text for user review before saving.
- **Post-OCR ingredient parsing:** Rule-based regex first (quantity + unit + ingredient name is a well-understood pattern). Claude API can handle ambiguous cases (e.g. "1 EL Mehl" → "1 tablespoon flour").

**Model:** `easyocr.Reader(['de', 'en'])` — load both German and English models.

**Alternative considered: Google Vision API / AWS Textract**
Higher accuracy for handwriting, but adds cloud dependency and cost per image. For personal use at low volume, EasyOCR self-hosted is sufficient.

### 3.3 Translation — DeepL API

- **Why DeepL over Google Translate:** DeepL produces markedly more natural German output; for a German-language user translating recipes from English (or vice versa), quality difference is noticeable.
- **Pricing:** Free tier: 500,000 characters/month. For personal recipe translation this is effectively unlimited.
- **Integration:** Python `deepl` library (official SDK). Use lazily — only translate when user explicitly requests it, not automatically on every import.
- **Scope:** Recipe titles, ingredient names, preparation steps. Do not translate category tags or system fields.

### 3.4 Claude API — Anthropic

Three distinct use cases, each with different requirements:

| Use case | Module | Pattern | Model suggestion |
|---|---|---|---|
| Finance export & analysis | Finance Manager | Single-turn with structured JSON export as context | claude-sonnet-4-5 (cost-efficient) |
| Savings suggestions | Spending Analysis | Single-turn with categorized expense summary | claude-sonnet-4-5 |
| Gardening specialist | Plant & Garden | Multi-turn agent with plant data as tool context | claude-opus-4 (quality) or claude-sonnet-4-5 |

- **Finance analysis:** Export full transaction history as structured JSON, include account balances and planned purchases. Send as a single large prompt. Use prompt caching (cache the static system prompt + data schema).
- **Gardening agent:** Give Claude tool access to query the plant database (current watering status, last fertilized, local weather). This is an agentic pattern: Claude decides what data to fetch, formulates recommendations.
- **Integration:** All via `anthropic` Python SDK. Use `AsyncAnthropic` client to keep FastAPI non-blocking.

---

## 4. Technical Risks

### Risk 1: OCR Quality on Recipe Photos — HIGH RISK, must prototype
Recipe photos taken by phone camera vary enormously (lighting, angle, font, handwriting). EasyOCR performance on clean printed books is reliable, but ingredient extraction — splitting quantity, unit, ingredient name across varied formats — requires significant post-processing logic. This is the highest-effort feature to get right.

**Mitigation:** Build a "review before save" flow as the default. Never fully automate recipe import. Show raw OCR output, highlight detected ingredients, let user correct. Autosave is a nice-to-have only after accuracy is proven.

### Risk 2: Barcode Coverage Gaps for German Products — MEDIUM RISK
Open Food Facts has variable coverage for German store-brand products (Aldi, Lidl, Rewe own-label). Some barcodes will return no data.

**Mitigation:** Manual entry fallback is mandatory, not optional. Consider a "contribute back" flow using the Open Food Facts write API for user-added products (optional but valuable for the community).

### Risk 3: Finance Import Format Variety — MEDIUM RISK
German banks (DKB, ING, Sparkasse, Comdirect) each export CSV or MT940 in different formats. Automatic categorization is only useful if import parsing is reliable.

**Mitigation:** Start with a single bank format (whichever Alex uses). Build a pluggable importer interface so additional formats can be added. The importer maps raw rows to a canonical `Transaction` schema before categorization runs.

### Risk 4: Browser Camera API on iOS — MEDIUM RISK
iOS Safari requires HTTPS for `getUserMedia`. On a local home network, this means either:
a) Setting up a domain + Let's Encrypt cert (recommended for production), or
b) Using a self-signed cert (browser will warn, user must accept).

**Mitigation:** Document the HTTPS requirement explicitly in the setup guide. Docker Compose + Caddy handles Let's Encrypt automatically if the server has a public domain.

### Risk 5: Claude API Latency in Gardening Agent — LOW RISK
Multi-turn agentic calls can take 5–15 seconds per response. For a gardening specialist chat, this is acceptable — users expect AI to take a moment.

**Mitigation:** Show a loading indicator. Stream responses using `AsyncAnthropic` streaming API for perceived responsiveness.

### Risk 6: Investment Calculation Accuracy — LOW RISK, HIGH STAKES
Bausparvertrag calculations involve contractual terms (Zuteilung, Bonuszinsen, Guthabenzins). A generic compound interest formula will be wrong.

**Mitigation:** Do not attempt to "calculate" Bausparvertrag dynamically. Import the official annual statement and track it as a data point. Show growth charts from imported data, not computed projections (unless user manually inputs the contractual terms).

---

## 5. Module Dependency Map

Build in this order. Each tier depends on the one above it.

```
Tier 0 — Foundation (build first)
├── Database schema + migrations (Alembic)
├── Auth (single-user session, simple JWT or session cookie)
└── AI Gateway (wrapper around Anthropic SDK)

Tier 1 — Core data modules (independent of each other)
├── Pantry Manager (barcode scan → product → pantry item + expiry)
├── Recipe Manager (OCR pipeline → recipe CRUD)
└── Finance Manager (import → transactions → accounts)

Tier 2 — Derived modules (depend on Tier 1)
├── Shopping List Creator (depends on: Pantry)
├── Spending Analysis (depends on: Finance Manager)
└── Financing Manager (depends on: Finance Manager schema)

Tier 3 — Advanced / AI-heavy modules (depend on Tier 0 + Tier 1)
├── Savings Suggestions (depends on: Finance Manager + AI Gateway)
├── Investment Management (depends on: Finance Manager)
└── Plant & Gardening Manager (depends on: AI Gateway)
```

**Recommended build sequence:** Tier 0 → Pantry Manager → Finance Manager → Recipe Manager → Shopping List → Spending Analysis → remaining modules.

Rationale: Pantry and Finance deliver immediate daily-use value. Recipe Manager's OCR pipeline is the highest technical risk and benefits from being built while the team is still ramping up, not at the end.

---

## 6. Open Questions

These require user input before implementation can start on the affected modules.

| # | Question | Affects | Why it matters |
|---|---|---|---|
| OQ-1 | Which bank(s) does Alex use? What export format do they provide (CSV, MT940, CAMT.053)? | Finance Manager importer | Determines which parser to build first |
| OQ-2 | Should recipe OCR handle handwritten cards as a first-class feature, or only printed books/cards? | Recipe Manager UX & OCR model choice | Handwriting needs different UX (always manual review); printed can attempt auto-parse |
| OQ-3 | Does the server have a public domain name, or is it LAN-only? | Barcode scanning (HTTPS), Caddy config | Affects TLS strategy |
| OQ-4 | Should the Gardening Specialist be a chat interface, or a periodic "report" pushed to the user? | Plant & Garden module UX | Chat = streaming agent; report = scheduled job with Claude call |
| OQ-5 | What is the source of weather/humidity data for gardening? Local sensor (e.g. Home Assistant), open weather API, or manual input? | Plant & Garden watering logic | Determines whether a weather API integration is needed |
| OQ-6 | Should the app support multiple user accounts, or strictly single-user forever? | Auth design | Single-user allows simpler auth (one API key, one session); multi-user needs proper user table and row-level security |
| OQ-7 | For Investment Management: are we tracking passive index funds (ETFs), individual stocks, Bausparvertrag, or all three? | Investment module data model | ETFs need ISIN/price feed; Bausparvertrag is manual entry; stocks need a market data API |

---

## Appendix: Technology Summary

| Layer | Choice | Key library/version |
|---|---|---|
| Backend language | Python 3.12+ | — |
| Backend framework | FastAPI | fastapi ≥ 0.115 |
| ORM | SQLAlchemy (async) | sqlalchemy ≥ 2.0 |
| Migrations | Alembic | alembic ≥ 1.13 |
| Database | PostgreSQL 16 | — |
| Frontend framework | SvelteKit | svelte ≥ 5.0, @sveltejs/kit ≥ 2.0 |
| Reverse proxy | Caddy 2 (or Nginx) | — |
| Container orchestration | Docker Compose | docker-compose ≥ 2.0 |
| Barcode scanning (browser) | ZXing-js | @zxing/library ≥ 0.20 |
| OCR (server) | EasyOCR | easyocr ≥ 1.7 |
| Translation | DeepL API | deepl ≥ 1.18 |
| Food database | Open Food Facts REST API | No key required |
| AI integration | Anthropic Python SDK | anthropic ≥ 0.28, AsyncAnthropic |
| Image handling | Pillow | pillow ≥ 10.0 |
