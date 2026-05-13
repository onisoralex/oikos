# Task Index — oikos-architecture-specs-20260513-000001

**Worker:** Tech Specialist
**Date:** 2026-05-13
**Status:** Complete

## Deliverables

All deliverables were written to `projects/oikos/docs/` as instructed (not in this workspace folder).

| Document | Path | Description |
|---|---|---|
| Architecture reference | `projects/oikos/docs/architecture.md` | Full stack reference: folder structure, module map, API conventions, DB schema, Docker services, Claude CLI pattern |
| Foundation spec | `projects/oikos/docs/specs/00-foundation.md` | Developer implementation spec for Phase 0: Docker Compose, Express scaffold, DB/migrations, auth, Claude CLI wrapper, frontend scaffold, dev workflow |
| Pantry module spec | `projects/oikos/docs/specs/01-pantry.md` | Developer implementation spec for Phase 1: data models, all API endpoints, Open Food Facts integration, ZXing-WASM scanner, expiry logic, UI screens, edge cases |

## Notes

- Architecture doc reflects confirmed stack (Node.js + Express + React + Vite + MUI + PostgreSQL + Docker Compose + claude CLI subprocess). Does not re-open any decided questions.
- Foundation spec recommends `node-pg-migrate` over `db-migrate` with explicit rationale.
- Foundation spec recommends `cookie-session` with env-var password for single-user auth (no user table).
- Pantry spec maps Open Food Facts API response fields explicitly and handles all documented edge cases.
- ZXing-WASM is used for barcode scanning per the confirmed tech stack.
