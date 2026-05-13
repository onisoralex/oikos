# Spec 00 — Foundation (Phase 0)

**Status:** Ready to implement
**Date:** 2026-05-13
**Produced by:** Tech Specialist (task: oikos-architecture-specs-20260513-000001)
**Depends on:** Nothing — this is the base layer.

---

## Overview

Phase 0 builds the skeleton every other module runs on: Docker Compose, Express backend scaffold, PostgreSQL with migrations, single-user auth, Claude CLI wrapper, React + Vite + MUI frontend scaffold, and the dev workflow. No feature logic lives here.

---

## 1. Docker Compose

Full service definition lives in `docker-compose.yml` at the repo root. See `docs/architecture.md §6` for the complete YAML.

### Key points for the Developer:

**Multi-stage Dockerfiles.** Both `backend/` and `frontend/` need multi-stage Dockerfiles with `dev` and `prod` targets.

**`backend/Dockerfile`:**
```dockerfile
# Stage: dev
FROM node:22-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npx", "nodemon", "src/server.js"]

# Stage: prod
FROM node:22-alpine AS prod
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "src/server.js"]
```

**`frontend/Dockerfile`:**
```dockerfile
# Stage: dev
FROM node:22-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npx", "vite", "--host", "0.0.0.0"]

# Stage: build
FROM dev AS builder
RUN npx vite build

# Stage: prod
FROM nginx:alpine AS prod
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

**`frontend/nginx.conf`** (for prod static serving with React Router):
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://backend:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
  }
}
```

### Volumes
- `db_data` — PostgreSQL data, named volume (survives container restart)
- `uploads` — user-uploaded files (recipe images, bank statement files, plant photos), named volume

### Health check
PostgreSQL service should include a health check so the backend does not start before the DB is ready:
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U $POSTGRES_USER -d $POSTGRES_DB"]
  interval: 5s
  timeout: 3s
  retries: 10
```
Backend should have `depends_on: db: condition: service_healthy`.

---

## 2. Backend Scaffold

### Entry points

**`backend/src/server.js`** — binds the port, nothing else:
```javascript
const app = require('./app');
const { PORT } = require('./config');

app.listen(PORT, () => {
  console.log(`Oikos backend listening on port ${PORT}`);
});
```

**`backend/src/app.js`** — Express app factory:
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieSession = require('cookie-session');
const { SESSION_SECRET, CORS_ORIGIN } = require('./config');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./modules/auth/auth.routes');
// ... module routes

const app = express();

app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
  name: 'session',
  secret: SESSION_SECRET,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
}));

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
// app.use('/api/v1/pantry', require('./modules/pantry/pantry.routes'));
// ... add modules here as they are built

app.use(errorHandler);

module.exports = app;
```

### Middleware stack (order matters)
1. `helmet` — security headers
2. `cors` — with `credentials: true` so the frontend can send cookies cross-origin in dev
3. `express.json` — body parsing
4. `express.urlencoded` — form data
5. `cookie-session` — signed session cookie
6. Route handlers
7. `errorHandler` — must be last

### Error handler

**`backend/src/middleware/errorHandler.js`:**
```javascript
module.exports = (err, req, res, next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred',
      details: err.details || null,
    },
  });
};
```

Controllers throw errors using a simple factory:
```javascript
// src/lib/errors.js
class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
module.exports = { AppError };
```

### Health endpoint
`GET /api/health` — no auth required. Returns `200 { status: 'ok', ts: <ISO timestamp> }`. Used by Docker health checks and uptime monitors.

### Required npm packages (backend)
```
express
cors
helmet
cookie-session
pg                  ← node-postgres (not pg-promise; raw pg for control)
node-pg-migrate     ← migration tool (see §3)
multer              ← file upload middleware
dotenv
```

Dev dependencies:
```
nodemon
```

---

## 3. Database Setup

### Connection pool

**`backend/src/db/pool.js`:**
```javascript
const { Pool } = require('pg');
const { DATABASE_URL } = require('../config');

const pool = new Pool({ connectionString: DATABASE_URL });

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
  process.exit(1);
});

module.exports = pool;
```

All SQL queries use `pool.query(sql, params)`. There is no ORM. Query functions live in `*.model.js` files for each module.

### Migration tool: `node-pg-migrate`

