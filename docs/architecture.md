# Oikos — Application Architecture

**Status:** Living document — update as decisions are made.
**Last updated:** 2026-05-13

---

## 1. Tech Stack

All stack decisions are confirmed. Do not re-open.

| Layer | Technology | Notes |
|---|---|---|
| Language | TypeScript (strict) | Server and client. `"module": "NodeNext"` on server. |
| Backend framework | Express | Single process serves both API and frontend. |
| Frontend | React + Vite | Vite runs as Express middleware (`middlewareMode: true`). No separate frontend container. |
| UI library | Material UI (MUI v6+) + Material Icons | Mobile-first. |
| State management | Zustand | Client-side. Persisted stores for auth, theme, and module-level UI state. |
| Real-time (optional) | Socket.io | Added when a module requires push updates (e.g. live shopping list sync, gardening alerts). Not included in Phase 0 — add when first needed. |
| Database | PostgreSQL 16 | |
| ORM / migrations | Prisma | `prisma migrate dev` in dev, `prisma migrate deploy` in prod. |
| Containerisation | Docker Compose | Single `server` service + `db` service. |
| Dev HMR | `nodemon --legacy-watch` + `tsx` | `--legacy-watch` required on Windows Docker bind mounts (inotify not available). |
| AI invocation | `claude -p` via Node.js `exec` | No Anthropic SDK. Three tiers — see §7. |
| Translation | `claude -p` with Haiku model | Single-turn. |
| Recipe OCR | Claude vision via `claude -p` | Image path passed as argument. |
| Barcode scan | ZXing-WASM | In-browser, camera via `getUserMedia`. Requires HTTPS — see §8. |
| Product data | Open Food Facts API | No key required. Rate limit: 15 req/min. |
| Plant data | Perenual API (free tier) | Cache locally. 100 req/day limit. |
| Bank import | File-based only | MT940 / CAMT.053 / CSV. Format TBD from sample file. |

---

## 2. Project Folder Structure

```
oikos/                              ← repo root
├── server/
│   ├── src/
│   │   ├── index.ts                ← entry point — starts Express + Vite middleware
│   │   ├── app.ts                  ← Express app factory
│   │   ├── config.ts               ← env var loading + validation
│   │   ├── db/
│   │   │   └── client.ts           ← Prisma client singleton (export { prisma })
│   │   ├── middleware/
│   │   │   ├── auth.ts             ← JWT validation guard
│   │   │   └── errorHandler.ts     ← global Express error handler
│   │   ├── services/
│   │   │   └── claude.ts           ← Claude CLI wrapper (all AI calls go here)
│   │   └── modules/
│   │       ├── auth/
│   │       │   └── auth.routes.ts
│   │       ├── pantry/
│   │       │   ├── pantry.routes.ts
│   │       │   ├── pantry.controller.ts
│   │       │   └── pantry.service.ts
│   │       ├── recipes/
│   │       │   ├── recipes.routes.ts
│   │       │   ├── recipes.controller.ts
│   │       │   └── recipes.service.ts
│   │       ├── finance/
│   │       │   ├── finance.routes.ts
│   │       │   ├── finance.controller.ts
│   │       │   ├── finance.service.ts
│   │       │   └── importers/
│   │       │       ├── csv.importer.ts
│   │       │       ├── mt940.importer.ts
│   │       │       └── camt053.importer.ts
│   │       ├── financing/
│   │       ├── shopping/
│   │       ├── spending/
│   │       ├── investments/
│   │       └── plants/
│   ├── prisma/
│   │   ├── schema.prisma           ← single schema file, all models
│   │   └── seed.ts                 ← optional seed data
│   ├── uploads/                    ← bind-mounted; recipe images, bank files, plant photos
│   ├── package.json
│   ├── tsconfig.json
│   ├── nodemon.json
│   └── Dockerfile.dev
├── client/
│   ├── src/
│   │   ├── main.tsx                ← Vite entry point
│   │   ├── App.tsx                 ← root component + React Router
│   │   ├── index.css               ← CSS custom properties (design tokens + dark mode block)
│   │   ├── theme.ts                ← MUI theme definition
│   │   ├── api/
│   │   │   └── client.ts           ← axios instance (base URL + auth header)
│   │   ├── store/
│   │   │   ├── authStore.ts        ← Zustand auth state (JWT token)
│   │   │   └── themeStore.ts       ← Zustand dark mode (persisted to localStorage)
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx    ← sidebar/bottom nav + page outlet
│   │   │   │   └── AuthGuard.tsx
│   │   │   └── common/
│   │   │       ├── LoadingSpinner.tsx
│   │   │       └── ErrorAlert.tsx
│   │   ├── hooks/
│   │   │   └── useApi.ts
│   │   ├── pages/
│   │   │   ├── Auth/
│   │   │   │   └── LoginPage.tsx
│   │   │   ├── Pantry/
│   │   │   │   ├── PantryPage.tsx
│   │   │   │   ├── ScanPage.tsx
│   │   │   │   └── AddItemForm.tsx
│   │   │   ├── Recipes/
│   │   │   ├── Finance/
│   │   │   ├── Shopping/
│   │   │   ├── Spending/
│   │   │   ├── Investments/
│   │   │   └── Plants/
│   │   └── services/               ← one file per module, wraps api/client.ts
│   │       ├── pantry.service.ts
│   │       └── ...
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── packages/
│   └── shared/
│       ├── src/
│       │   └── index.ts            ← shared TypeScript types and Zod schemas
│       └── package.json
├── docker-compose.yaml
├── package.json                    ← npm workspaces root (server, client, packages/*)
├── .env.example
└── docs/                           ← this document lives here
    ├── architecture.md
    └── specs/
```

