# Oikos Integration Research Report
**Date:** 2026-05-12
**Scope:** APIs, libraries, and open-source tools for a personal home management server (Germany-based user)

---

## 1. Barcode / Product Lookup

### Best Option: Open Food Facts (primary) + fallback to UPCitemdb

#### Open Food Facts
- **What it is:** Crowd-sourced open database of packaged food products. Covers nutritional info, ingredients, Nutri-Score, allergens, labels.
- **German coverage:** ~200,000+ products tagged as available in Germany out of ~4M total. Best European coverage of any free option; German community is active.
- **API:** Free, no auth needed beyond a custom User-Agent. Rate limits: 15 req/min/IP (product queries), 10 req/min/IP (search).
  - Endpoint: `GET https://world.openfoodfacts.org/api/v2/product/{barcode}`
- **Nutritional data:** Macros/micros, ingredients, allergens, categories, Nutri-Score, product photos.
- **Licensing:** Open Database License (ODbL). Free with attribution.
- **Key limitation:** Crowd-sourced — completeness varies. Lesser-known German regional brands may have sparse or missing data.
- **Source:** https://world.openfoodfacts.org / https://openfoodfacts.github.io/openfoodfacts-server/api/

#### UPCitemdb (fallback)
- **What it is:** Commercial product database, 696M+ barcodes, EAN codes supported.
- **Free tier:** ~100 lookups/day (trial, heavily rate-limited).
- **European coverage:** Weaker than Open Food Facts for food-specific European EANs. Better for branded consumer goods.
- **Source:** https://devs.upcitemdb.com/

**Recommendation:** Open Food Facts as primary. Add UPCitemdb as fallback for gaps. Both are free at personal-use volumes.

---

### Browser Barcode Scanning (JS/WASM)

#### zbar-wasm (Recommended)
- **What it is:** WebAssembly port of the ZBar C/C++ barcode scanner.
- **Formats:** EAN-13, EAN-8, UPC-A, UPC-E, Code-128, Code-39, QR Code, ISBN — all formats on food packaging.
- **Bundle size:** ~330 KB.
- **License:** LGPL-2.1
- **Source:** https://github.com/undecaf/zbar-wasm

#### ZXing-WASM
- **What it is:** WASM port of the ZXing multi-format barcode library. More actively developed.
- **License:** Apache 2.0

**Recommendation:** Either works. zbar-wasm for smaller bundle; ZXing-WASM for more active maintenance.

---

## 2. Recipe OCR & Extraction

### Options Comparison

| Approach | Quality | Cost | Self-hostable | Notes |
|---|---|---|---|---|
| LLM vision (Claude/GPT-4o) | Highest | Pay-per-use (negligible at personal scale) | No | Best structured extraction from photos |
| Google Cloud Vision / Document AI | High | $1.50–$10 per 1K pages | No | Good raw OCR; needs post-processing for recipes |
| AWS Textract | High | $1.50–$15 per 1K pages | No | Better for forms/tables than narrative recipes |
| PaddleOCR | Good | Free | Yes | Best open-source; PP-Structure handles complex layouts |
| Tesseract | Moderate | Free | Yes | Baseline open-source; struggles with complex recipe layouts |

#### LLM Vision (Claude/GPT-4o) — Recommended
- **Approach:** Send recipe photo to a multimodal LLM with a structured extraction prompt requesting JSON output (title, ingredients with quantities/units, steps, times, servings).
- **Quality:** Highest available for real-world recipe photos. Understands context — can infer units and steps even from partially obscured or decorative text.
- **Cost:** Negligible for personal use — fractions of a cent per image at Haiku/Sonnet tiers.

#### PaddleOCR (self-hosted fallback)
- **What it is:** Open-source OCR from Baidu with PP-Structure layout analysis.
- **Quality:** Significantly outperforms Tesseract on complex layouts. 80+ languages.
- **License:** Apache 2.0

**Recommendation:** LLM vision (Claude API) for recipe photo extraction. PaddleOCR as self-hosted fallback.

---

## 3. Translation

### DeepL API (Recommended)
- **Quality:** Best-in-class for European language pairs, especially German ↔ English.
- **Free tier (2026):** 500,000 characters/month. Note: free plan no longer available for new signups — only as downgrade from Pro.
- **Pro pricing:** $5.49/month base + $25.00 per 1M characters.
- **Practical cost:** Personal-use volumes will stay well under 500K chars/month.
- **Source:** https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans

### Google Translate API
- **Quality:** Solid German support, inferior to DeepL for idiomatic text.
- **Pricing:** $20 per 1M characters. No free API tier.

### LibreTranslate (Self-hosted)
- **Quality:** Below DeepL and Google for German. Acceptable for basic words; unreliable for recipe steps.
- **License:** AGPLv3
- **Use case:** Only if offline/self-hosted is a hard requirement.

**Recommendation:** DeepL API. LibreTranslate as self-hosted fallback only if external API calls must be avoided.

---

## 4. Plant / Gardening Databases

### Perenual API (Recommended for houseplants)
- **Database:** 10,000+ plant species. Care guides, watering frequency, sunlight, fertilization, pest/disease data, harvest data.
- **Free tier:** 100 API requests/day, species 1–3,000. Covers common houseplants.
- **Paid tiers:** Premium: $49.99/month; Supreme: $99.99/month (full dataset, advanced care fields).
- **Key limitation:** Detailed watering fields locked behind Supreme tier. Cache responses locally to stay within free tier.
- **Source:** https://perenual.com/docs/api

