# Spec 00 — Foundation (Phase 0)

**Status:** Ready to implement
**Date:** 2026-05-13
**Depends on:** Nothing — this is the base layer.

---

## Overview

Phase 0 builds the skeleton every other module runs on: Docker Compose with a single server service, Express + Vite middleware, PostgreSQL with Prisma, JWT single-user auth, Claude CLI wrapper, and the full TypeScript scaffold for both server and client. No feature logic lives here.

---

## 1. Docker Compose

Full YAML in `docs/architecture.md §6`. Key points:

- **Single `server` service** — Express serves both the API and the Vite frontend on port 3001.
- **`nodemon --legacy-watch`** — required on Windows Docker bind mounts. inotify events from the Windows filesystem do not reach the Linux container; polling is the fallback.
- **PostgreSQL health check** — `server` must wait for `db` via `condition: service_healthy`.
- **`server/uploads/` bind mount** — keep uploaded files on the host so they survive container rebuilds.

### `server/Dockerfile.dev`

```dockerfile
FROM node:22-alpine
WORKDIR /app

# Prisma query engine needs OpenSSL on Alpine
RUN apk add --no-cache openssl

# Workspace manifests first — Docker caches this layer until any package.json changes
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY packages/shared/package.json ./packages/shared/

RUN npm install

# Prisma schema baked in at build time — client generation runs during npm install (postinstall)
COPY server/prisma ./server/prisma
RUN npm run db:generate --workspace=server

# Source is bind-mounted at runtime for HMR (see docker-compose.yaml)
# prisma db push syncs schema on start (no-op if unchanged)
# nodemon --legacy-watch required on Windows bind mounts
CMD ["sh", "-c", "npx prisma db push --schema=./server/prisma/schema.prisma && npx nodemon --legacy-watch --watch server/src --ext ts --exec 'npx tsx server/src/index.ts'"]
```

**After any schema change:** run `docker compose restart server`. `tsx watch` caches the Prisma client — it does not reload native modules. New fields will return `undefined` until the container is restarted.

### Root `package.json`

```json
{
  "name": "oikos",
  "private": true,
  "type": "module",
  "workspaces": ["client", "server", "packages/*"],
  "engines": { "node": ">=22.0.0" }
}
```

---

## 2. TypeScript Configuration

### `server/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `packages/shared/package.json`

```json
{
  "name": "@oikos/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

`@oikos/shared` is the only place shared types and Zod schemas live. Server and client both import from here. Never duplicate type definitions across packages.

---

## 3. Express + Vite Middleware

### `server/src/index.ts` — entry point

```typescript
import { createServer } from "vite";
import app from "./app.js";
import { PORT, NODE_ENV } from "./config.js";

const startServer = async () => {
  if (NODE_ENV === "development") {
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, () => {
    console.log(`Oikos running on port ${PORT}`);
  });
};

startServer();
```

In production, serve the static Vite build instead:
```typescript
import { resolve } from "path";
app.use(express.static(resolve("../client/dist")));
app.get("*", (_, res) => res.sendFile(resolve("../client/dist/index.html")));
```

### `server/src/app.ts` — Express app factory

```typescript
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { SESSION_SECRET, CORS_ORIGIN } from "./config.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./modules/auth/auth.routes.js";

const app = express();

app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled — Vite middleware needs it off in dev
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
// app.use("/api/v1/pantry", authMiddleware, pantryRoutes);  ← add modules here

app.use(errorHandler);

export default app;
```

### Middleware stack (order matters)
1. `helmet` — security headers (CSP off in dev for Vite HMR)
2. `cors` — credentials: true for cookie-less JWT flow
3. `express.json` + `express.urlencoded`
4. Route handlers
5. `errorHandler` — always last

---

## 4. Database — Prisma

### `server/src/db/client.ts`

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

Import `{ prisma }` in service files. Never instantiate `PrismaClient` elsewhere.

### `server/package.json` scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "prisma generate --schema=prisma/schema.prisma",
    "db:push": "prisma db push --schema=prisma/schema.prisma",
    "db:migrate": "prisma migrate dev --schema=prisma/schema.prisma",
    "db:deploy": "prisma migrate deploy --schema=prisma/schema.prisma",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio --schema=prisma/schema.prisma"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

### Initial `server/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Module models are added here as each phase is implemented.
// Phase 1 (Pantry) adds: Product, PantryItem
// Phase 2 (Recipes) adds: Recipe, RecipeIngredient, RecipeRating
// etc.
```

---

## 5. Auth — Single-User JWT

### Approach: env-var password + JWT (no user table)

**Rationale:** Oikos is single-user. A `User` table adds password hashing, signup flow, and user management with no benefit. `APP_PASSWORD` is set in `.env`. The login endpoint validates against it using `crypto.timingSafeEqual` (prevents timing attacks). On success it issues a JWT signed with `JWT_SECRET`. The client stores the token in `authStore` (Zustand, in-memory — not persisted to localStorage, so a page refresh re-prompts login).

### `server/src/modules/auth/auth.routes.ts`

- `POST /api/auth/login` — body: `{ password: string }`. Validates against `APP_PASSWORD`. Returns `{ token: string }`.
- `POST /api/auth/logout` — client discards the token. Server is stateless (no token blacklist needed for single-user).
- `GET /api/auth/me` — returns `{ ok: true }` if token is valid; `401` otherwise.

### `server/src/middleware/auth.ts`

```typescript
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";
import { AppError } from "../lib/errors.js";