**Key conventions:**
- No `model.ts` files. Prisma client replaces them — all DB access goes through `prisma` in service files.
- Every module has exactly three files: `routes`, `controller`, `service`. Routes register endpoints. Controllers validate request/response. Services hold business logic and DB calls.
- `packages/shared/src/index.ts` is the only place shared types live. Server and client import from `@oikos/shared`. Never duplicate type definitions.
- Arrow functions throughout. Double quotes in all TS/TSX files.

---

## 3. Module Map

### Pantry Manager
Tracks food items in the home. Products (catalogue entries) resolved via barcode → Open Food Facts, falling back to manual entry. Pantry items are instances of a product with quantity + expiry + location. Exposes `/api/v1/pantry/`. Key Prisma models: `Product`, `PantryItem`. No hard module dependencies; Shopping List reads pantry state.

### Recipe Manager
Stores recipes with ingredients, steps, times, categories, and ratings. Photo upload → Claude vision extracts structured recipe data. Optional translation via Claude Haiku. Exposes `/api/v1/recipes/`. Key models: `Recipe`, `RecipeIngredient`, `RecipeRating`.

### Finance Manager
Core financial module. Accounts (Giro, Sparkonto, Bausparvertrag, investment) and transactions. File-based import (MT940/CAMT.053/CSV) with automatic deduplication. Exports data for Claude analysis. Exposes `/api/v1/finance/`. Key models: `Account`, `Transaction`, `PlannedSpending`. Spending Analysis and Financing Manager depend on this.

### Financing Manager
Large purchase financing tracking (installment plans, credit). Links to transactions in Finance. Exposes `/api/v1/financing/`. Key model: `FinancingProject`.

### Shopping List Creator
Auto-generates lists from pantry low-stock items plus manual additions. Read-only on pantry data. Exposes `/api/v1/shopping/`. Key models: `ShoppingList`, `ShoppingItem`.

### Spending Analysis
Aggregates categorized transactions from Finance. Triggers Claude for savings suggestions. No dedicated models — operates on Finance data. Exposes `/api/v1/spending/`.

### Investment Management
Tracks holdings (ETFs, Bausparvertrag, savings goals) via manual entry and periodic balance snapshots. No live price feed. Exposes `/api/v1/investments/`. Key models: `InvestmentAccount`, `InvestmentSnapshot`.

### Plant & Gardening Manager
Plants with care schedules. Perenual API for species data (cached in DB). Claude session for gardening specialist chat. Exposes `/api/v1/plants/`. Key models: `Plant`, `PlantSpeciesCache`, `CareEvent`.

---

## 4. API Design Conventions

### Base URL
```
/api/v1/<module>/
```

### Authentication
JWT in `Authorization: Bearer <token>` header. Token issued on login, stored in `authStore` (Zustand, in-memory only — not persisted to localStorage for security). The `auth.ts` middleware validates the token on all `/api/v1/*` routes. `/api/auth/*` and `/api/health` are unguarded.

