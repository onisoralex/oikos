# Oikos — Application Architecture

**Status:** Living document — update as decisions are made.
**Last updated:** 2026-05-13
**Produced by:** Tech Specialist (task: oikos-architecture-specs-20260513-000001)

---

## 1. Tech Stack

All stack decisions are confirmed. Do not re-open.

| Layer | Technology | Notes |
|---|---|---|
| Backend runtime | Node.js (LTS) | |
| Backend framework | Express | |
| Frontend framework | React + Vite | |
| Frontend UI library | Material UI (MUI v6+) | |
| Database | PostgreSQL 16 | |
| Containerisation | Docker Compose | Single file, all services |
| Backend dev HMR | nodemon | Restarts Express on file save |
| Frontend dev HMR | Vite HMR | Native |
| AI invocation | `claude -p` via Node.js `exec` | No Anthropic SDK; three tiers (see §7) |
| Translation | `claude -p` with Haiku model | Single-turn; called per-text |
| Recipe OCR | Claude vision via `claude -p` | Image path or base64 passed as argument |
| Barcode scan | ZXing-WASM | In-browser, camera via `getUserMedia` |
| Product data | Open Food Facts API | No key required; rate limit 15 req/min |
| Plant data | Perenual API (free tier) | Cache locally; 100 req/day limit |
| Bank import | File-based only | MT940 / CAMT.053 / CSV; format TBD from sample |

---

## 2. Project Folder Structure

```
oikos/                              ← repo root
├── backend/
│   ├── src/
│   │   ├── app.js                  ← Express app factory (no listen here)
│   │   ├── server.js               ← entry point — binds port, starts app
│   │   ├── config.js               ← env var loading + validation (dotenv)
│   │   ├── db/
│   │   │   ├── pool.js             ← pg connection pool (node-postgres)
│   │   │   └── migrations/         ← node-pg-migrate migration files
│   │   │       └── 001_initial.js
│   │   ├── middleware/
│   │   │   ├── auth.js             ← session validation guard
│   │   │   ├── errorHandler.js     ← global Express error handler
│   │   │   └── requestLogger.js    ← Morgan or custom logger
│   │   ├── services/
│   │   │   └── claude.js           ← Claude CLI wrapper (all AI calls go here)
│   │   └── modules/
│   │       ├── pantry/
│   │       │   ├── pantry.routes.js
│   │       │   ├── pantry.controller.js
│   │       │   ├── pantry.service.js
│   │       │   └── pantry.model.js
│   │       ├── recipes/
│   │       │   ├── recipes.routes.js
│   │       │   ├── recipes.controller.js
│   │       │   ├── recipes.service.js
│   │       │   └── recipes.model.js
│   │       ├── finance/
│   │       │   ├── finance.routes.js
│   │       │   ├── finance.controller.js
│   │       │   ├── finance.service.js
│   │       │   ├── finance.model.js
│   │       │   └── importers/
│   │       │       ├── csv.importer.js
│   │       │       ├── mt940.importer.js
│   │       │       └── camt053.importer.js
│   │       ├── financing/
│   │       │   ├── financing.routes.js
│   │       │   ├── financing.controller.js
│   │       │   ├── financing.service.js
│   │       │   └── financing.model.js
│   │       ├── shopping/
│   │       │   ├── shopping.routes.js
│   │       │   ├── shopping.controller.js
│   │       │   ├── shopping.service.js
│   │       │   └── shopping.model.js
│   │       ├── spending/
│   │       │   ├── spending.routes.js
│   │       │   ├── spending.controller.js
│   │       │   └── spending.service.js
│   │       ├── investments/
│   │       │   ├── investments.routes.js
│   │       │   ├── investments.controller.js
│   │       │   ├── investments.service.js
│   │       │   └── investments.model.js
│   │       └── plants/
│   │           ├── plants.routes.js
│   │           ├── plants.controller.js
│   │           ├── plants.service.js
│   │           └── plants.model.js
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example
│   └── nodemon.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx                ← Vite entry point
│   │   ├── App.jsx                 ← root component + React Router
│   │   ├── theme.js                ← MUI theme definition
│   │   ├── api/
│   │   │   └── client.js           ← axios instance with base URL + auth header
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.jsx    ← sidebar + topbar wrapper
│   │   │   │   └── NavMenu.jsx
│   │   │   └── common/
│   │   │       ├── LoadingSpinner.jsx
│   │   │       ├── ErrorAlert.jsx
│   │   │       └── ConfirmDialog.jsx
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   └── useApi.js           ← generic data-fetching hook
│   │   ├── pages/
│   │   │   ├── Auth/
│   │   │   │   └── LoginPage.jsx
│   │   │   ├── Pantry/
│   │   │   │   ├── PantryPage.jsx
│   │   │   │   ├── ScanPage.jsx
│   │   │   │   └── AddItemForm.jsx
│   │   │   ├── Recipes/
│   │   │   ├── Finance/
│   │   │   ├── Shopping/
│   │   │   ├── Spending/
│   │   │   ├── Investments/
│   │   │   └── Plants/
│   │   └── services/               ← one file per module, wraps api/client.js
│   │       ├── pantry.service.js
│   │       ├── recipes.service.js
│   │       ├── finance.service.js
│   │       └── plants.service.js
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── package-lock.json
├── docker-compose.yml              ← all services (dev + prod profiles)
├── docker-compose.override.yml     ← optional local overrides (gitignored)
├── .env.example                    ← shared env var template
└── docs/                           ← this document lives here
    ├── architecture.md
    └── specs/
        ├── 00-foundation.md
        ├── 01-pantry.md
        └── ...
```

