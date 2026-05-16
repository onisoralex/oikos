# Oikos — Development Roadmap

Tracks module-level progress. Update status as work moves forward.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Phase 0 — Foundation
_Tier 0: everything else depends on this._

- [ ] Docker Compose setup (api + db + frontend services)
- [ ] Dockerfile for backend (Node.js + Express, nodemon for dev)
- [ ] Dockerfile for frontend (React + Vite + MUI, HMR for dev)
- [ ] PostgreSQL setup + connection pool
- [ ] Alembic-equivalent migrations (using a Node.js migration tool, e.g. db-migrate or node-pg-migrate)
- [ ] Express app scaffold (routing structure, error handling middleware, health endpoint)
- [ ] React + Vite + MUI scaffold (routing, layout shell, theme)
- [ ] Single-user auth (session cookie or JWT)
- [ ] Claude CLI wrapper (`exec`-based, supports single-turn, session-based, and file-context invocations)

---

## Phase 1 — Pantry Module
_First feature module. No dependencies on other modules._

- [ ] Product data model (name, barcode, category, nutritional info, source)
- [ ] Pantry item data model (product, quantity, unit, expiry date, location)
- [ ] Pantry CRUD API (add, update, remove, list)
- [ ] Manual item entry: name, size/unit (e.g. 200g, 500ml, 1 small jar), quantity, expiry date, location
- [ ] Expiry date tracking + warning logic (configurable threshold)
- [ ] Pantry UI (list view, expiry highlights, manual entry form)
- [ ] _(optional, v1+)_ Open Food Facts integration (barcode → product lookup) — depends on OQ-3 (HTTPS)
- [ ] _(optional, v1+)_ In-browser barcode scanner (ZXing-WASM via camera) — depends on OQ-3 (HTTPS)

---

## Phase 2 — Recipe Module
_Independent of Phase 1._

- [ ] Recipe data model (title, ingredients, steps, times, categories, ratings, source)
- [ ] Ingredient data model (quantity, unit, name, notes)
- [ ] Recipe image upload → Claude vision OCR → structured extraction
- [ ] Translation via `claude -p --haiku`
- [ ] Recipe CRUD API
- [ ] Rating system (easiness, taste — per recipe, averaged)
- [ ] Category tagging + calorie filter
- [ ] Recipe UI (list, detail, image upload flow, rating form, filters)

---

## Phase 3 — Finance Module
_Independent of Phases 1–2._

- [ ] Account data model (name, type: giro/savings/bauspar/investment, balance, currency)
- [ ] Transaction data model (date, amount, description, category, account, raw_hash for dedup)
- [ ] File importer (MT940 / CAMT.053 / CSV — format TBD from sample file)
- [ ] Deduplication logic (skip existing entries on re-import)
- [ ] Manual transaction entry
- [ ] Planned spending tracker (item, estimated cost, target date, status)
- [ ] Finance UI (account overview, transaction list, import flow, planned spending)

---

## Phase 4 — Derived Modules
_Depend on Phase 1 (pantry) and/or Phase 3 (finance)._

- [ ] **Shopping List** — auto-generate from pantry low-stock / missing items; manual additions
- [ ] **Spending Analysis** — categorized expense summary, charts
- [ ] **Financing Manager** — large purchase installment/financing tracking (extends finance schema)

---

## Phase 5 — Advanced / AI Modules
_Depend on Phases 3–4 and Claude CLI wrapper._

- [ ] **Savings Suggestions** — export finance data → `claude -p` analysis → recommendations
- [ ] **Investment Management** — ETF/stock/Bausparvertrag tracking (scope TBD per OQ-7)
- [ ] **Plant & Gardening Manager** — plant CRUD, Perenual API integration, watering/fertilization tracker
- [ ] **Gardening Specialist AI** — `claude -p --session-id` chat with plant context; agentic Claude Code mode

---

## Deferred / Pending Decisions

- OpenFarm repo as local data source (repo available; check if DB seed data is usable)
- Weather/humidity data source for watering logic (OQ-5)
- Investment asset scope (OQ-7)