### Response Envelope

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Success with pagination:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": { "page": 1, "pageSize": 25, "total": 143, "totalPages": 6 }
}
```

**Error:**
```json
{
  "success": false,
  "error": { "code": "PRODUCT_NOT_FOUND", "message": "...", "details": null }
}
```

HTTP status codes are meaningful. `200` OK, `201` Created, `400` Bad Request, `401` Unauthorized, `404` Not Found, `409` Conflict, `422` Unprocessable, `500` Internal.

### Pagination
List endpoints accept `page` (default 1) and `pageSize` (default 25, max 100).

### File Uploads
`multipart/form-data` via `multer`. Files stored in `server/uploads/` (bind-mounted volume). Field name: `file` for generic uploads, `image` for images. Max 20 MB.

---

## 5. Database — Prisma Models

All models in `server/prisma/schema.prisma`. Key models per module listed below. Full schema lives in the file — do not duplicate it here.

| Module | Models |
|---|---|
| Pantry | `Product`, `PantryItem` |
| Recipes | `Recipe`, `RecipeIngredient`, `RecipeRating` |
| Finance | `Account`, `Transaction`, `PlannedSpending` |
| Financing | `FinancingProject` |
| Shopping | `ShoppingList`, `ShoppingItem` |
| Investments | `InvestmentAccount`, `InvestmentSnapshot` |
| Plants | `Plant`, `PlantSpeciesCache`, `CareEvent` |

`Transaction` has a `rawHash` field (SHA-256 of account + date + amount + description) with `@unique` — this is the deduplication key for bank import.

---

## 6. Docker Compose Services

```yaml
services:

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-oikos}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-oikos}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-oikos} -d ${POSTGRES_DB:-oikos}"]
      interval: 5s
      timeout: 5s
      retries: 5

  server:
    build:
      context: .
      dockerfile: server/Dockerfile.dev
    volumes:
      - ./server/src:/app/server/src       # nodemon watches this
      - ./client/src:/app/client/src       # Vite HMR watches this
      - ./server/uploads:/app/server/uploads
      - ./packages/shared/src:/app/packages/shared/src
    ports:
      - "3001:3001"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy

volumes:
  postgres_data:
```

**Single entry point:** both the API and the frontend are served on `http://localhost:3001`.

**Dev workflow:**
```bash
docker compose up --build
# Backend restarts on .ts file save (nodemon --legacy-watch)
# Frontend hot-reloads via Vite HMR
```

**After any `prisma migrate dev` / `prisma db push`:**
```bash
docker compose restart server
```
`tsx watch` caches the Prisma client module and does not reload it on file changes. Without a restart, new schema fields return `undefined` and silently fall through to defaults. This is a known tsx/Prisma limitation — always restart after schema changes.

---

## 7. Claude CLI Integration Pattern

All AI calls go through `server/src/services/claude.ts`. Nothing else calls `exec` for Claude.

### Tier 1 — Single-turn prompt
For one-shot tasks: finance analysis, savings suggestions, translation, recipe OCR.

```bash
# Text prompt
claude -p "Analyse the following transactions..."

# Haiku model for cheap tasks (translation)
claude -p --model claude-haiku-4-5 "Translate this recipe title to German: ..."

# Large context via temp file (avoids shell arg length limits)
cat /tmp/oikos-ctx-<uuid>.json | claude -p "Analyse this finance export..."
```

Large context is written to a temp file (`/tmp/oikos-<uuid>.json`), piped in, then deleted in a `finally` block.

### Tier 2 — Session-based multi-turn (Gardening Specialist chat)
```bash
claude -p --session-id "garden-<userId>" \
  "You are a gardening specialist. Plant data: <json>. User: When should I water my monstera?"

# Subsequent turns reuse the same session-id
claude -p --session-id "garden-<userId>" "What about the fiddle-leaf fig?"
```

### Tier 3 — Image input (Recipe OCR, plant photo)
```bash
claude -p --image /app/server/uploads/recipe-<uuid>.jpg \
  "Extract all ingredients and steps. Return JSON: { title, servings, ingredients: [{quantity, unit, name}], steps: [string] }"
```

**Error handling:** parse `stdout` for response; `stderr` non-empty is a warning; non-zero exit code is always an error (throws `AppError` status 502).

---

## 8. Known Constraints

### HTTPS and barcode scanning
`getUserMedia` (camera access for barcode scanning) requires HTTPS except on `localhost`. The app currently runs over plain HTTP. This means barcode scanning will **not work** from a phone or other device connecting via LAN IP.

**Resolution options (pick one before Phase 1):**
- (a) Domain + Let's Encrypt via Caddy — cleanest, requires a public domain pointed at the server.
- (b) Self-signed cert — browsers warn; user must manually trust on each device.
- (c) Accept the limitation — barcode scanning only works from the machine running Docker (localhost).

This is OQ-3. It does not block Phase 0 or the backend of Phase 1, but it blocks the scan UI being usable on a phone.