**Key conventions:**
- Every module under `backend/src/modules/` has exactly four files: `routes`, `controller`, `service`, `model`. Routes register Express endpoints. Controllers validate request/response. Services hold business logic. Models hold SQL queries (no ORM — raw `pg` queries via the pool).
- Frontend `services/` files are thin wrappers over `api/client.js` — they know the endpoint URLs and shape the request/response objects, nothing more.
- No shared `types/` folder — this is a JavaScript project. Document schemas in specs and enforce via JS validation in the service layer.

---

## 3. Module Map

### Pantry Manager
Tracks food items in the home. Stores products (sourced from Open Food Facts or manual entry) and pantry items (a product + quantity + expiry + location). Exposes `/api/v1/pantry/`. Key tables: `products`, `pantry_items`. No hard dependencies on other modules, but Shopping List reads pantry state.

### Recipe Manager
Stores recipes with ingredients, preparation steps, cook times, category tags, and user ratings. Supports image upload for OCR extraction (via Claude vision) and optional translation (via Claude Haiku). Exposes `/api/v1/recipes/`. Key tables: `recipes`, `recipe_ingredients`, `recipe_ratings`. No dependency on other modules.

### Finance Manager
Core financial module. Tracks accounts (Giro, Sparkonto, Bausparvertrag, investment) and transactions. Imports bank export files (MT940/CAMT.053/CSV), deduplicates automatically, and exports data for Claude analysis. Exposes `/api/v1/finance/`. Key tables: `accounts`, `transactions`, `planned_spendings`. Spending Analysis and Financing Manager depend on this module's schema.

### Financing Manager
Tracks large purchase financing projects (e.g. mattress on installment, credit). Each project has a total amount, financing terms, payment schedule, and link to associated transactions in Finance. Exposes `/api/v1/financing/`. Key table: `financing_projects`. Depends on Finance Manager for transaction data.

### Shopping List Creator
Generates shopping lists from pantry low-stock or absent items plus manual additions. Read-only access to `pantry_items`. Exposes `/api/v1/shopping/`. Key table: `shopping_lists`, `shopping_items`. Depends on Pantry Manager.

### Spending Analysis
Reads categorized transactions from Finance Manager and produces aggregated summaries (by category, by month, by account). Triggers Claude CLI for savings suggestions. No dedicated tables — operates on Finance data. Exposes `/api/v1/spending/`. Depends on Finance Manager.