export const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new AppError("Not authenticated", 401, "UNAUTHORIZED");
  const token = header.slice(7);
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    throw new AppError("Invalid or expired token", 401, "UNAUTHORIZED");
  }
};
```

Apply to all `/api/v1/*` routes. `/api/auth/*` and `/api/health` are public.

### `server/src/lib/errors.ts`

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public status = 500,
    public code = "INTERNAL_ERROR",
    public details: unknown = null,
  ) {
    super(message);
  }
}
```

---

## 6. Claude CLI Wrapper

**`server/src/services/claude.ts`** — all AI calls go through this. No other file calls `exec` for Claude.

### Interface

```typescript
/** Single-turn prompt. */
export const singleTurn = async (
  prompt: string,
  options?: { model?: string; contextFile?: string }
): Promise<string> => { ... };

/** Session-based multi-turn (Gardening Specialist chat). */
export const sessionTurn = async (
  sessionId: string,
  prompt: string,
  options?: { model?: string }
): Promise<string> => { ... };

/** Image prompt for OCR and photo analysis. */
export const imageTurn = async (
  imagePath: string,
  prompt: string,
  options?: { model?: string }
): Promise<string> => { ... };
```

**Implementation notes:**
- Wrap `child_process.exec` in a Promise. Timeout: 120 seconds.
- `stdout` is the response. Non-zero exit code → throw `AppError(502)`.
- `contextFile`: write context to `/tmp/oikos-<uuid>.json`, pipe to stdin, delete in `finally`.
- `imagePath`: verify file exists before calling. Document the exact `--image` flag syntax in a comment once confirmed against the installed Claude CLI version.
- Do not implement streaming in Phase 0.

---

## 7. Frontend Scaffold

### `client/vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  // No proxy needed — Vite runs as Express middleware in dev
});
```

### `client/src/index.css` — design tokens

```css
:root {
  /* Font sizes */
  --fs-primary: 1rem;
  --fs-secondary: 0.875rem;
  --fs-small: 0.75rem;

  /* Spacing (supplement MUI's spacing system for custom components) */
  --sp-page: 16px;
}

[data-theme="dark"] {
  /* Override custom CSS vars for dark mode here.
     MUI component colors are handled by ThemeProvider — only extend here
     for custom CSS properties that MUI does not manage. */
}
```

### `client/src/theme.ts` — MUI theme

```typescript
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2e7d32" },    // green — home/nature
    secondary: { main: "#ff8f00" },  // amber
  },
  typography: {
    fontFamily: "\"Inter\", \"Roboto\", \"Helvetica\", \"Arial\", sans-serif",
  },
  components: {
    MuiBottomNavigation: { styleOverrides: { root: { borderTop: "1px solid rgba(0,0,0,0.12)" } } },
  },
});

export default theme;
```

**Mobile-first navigation:** use MUI `BottomNavigation` for the primary nav on mobile. The `AppShell` component switches to a sidebar drawer on `md` and above.

### `client/src/store/themeStore.ts` — dark mode (Zustand)

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeStore {
  dark: boolean;
  toggle: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      dark: false,
      toggle: () => set((s) => {
        const next = !s.dark;
        document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
        return { dark: next };
      }),
    }),
    { name: "oikos-theme" },
  ),
);
```

On app init (`App.tsx`), read `dark` from the store and set `data-theme` on `document.documentElement` to restore the saved preference.

### Required packages

**`server/package.json` dependencies:**
```
express, cors, helmet, jsonwebtoken, multer, zod, @prisma/client, @oikos/shared
```
**Dev:** `prisma, tsx, nodemon, typescript, @types/express, @types/cors, @types/jsonwebtoken, @types/multer, @types/node`

**`client/package.json` dependencies:**
```
react, react-dom, @mui/material, @mui/icons-material, @emotion/react, @emotion/styled,
react-router-dom, axios, zustand, @oikos/shared
```
**Dev:** `vite, @vitejs/plugin-react, typescript, @types/react, @types/react-dom`

---

## 8. Dev Workflow

### First-time setup
```bash
cp .env.example .env
# Edit .env: set APP_PASSWORD, JWT_SECRET, POSTGRES_PASSWORD

docker compose up --build
```

On first start, the Dockerfile runs `prisma db push` — this creates the database tables from `schema.prisma`. No separate migration step needed in Phase 0 (the schema is empty). As modules are added, run `npm run db:migrate --workspace=server` to create versioned migrations.

### Daily development
```bash
docker compose up
# App: http://localhost:3001
# PostgreSQL: localhost:5432 (connect with any Postgres client)
```

### After any schema change
```bash
# Inside container or via exec:
docker compose exec server npm run db:push --workspace=server
# Then always:
docker compose restart server
```

### Connect to DB
```bash
docker compose exec db psql -U oikos -d oikos
```

---

## Assumptions

- The `claude` CLI binary must be available inside the server container. Either install it in the Dockerfile or bind-mount it from the host. `CLAUDE_BIN` env var should point to its path. Any AI feature fails without it — this is a hard dependency.
- HTTPS is not required for Phase 0. Barcode scanning (which needs HTTPS on non-localhost devices) is a Phase 1 concern. See `docs/architecture.md §8`.
- JWT tokens are in-memory only on the client (not persisted). A page refresh requires re-login. This is acceptable for a personal home server app — the login screen is lightweight.
- Node.js 22 LTS is pinned in the Dockerfile. Do not use 25.x — it is not LTS and introduces breaking changes in some npm workspace resolution edge cases.