**Why node-pg-migrate over db-migrate:**
- `node-pg-migrate` is PostgreSQL-specific and has first-class support for PostgreSQL features (partitioning, enums, array types, JSONB). `db-migrate` is database-agnostic, which means it supports a lowest-common-denominator DDL API and requires raw SQL for anything PostgreSQL-specific. Since Oikos uses JSONB and text arrays extensively, `node-pg-migrate` is the better fit.
- Active maintenance (2026), TypeScript definitions available, good CLI.

**Setup:**

`package.json` scripts:
```json
{
  "scripts": {
    "migrate": "node-pg-migrate up",
    "migrate:down": "node-pg-migrate down",
    "migrate:create": "node-pg-migrate create"
  }
}
```

`.env` or env vars for the migration CLI:
```
DATABASE_URL=postgresql://oikos:changeme@localhost:5432/oikos
```

Migration files live in `backend/src/db/migrations/`. The tool creates a `pgmigrations` table to track applied migrations.

**Initial migration `001_initial.js`** should create the foundation tables only — specifically the `accounts` table and `transactions` table are not part of Phase 0. Phase 0 migration creates nothing application-specific: the first module migration (Phase 1: Pantry) creates the first real tables. Phase 0 can contain a single migration that just verifies the connection and adds a `pgmigrations` table (node-pg-migrate does this automatically on first run).

---

## 4. Auth — Single-User Session

### Approach: environment-variable password + signed cookie session (no user table)

**Rationale:**
- Oikos is a strictly single-user application. A `users` table adds complexity (password hashing, user management API, signup flow) with zero benefit — there is only ever one user.
- `APP_PASSWORD` is set in the environment (`.env`). The login endpoint checks the submitted password against it via `crypto.timingSafeEqual` to prevent timing attacks.
- `cookie-session` (using `keygrip` under the hood) signs the session cookie with `SESSION_SECRET`. No server-side session store required — the session data is in the cookie itself. For a single user with a 30-day session, this is sufficient.
- If the `APP_PASSWORD` is ever compromised, rotating it and the `SESSION_SECRET` in `.env` and restarting the container is the full remediation.

**Auth module:**

`backend/src/modules/auth/auth.routes.js`:
- `POST /api/auth/login` — body: `{ password }`. Validates against `APP_PASSWORD`. Sets `req.session.authenticated = true`. Returns `200` on success, `401` on wrong password.
- `POST /api/auth/logout` — clears session. Returns `200`.
- `GET /api/auth/me` — returns `{ authenticated: true }` if session is valid, `401` otherwise.

`backend/src/middleware/auth.js` (applied to all `/api/v1/*` routes):
```javascript
module.exports = (req, res, next) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
  }
  next();
};
```

All routes registered under `/api/v1/` should have the auth middleware applied globally. Routes under `/api/auth/` and `/api/health` are public.

---

## 5. Claude CLI Wrapper

**`backend/src/services/claude.js`**

This module wraps `child_process.exec` / `spawn` for all Claude CLI invocations. No other module calls `exec` for Claude — they all go through this service.

### Interface (method signatures and return types)

```javascript
/**
 * Single-turn prompt. No session. Returns the response text.
 * @param {string} prompt - The full prompt text.
 * @param {object} options
 * @param {string} [options.model] - Claude model (e.g. 'claude-haiku-4-5'). Default: claude CLI default.
 * @param {string} [options.contextFile] - Path to a temp file to pipe as additional context.
 * @returns {Promise<string>} - Claude's response text (stdout), trimmed.
 */
async function singleTurn(prompt, options = {}) {}

/**
 * Session-based prompt. Maintains conversation across calls with the same sessionId.
 * @param {string} sessionId - Unique session identifier (e.g. 'garden-<userId>-<timestamp>').
 * @param {string} prompt - The user's message for this turn.
 * @param {object} options
 * @param {string} [options.model]
 * @returns {Promise<string>} - Claude's response text, trimmed.
 */
async function sessionTurn(sessionId, prompt, options = {}) {}

/**
 * Image prompt (vision). For OCR, plant photo analysis.
 * @param {string} imagePath - Absolute path to image file in the uploads volume.
 * @param {string} prompt - The instruction to apply to the image.
 * @param {object} options
 * @param {string} [options.model]
 * @returns {Promise<string>} - Claude's response text, trimmed.
 */
async function imageTurn(imagePath, prompt, options = {}) {}

module.exports = { singleTurn, sessionTurn, imageTurn };
```