### Investment Management
Tracks investment holdings — ETFs, Bausparvertrag, savings goals. Manual entry and periodic balance updates. Exposes `/api/v1/investments/`. Key tables: `investment_accounts`, `investment_holdings`. Scope limited to tracking + display; no live price feed in Phase 5.

### Plant & Gardening Manager
Stores plants (species, location, acquired date) with care schedules (watering interval, last watered, fertilization schedule). Integrates with Perenual API for species data (cached locally). Exposes `/api/v1/plants/`. Key tables: `plants`, `plant_species_cache`, `care_events`. The Gardening Specialist AI is a Claude session (`--session-id`) fed with current plant data as context.

---

## 4. API Design Conventions

### Base URL
```
/api/v1/<module>/
```
Examples: `/api/v1/pantry/items`, `/api/v1/finance/accounts`, `/api/v1/plants/`.

### Authentication
Every request to `/api/v1/*` requires the session cookie (set on login). The `auth.js` middleware checks the cookie signature and rejects unsigned or expired sessions with `401`. The login endpoint at `/api/auth/login` is unguarded.

### Response Envelope

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Success with pagination:**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 143,
    "totalPages": 6
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "No product found for barcode 4000521001596",
    "details": null
  }
}
```

HTTP status codes are meaningful — use them correctly. `200` OK, `201` Created, `400` Bad Request (validation), `401` Unauthorized, `404` Not Found, `409` Conflict (duplicate), `422` Unprocessable (business rule violation), `500` Internal Error.

### Pagination
All list endpoints accept query params `page` (default 1) and `pageSize` (default 25, max 100). Always return the `pagination` object even on the first page. Example: `GET /api/v1/pantry/items?page=2&pageSize=50`.

### File Uploads
Files are uploaded via `multipart/form-data` POST. Use `multer` middleware on the backend. Files are stored in a local `uploads/` volume (bind-mounted in Docker). The field name convention is `file` for generic uploads; `image` for image-specific uploads (OCR, plant photos). Maximum file size: 20 MB.

---

## 5. Database Overview

All tables use `id SERIAL PRIMARY KEY` unless otherwise noted. Timestamps are stored as `TIMESTAMPTZ`.

### Pantry Module

**`products`**
```
id, barcode VARCHAR(30) UNIQUE, name TEXT NOT NULL, brand TEXT,
category TEXT, nutritional_info JSONB, image_url TEXT,
source VARCHAR(10) CHECK (source IN ('off','manual')), off_id TEXT,
created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```

**`pantry_items`**
```
id, product_id INT REFERENCES products(id) ON DELETE RESTRICT,
quantity NUMERIC NOT NULL, unit VARCHAR(20), expiry_date DATE,
location TEXT, notes TEXT, added_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ
```

### Recipe Module

**`recipes`**
```
id, title TEXT NOT NULL, title_original TEXT, source TEXT,
prep_time_min INT, cook_time_min INT, total_time_min INT,
servings INT, calories_per_serving INT, categories TEXT[],
image_url TEXT, notes TEXT, language VARCHAR(10),
created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```

**`recipe_ingredients`**
```
id, recipe_id INT REFERENCES recipes(id) ON DELETE CASCADE,
sort_order INT, quantity NUMERIC, unit VARCHAR(30), name TEXT NOT NULL,
notes TEXT
```

**`recipe_ratings`**
```
id, recipe_id INT REFERENCES recipes(id) ON DELETE CASCADE,
rated_at TIMESTAMPTZ DEFAULT NOW(), easiness SMALLINT CHECK (1..5),
taste SMALLINT CHECK (1..5), notes TEXT
```

### Finance Module

**`accounts`**
```
id, name TEXT NOT NULL, type VARCHAR(20) CHECK (type IN
  ('giro','savings','bauspar','investment','credit')),
