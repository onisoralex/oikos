# Project Brief

---

## What we're building

**Oikos** — a home & life management server application with a web frontend. It covers:

1. **Pantry Manager** — barcode scanning, expiration date tracking
2. **Recipe Manager** — image import with text/ingredient extraction, translation, ratings (easiness, taste), prep/cook/work time, categories (fish, pork, beef, chicken, vegan, pasta, rice, potato, stew, etc.), calorie filter
3. **Finance Manager** — credit calculation, investment tracking, Bausparvertrag/Giro/savings account growth, import of current state and expenses, automatic recognition of new entries, export for Claude analysis, planned spendings tracking (mattresses, bike, furniture, bedroom lights, jalousines, money collection album, etc.)
4. **Financing Manager** — managing larger purchase financing projects
5. **Shopping List Creator** — automatic generation based on pantry state
6. **Spending Analysis & Savings Suggestions** — calculation of spending/earnings, AI-driven suggestions on where to cut
7. **Investment Management** — suggestions and tracking
8. **Plant & Gardening Manager** — watering cycles (temperature/humidity/season-aware), fertilization tracker, plant import with data, harvest/planting scheduling, gardening specialist AI

## Target audience

Personal use — single household. Alex (the user). German-language context (e.g. Bausparvertrag, Fliegengitter, Jalousinen).

## Tech stack

Not yet decided. To be determined by Tech Specialist assessment.

## Key constraints

- Server application with web frontend
- Should integrate with Claude API for analysis and suggestions (finance export, gardening specialist)
- Barcode scanning support needed
- Recipe image OCR and translation needed
- Planning phase only — no implementation yet

## Decisions already made

- Product name: Oikos
- It is a server app + web frontend (not a mobile-only app)
- Claude is invoked via `claude -p` CLI subprocess — no Anthropic SDK, no API key in-app
- Finance import is file-based only — no live bank connection. Importer must deduplicate entries automatically
- Sample bank export file to be provided by user before finance importer is built
- Tech stack: Node.js + Express backend, React + Vite frontend, PostgreSQL database

## Background context

- Finance: user has Bausparvertrag, Giro account, savings account
- Planned large purchases: mattresses, Fliegengitter am Balkon, bike, furniture under stairs, bedroom lights, jalousines upstairs, money collection album
- Plant tracker should support "gardening specialist" AI agent fed by plant data
