# Oikos — Open Questions

These are deferred by design. Each will be addressed when we reach the relevant module.
Do not block earlier phases on these — pick them up at the module boundary.

---

| # | Question | Relevant Module | Phase |
|---|---|---|---|
| OQ-1 | Which bank(s) does Alex use? What export format — CSV, MT940, CAMT.053? _(Sample file to be provided — see `mind/example files/`)_ | Finance Module — importer | Phase 3 |
| OQ-2 | Recipe OCR: printed books/cards only, or handwritten cards too? | Recipe Module — UX & extraction prompt | Phase 2 |
| OQ-3 | Does the server have a public domain name, or LAN-only? Affects TLS/HTTPS strategy for barcode camera access on iOS. | Pantry Module — barcode scanner | Phase 1 |
| OQ-4 | Gardening Specialist UX: chat interface (streaming session) or periodic report pushed to user? | Plant & Garden Module | Phase 5 |
| OQ-5 | Weather/humidity data source for plant watering logic: local sensor (Home Assistant?), open weather API, or manual input? | Plant & Garden Module | Phase 5 |
| OQ-6 | Single-user forever, or might other household members use it? Affects auth design. | Foundation | Phase 0 |
| OQ-7 | Investment tracking scope: ETFs, individual stocks, Bausparvertrag, or all three? | Investment Management | Phase 5 |

---

## Answered

| # | Question | Answer | Decided |
|---|---|---|---|
| — | Live bank sync needed? | No — file import only | 2026-05-12 |
| — | Claude API or SDK? | `claude -p` CLI via exec | 2026-05-12 |
| — | Translation service? | `claude -p` with Haiku model | 2026-05-13 |
| — | Frontend framework? | React + Vite + Material UI | 2026-05-13 |