currency VARCHAR(3) DEFAULT 'EUR', balance NUMERIC(15,2),
institution TEXT, iban VARCHAR(34), notes TEXT,
created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```

**`transactions`**
```
id, account_id INT REFERENCES accounts(id) ON DELETE RESTRICT,
date DATE NOT NULL, amount NUMERIC(15,2) NOT NULL,
description TEXT, category TEXT, raw_description TEXT,
raw_hash VARCHAR(64) UNIQUE, -- SHA-256 of (account_id + date + amount + raw_description) for dedup
import_source TEXT, manually_entered BOOLEAN DEFAULT FALSE,
created_at TIMESTAMPTZ
```

**`planned_spendings`**
```
id, name TEXT NOT NULL, estimated_amount NUMERIC(15,2),
target_date DATE, priority SMALLINT, status VARCHAR(20)
CHECK (status IN ('planned','saved','purchased','cancelled')),
notes TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```

### Financing Module

**`financing_projects`**
```
id, name TEXT NOT NULL, total_amount NUMERIC(15,2), down_payment NUMERIC(15,2),
financed_amount NUMERIC(15,2), interest_rate NUMERIC(6,4), term_months INT,
monthly_payment NUMERIC(15,2), start_date DATE, status VARCHAR(20)
CHECK (status IN ('active','paid_off','cancelled')),
account_id INT REFERENCES accounts(id), notes TEXT,
created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```

### Shopping Module

**`shopping_lists`**
```
id, name TEXT, is_active BOOLEAN DEFAULT TRUE,
created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```

**`shopping_items`**
```
id, list_id INT REFERENCES shopping_lists(id) ON DELETE CASCADE,
name TEXT NOT NULL, quantity NUMERIC, unit VARCHAR(20),
checked BOOLEAN DEFAULT FALSE, product_id INT REFERENCES products(id),
sort_order INT, created_at TIMESTAMPTZ
```

### Investment Module

**`investment_accounts`**
```
id, name TEXT NOT NULL, type VARCHAR(20) CHECK (type IN
  ('etf','stock','bauspar','savings_bond','other')),
