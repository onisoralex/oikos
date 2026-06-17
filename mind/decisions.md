# Decisions

Append-only. One entry per significant decision.

Format:
```
## <slug or topic> — <date>
**Decision:** <what was decided>
**Rejected:** <what was considered and not chosen>
**Why:** <rationale>
```

---

## oikos-scope — 2026-05-12
**Decision:** Oikos covers 8 modules: pantry, recipes, finance, financing, shopping list, spending analysis, investment management, plant/gardening. Server app + web frontend.
**Rejected:** Mobile-native app — user confirmed server + web is the target.
**Why:** Server app allows centralized data, easier Claude API integration, accessible from any device via browser.

## oikos-stack-typescript — 2026-05-13
**Decision:** TypeScript throughout — server and client. `tsx watch` for dev HMR, strict mode.
**Rejected:** Plain JavaScript — the reference project uses TS and Prisma's generated client is meaningless without it.
**Why:** Type safety across the full stack, especially valuable with Prisma's generated types and shared types via `packages/shared`.

## oikos-stack-prisma — 2026-05-13
**Decision:** Prisma as ORM (`prisma migrate dev` for dev, `prisma migrate deploy` for prod).
**Rejected:** raw `pg` + `node-pg-migrate` — previously recommended by Tech Specialist for PostgreSQL control.
**Why:** Prisma + TypeScript is the pattern from the reference project. Generated client gives type-safe queries. Trade-off: less raw SQL control, but acceptable for this project's complexity.

## oikos-stack-vite-middleware — 2026-05-13
**Decision:** Vite runs as Express middleware (`middlewareMode: true`). Single Docker service (`server`) on port 3001. No separate frontend container.
**Rejected:** Separate `frontend` Docker service — previously in the Tech Specialist spec.
**Why:** Simpler Docker setup. Reference project uses this pattern. Frontend is a webapp served by the backend, not a standalone SPA with its own container.

## oikos-stack-mui — 2026-05-13
**Decision:** Material UI (MUI v6+) + Material Icons. Mobile-first layout.
**Why:** Clean design system the user is familiar with. Mobile-first because the app will be used on phone (pantry scanning, plant care, shopping list).

## oikos-ai-strategy — 2026-05-12
**Decision:** Claude is invoked via `claude -p` CLI subprocess, not the Anthropic SDK or API client.
**Rejected:** Anthropic Python/Node SDK — user preference; avoids API key management in-app and SDK dependency.
**Why:** `claude -p` is available on the host machine. All AI calls become subprocess spawns, keeping the app decoupled from the SDK.

Three invocation tiers:
1. **Single-turn:** `claude -p "prompt"` — finance analysis, savings suggestions, one-off recipe OCR
2. **Multi-turn:** `claude -p "prompt" --session-id <id>` — gardening specialist chat with conversation continuity
3. **Agentic (Claude Code):** invoke `claude` from the project folder with context written to a file first — for cases where tool use / agentic behavior is needed (e.g. gardening specialist deciding what data to fetch)

## oikos-finance-import — 2026-05-12
**Decision:** Finance import is file-based only (drag-and-drop or upload). No live bank connection.
**Rejected:** python-fints / FinTS live sync — not planned, at least not initially.
**Why:** Simplicity. User will provide a sample import file to define the parser format. Importer must deduplicate — recognize existing entries and only add new ones.

## oikos-client-scaffold-combined — 2026-05-27
**Decision:** Phase 0 client scaffold and Phase 1 pantry frontend were built in a single developer spawn rather than two sequential tasks.
**Rejected:** Splitting into two tasks (scaffold first, then pantry UI).
**Why:** Both are frontend-only work with no branching dependencies between them. Combining avoids a spawn-wait-spawn cycle and the developer can reference both specs in one pass.

## oikos-product-id-filter-deferred — 2026-05-27
**Decision:** `ProductDetailPage` "View pantry items" button navigates to `/pantry?product_id=<id>` but the backend list endpoint does not yet support filtering by `product_id`. Left with an inline comment, not implemented.
**Rejected:** Adding `product_id` filter to the backend list endpoint in the same task.
**Why:** Out of scope for the frontend task. The data model supports it trivially (one more WHERE clause in the service). Deferred to when the ProductDetail page is actually used.