### OpenFarm (Recommended for vegetables/herbs)
- **What it is:** Crowd-sourced growing guides. Seed spacing, watering regimes, companion plants, soil, sun requirements.
- **Coverage:** Best for vegetables, herbs, and garden crops. Less comprehensive for ornamental houseplants.
- **API:** Public RESTful JSON API (alpha status).
- **Licensing:** Creative Commons. Free.
- **Source:** https://github.com/openfarmcc/OpenFarm

### Trefle API
- **Focus:** Scientific/botanical data. Less practical for home care schedules.
- **Pricing:** Free. Maintenance status uncertain.
- **Source:** https://trefle.io/

**Recommendation:** Perenual (free tier) for houseplants + OpenFarm for vegetables/herbs. Cache all responses locally.

---

## 5. Finance Data Import

### German Bank Export Formats
- **MT940:** Legacy SWIFT standard. Universally supported by German banks. Being phased out — SWIFT retirement: November 2028.
- **CAMT.053 XML:** Modern ISO 20022 standard. Now primary format for German banks. Richer data.
- **CSV:** Widely offered; non-standardized — each bank uses its own column structure.

### Open-Source Parsers

#### bankstatementparser (Python) — Recommended
- **Covers:** CAMT.053, MT940, PAIN.001, CSV, OFX/QFX, and PDF (digital + scanned via LLM fallback).
- **Quality:** 718 tests, 100% branch coverage, Python 3.10–3.14. Actively maintained.
- **License:** Apache 2.0
- **Source:** https://github.com/sebastienrousseau/bankstatementparser

#### pycamt
- **Covers:** CAMT.053 XML specifically. Lightweight alternative.
- **Source:** https://pypi.org/project/pycamt/

### Live Bank Sync (Germany)

#### python-fints — Recommended
- **What it is:** Pure-Python FinTS (formerly HBCI) implementation. Supported by almost all German banks.
- **Capabilities:** Fetch accounts, balances, full transaction history, holdings. Supports SEPA transfers.
- **PSD2 note:** TAN interaction required. Fully automated headless import is not straightforward.
- **Advantage:** Covers more account types than PSD2 mandates. No AISP license required.
- **Source:** https://python-fints.readthedocs.io/

**Recommendation:** `bankstatementparser` for file import. `python-fints` for live sync with periodic TAN interaction.

---

## 6. Existing Open-Source Home Management Apps

### Grocy
- **Scope:** Pantry inventory, expiry tracking (FIFO/FEFO), shopping lists, recipes, meal planning, chores.
- **Barcode:** Built-in scanning. Open Food Facts is the default product lookup plugin.
- **What it does well:** Most complete home ERP. German-origin. Deep inventory logic is hard to replicate.
- **Gaps vs. Oikos:** No finance module. No plant management. Basic recipe module.
- **License:** MIT | **Source:** https://grocy.info/

### Tandoor Recipes
- **Scope:** Recipe storage/import, nutritional tracking, meal cost calculation, meal planning, shopping lists.
- **What it does well:** Most feature-rich recipe manager. Granular permissions, flexible meal planning.
- **Gaps:** Recipes only.
- **License:** AGPL-3.0 | **Source:** https://tandoor.dev/

### Mealie
- **Scope:** Recipe management, URL scraping/import, meal planning, shopping lists. Image import supported.
- **What it does well:** Best UX of the recipe managers. Clean UI, excellent web scraping, active community.
- **Gaps:** Recipes only. No pantry beyond shopping lists.
- **License:** AGPL-3.0 | **Source:** https://docs.mealie.io/

### Firefly III
- **Scope:** Personal finance — double-entry bookkeeping, multi-currency, budgets, recurring transactions, reporting dashboards.
- **Import:** MT940 and CAMT.053 supported via companion data-importer tool.
- **What it does well:** Comprehensive finance tracking, strong categorization rules, excellent reporting.
- **Gaps:** Finance only.
- **License:** AGPL-3.0 | **Source:** https://www.firefly-iii.org/

---

## Summary Table

| Area | Recommended Option | License | Cost |
|---|---|---|---|
| Barcode → product data | Open Food Facts API | ODbL | Free |
| Browser barcode scanning | zbar-wasm | LGPL-2.1 | Free |
| Recipe OCR/extraction | LLM vision (Claude API) | Proprietary | Negligible at personal scale |
| Self-hosted OCR fallback | PaddleOCR | Apache 2.0 | Free |
| Translation | DeepL API | Proprietary | ~$5.49/mo Pro (free tier restricted) |
| Plant data — houseplants | Perenual API (free tier) | Proprietary | Free (100 req/day) |
| Plant data — vegetables/herbs | OpenFarm | CC | Free |
| Bank statement file parsing | bankstatementparser | Apache 2.0 | Free |
| Live German bank sync | python-fints | Open source | Free (TAN required) |
| Reference pantry app | Grocy | MIT | Free |
| Reference recipe app | Mealie | AGPL-3.0 | Free |
| Reference finance app | Firefly III | AGPL-3.0 | Free |