institution TEXT, currency VARCHAR(3) DEFAULT 'EUR',
notes TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```

**`investment_snapshots`**
```
id, investment_account_id INT REFERENCES investment_accounts(id) ON DELETE CASCADE,
snapshot_date DATE NOT NULL, balance NUMERIC(15,2) NOT NULL,
units NUMERIC(18,6), unit_price NUMERIC(15,4), notes TEXT,
created_at TIMESTAMPTZ
```

### Plant Module

**`plant_species_cache`**
```
id, perenual_id INT UNIQUE, common_name TEXT, scientific_name TEXT,
watering_frequency TEXT, sunlight TEXT, fertilizer_season TEXT,
care_notes JSONB, cached_at TIMESTAMPTZ
```

**`plants`**
```
id, common_name TEXT NOT NULL, scientific_name TEXT,
species_cache_id INT REFERENCES plant_species_cache(id),
location TEXT, acquired_date DATE, image_url TEXT, notes TEXT,
watering_interval_days INT, last_watered_at TIMESTAMPTZ,
fertilized_at TIMESTAMPTZ, fertilize_interval_days INT,
created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```

**`care_events`**
```
id, plant_id INT REFERENCES plants(id) ON DELETE CASCADE,
event_type VARCHAR(20) CHECK (event_type IN ('watered','fertilized','repotted','pruned','other')),
occurred_at TIMESTAMPTZ DEFAULT NOW(), notes TEXT
```

---

## 6. Docker Compose Services

All defined in a single `docker-compose.yml` at the repo root. Profiles: `dev` for local development, `prod` for production serving.

```yaml
services:

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-oikos}
      POSTGRES_USER: ${POSTGRES_USER:-oikos}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - db_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"    # only expose on dev; restrict in prod

  backend:
    build:
      context: ./backend
      target: dev        # multi-stage; dev uses nodemon, prod uses node directly
    restart: unless-stopped
    depends_on:
      - db
    environment:
      NODE_ENV: ${NODE_ENV:-development}
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      SESSION_SECRET: ${SESSION_SECRET}
      APP_PASSWORD: ${APP_PASSWORD}       # single-user auth password
      UPLOADS_DIR: /app/uploads
      CLAUDE_BIN: /usr/local/bin/claude   # path to claude CLI on host (or in image)
    volumes:
      - ./backend/src:/app/src            # dev: hot-reload source
      - uploads:/app/uploads
    ports:
      - "3001:3001"
    profiles: [dev, prod]

  frontend:
    build:
      context: ./frontend
      target: dev        # dev: runs vite dev server; prod: nginx static
    restart: unless-stopped
    depends_on:
      - backend
    environment:
      VITE_API_BASE_URL: ${VITE_API_BASE_URL:-http://localhost:3001}
    volumes:
      - ./frontend/src:/app/src           # dev: Vite HMR
    ports:
      - "5173:5173"
    profiles: [dev]

  frontend-prod:
    build:
      context: ./frontend
      target: prod       # runs nginx to serve static build
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "80:80"
    profiles: [prod]

volumes:
  db_data:
  uploads:
```

**Environment variables (`.env.example`):**
```
POSTGRES_DB=oikos
POSTGRES_USER=oikos
POSTGRES_PASSWORD=changeme
SESSION_SECRET=changeme_long_random_string
APP_PASSWORD=changeme
NODE_ENV=development
VITE_API_BASE_URL=http://localhost:3001
```

**Dev workflow:**
```bash
docker compose --profile dev up
```
Backend restarts on file save (nodemon); frontend hot-reloads via Vite.

**Production:**
```bash
docker compose --profile prod up -d
```
Frontend is a static nginx build. Backend runs `node src/server.js`.

---

## 7. Claude CLI Integration Pattern

All AI calls go through `backend/src/services/claude.js`. The backend never calls the Anthropic SDK directly. Three tiers:

### Tier 1 — Single-turn prompt
For one-shot tasks: finance export analysis, savings suggestions, translation, recipe OCR.

```bash
# Simple text prompt
claude -p "Analyse the following transactions and suggest savings..." 

# With Haiku model (translation, cheap tasks)
claude -p --model claude-haiku-4-5 "Translate this recipe title to German: ..."

# With a context file (large finance export — avoids shell argument length limits)
claude -p "$(cat /tmp/oikos-context-abc123.json)" "Analyse spending patterns..."
# Or using stdin piping:
cat /tmp/oikos-context-abc123.json | claude -p "Analyse this finance export for savings opportunities"
```

Large context (e.g. full transaction export) is written to a temp file first (`/tmp/oikos-<uuid>.json`), then piped in or referenced. The temp file is deleted after the call completes.

### Tier 2 — Session-based multi-turn (Gardening Specialist chat)
Uses `--session-id` to maintain conversation continuity across HTTP requests.

```bash
# First turn: create session, inject plant context
claude -p --session-id "garden-session-<userId>" \
  "You are a gardening specialist. Here is the current state of the user's plants: <json>. 
   User asks: When should I water my monstera?"

# Subsequent turns: same session-id, no need to re-inject context (Claude CLI maintains it)
claude -p --session-id "garden-session-<userId>" \
  "What about the fiddle-leaf fig?"
```

Session IDs are stored server-side (in-memory map or DB) keyed to the user's active chat. Sessions expire after a configurable idle timeout (e.g. 1 hour).

### Tier 3 — Image input (Recipe OCR, plant photo)
Claude vision via `claude -p` with image path.

```bash
# Image file on disk — pass as argument (check claude CLI image support syntax)
claude -p --image /app/uploads/recipe-photo-abc123.jpg \
  "Extract all ingredients and preparation steps from this recipe photo. 
   Return JSON with fields: title, servings, ingredients (array of {quantity, unit, name}), steps (array of strings)."
```

Image files come from the `uploads/` volume. The backend stores the upload, calls Claude, parses the JSON response, and then optionally deletes the image or retains it.

**Error handling in the wrapper:**
- All three tiers parse `stdout` for the response.
- `stderr` is monitored — any output to stderr is treated as an error condition.
- Exit code non-zero → throw with stderr content.
- Response is expected to be plain text (for prompts) or JSON string (for structured extraction prompts). The wrapper does not auto-parse JSON — callers do that.

---

*This document is a living reference. Update §5 when migrations add or rename tables. Update §6 when Docker services change. Update §7 if the Claude CLI interface changes.*