### Implementation notes for the Developer:
- Use `child_process.exec` wrapped in a `Promise`. Set a generous timeout (120 seconds for large prompts).
- `stdout` is the response. `stderr` should be checked — non-empty stderr is logged as a warning, not always a hard error (the Claude CLI may emit progress to stderr). A non-zero exit code is always an error.
- For `contextFile`: write the context to `/tmp/oikos-<uuid>.json` before calling, read back, then `fs.unlink` it in a `finally` block.
- For `imagePath`: verify the file exists before calling. The `--image` flag syntax needs to be confirmed against the installed Claude CLI version — document the exact flag in a comment.
- All methods should reject with an `AppError` (status 502) on Claude CLI failure so the error handler can return a clean response to the frontend.
- Do not implement streaming in Phase 0. Phase 5 (Gardening chat) can add streaming via `spawn` if needed.

---

## 6. Frontend Scaffold

### Vite config (`frontend/vite.config.js`)
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // required for Docker
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:3001',  // Docker service name
        changeOrigin: true,
      },
    },
  },
});
```

The Vite proxy means the frontend dev server forwards `/api/*` to the backend, avoiding CORS issues in dev and keeping `VITE_API_BASE_URL` optional in dev.

### MUI theme (`frontend/src/theme.js`)
```javascript
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',  // or 'dark' — choose at project start
    primary: { main: '#2e7d32' },    // green — home/nature feel
    secondary: { main: '#ff8f00' },  // amber
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

export default theme;
```

### React Router layout (`frontend/src/App.jsx`)
```javascript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import AppShell from './components/layout/AppShell';
import AuthGuard from './components/layout/AuthGuard';
import LoginPage from './pages/Auth/LoginPage';
import PantryPage from './pages/Pantry/PantryPage';
// ... other page imports

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthGuard><AppShell /></AuthGuard>}>
            <Route path="/" element={<Navigate to="/pantry" replace />} />
            <Route path="/pantry/*" element={<PantryPage />} />
            {/* add modules here */}
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
```

### API client (`frontend/src/api/client.js`)
```javascript
import axios from 'axios';

const client = axios.create({
  baseURL: '/api',   // Vite proxy in dev; nginx proxy in prod
  withCredentials: true,  // required for cookie-based auth
  timeout: 30000,
});

// Response interceptor — unwrap envelope or throw
client.interceptors.response.use(
  (res) => res.data.data,   // unwrap { success: true, data: ... }
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data?.error || err);
  }
);

export default client;
```

### Auth guard component

`frontend/src/components/layout/AuthGuard.jsx`:
- On mount, call `GET /api/auth/me`.
- If `200` → render children.
- If `401` → redirect to `/login`.
- While loading → show `<CircularProgress />` centered.

Store auth state in React context or Zustand — do not re-fetch on every render.

### Required npm packages (frontend)
```
react react-dom
@vitejs/plugin-react vite
@mui/material @mui/icons-material @emotion/react @emotion/styled
react-router-dom
axios
```

---

## 7. Dev Workflow

### First-time setup
```bash
# 1. Copy env file
cp .env.example .env
# Edit .env — set APP_PASSWORD, SESSION_SECRET, POSTGRES_PASSWORD

# 2. Start all services
docker compose --profile dev up --build

# 3. Run migrations (from inside the backend container or locally with node)
docker compose exec backend npm run migrate
```

### Daily development
```bash
docker compose --profile dev up
```
- Backend: `http://localhost:3001` — nodemon watches `backend/src/`
- Frontend: `http://localhost:5173` — Vite HMR
- PostgreSQL: `localhost:5432` (exposed in dev profile)

### Adding a migration
```bash
docker compose exec backend npm run migrate:create -- --name add-pantry-tables
# Edit the generated file in backend/src/db/migrations/
docker compose exec backend npm run migrate
```

### Running migrations down
```bash
docker compose exec backend npm run migrate:down
```

### Connecting to the DB directly
```bash
docker compose exec db psql -U oikos -d oikos
```

### Stopping everything
```bash
docker compose down
# To also remove volumes (destructive — deletes DB data):
docker compose down -v
```

---

## Assumptions

- The `claude` CLI binary is available inside the Docker container (installed during image build or bind-mounted from the host). If bind-mounted, `CLAUDE_BIN` in the backend env must point to the host path. This is a hard dependency for any AI feature.
- HTTPS is not required for Phase 0 local development. Barcode scanning (which requires HTTPS) is a Phase 1 concern.
- `cookie-session` stores session data in the cookie itself. If the session data grows large (it should not — only `{ authenticated: true }` is stored), switch to a server-side store. Not a Phase 0 concern.
- Node.js LTS version is 22 at time of writing. Pin the Docker base image to `node:22-alpine`.
