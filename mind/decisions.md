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
