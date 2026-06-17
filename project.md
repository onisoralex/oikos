# Project Brief — Oikos

The Mind reads this file at the start of every session. Keep it non-technical and high-level — the "what and why." Technical decisions belong in `mind/decisions.md`; implementation details belong in `docs/architecture.md`.

---

## What we're building

Oikos is a personal home management server with a web frontend. It consolidates eight areas of household life into one self-hosted application:

1. **Pantry tracker** — track what's in the house, quantities, and expiry dates
2. **Recipe manager** — store, organise, and rate recipes; extract from photos
3. **Finance manager** — track accounts, import bank statements, plan spending
4. **Financing manager** — track large purchases on installment/credit plans
5. **Shopping list** — auto-generated from pantry state, plus manual additions
6. **Spending analysis** — categorised expense summaries and savings suggestions
7. **Investment management** — track ETFs, Bausparvertrag, savings goals
8. **Plant & gardening manager** — care schedules, watering, fertilisation, AI gardening specialist

AI features (savings suggestions, recipe OCR, gardening chat) run via the `claude -p` CLI — no Anthropic SDK in the app.

## Who it's for

Single user: Alex. Personal home server on a local network. No multi-user support planned for v1.

## Goals

- One place for household inventory, finances, and plant care — currently spread across notes, spreadsheets, and memory
- Reduce food waste through expiry tracking
- Understand and improve personal spending patterns
- Automate the tedious parts (shopping list generation, bank import deduplication, recipe extraction from photos)

## Key constraints

- Self-hosted on a home server — must run via Docker Compose, no cloud dependencies
- Single developer (Alex) building and maintaining it — keep complexity proportional
- AI features use `claude -p` CLI subprocess, not a managed API integration
- No live bank connection — finance import is file-based only

## Out of scope (v1)

- Multi-user accounts
- Mobile native app (web app served by the backend, mobile-first responsive design)
- Barcode scanning (manual pantry entry in v1; barcode scanning is an optional enhancement pending OQ-3)
- Live bank/investment sync
- Push notifications

## Current state — last updated 2026-05-27

**Phase 0 (Foundation) — complete.** Full stack scaffold: Docker Compose, Express + Vite middleware, Prisma + PostgreSQL, JWT single-user auth, Claude CLI wrapper.

**Phase 1 (Pantry) — complete, not yet run.** Backend and frontend are both built but the app has never been started. First boot is the immediate next step.

**The app has never been started.** Do this first:
1. `cd projects/oikos/app`
2. Copy `.env.example` to `.env` and set `APP_PASSWORD`, `JWT_SECRET`, `POSTGRES_PASSWORD`
3. `docker compose up --build`
4. Open `http://localhost:3001` — login, add a pantry item, verify the expiry badge
5. Fix any TypeScript or boot errors that surface, then the pantry module is done

**After first successful run:** define Phase 2. Most natural next modules are **Shopping List** (depends on pantry data) or **Recipes**. Spawn a Tech Specialist to produce `docs/specs/02-<module>.md`, then a Developer to implement it.

**Known gap to address at some point:** `ProductDetailPage` "View pantry items" link passes `?product_id=` but the backend list endpoint doesn't filter by it yet. One extra WHERE clause in `pantry.service.ts` — easy to add when ProductDetail is actually used.

---

## References

- Tech stack and architectural decisions: `mind/decisions.md`
- System architecture and folder structure: `docs/architecture.md`
- Module implementation specs: `docs/specs/`
- Phase-by-phase build plan: `mind/roadmap.md`
- Deferred decisions: `mind/open-questions.md`
