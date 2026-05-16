# Spec 01 — Pantry Module (Phase 1)

**Status:** Ready to implement
**Date:** 2026-05-13
**Produced by:** Tech Specialist (task: oikos-architecture-specs-20260513-000001)
**Depends on:** Phase 0 (Foundation) must be complete — PostgreSQL running, migrations tool in place, Express scaffold, auth middleware, frontend scaffold.

---

## Overview

The Pantry module tracks food items in the household. A `product` is the catalogue entry (what the thing is — name, brand, nutrition info). A `pantry_item` is a specific instance of that product in the pantry (how many, where, when it expires).

**v1 scope:** Manual entry only. The user enters name, size/unit (e.g. 200g, 500ml, 1 small jar), quantity, expiry date, and location directly. No barcode scanning in v1.

**Optional enhancement (v1+):** Barcode scanning via camera + Open Food Facts lookup. Blocked on OQ-3 (HTTPS strategy) — `getUserMedia` requires HTTPS on non-localhost devices. Implement only after OQ-3 is resolved. The data model already supports it (`barcode`, `source`, `off_id` fields on `Product`) so no schema changes will be needed when the time comes.

---

## 1. Data Models

Both tables are created in a single migration file: `backend/src/db/migrations/002_pantry.js`.

### `products` table

```sql
CREATE TABLE products (
  id               SERIAL PRIMARY KEY,
  barcode          VARCHAR(30) UNIQUE,
  name             TEXT NOT NULL,
  brand            TEXT,
  category         TEXT,
  nutritional_info JSONB,
  image_url        TEXT,
  source           VARCHAR(10) NOT NULL DEFAULT 'manual'
                   CHECK (source IN ('off', 'manual')),
  off_id           TEXT,             -- Open Food Facts internal _id field
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('simple', name));
```

**`nutritional_info` JSONB shape** (matches Open Food Facts response; all fields optional):
```json
{
  "energy_kcal_100g": 342,
  "fat_100g": 12.5,
  "saturated_fat_100g": 4.1,
  "carbohydrates_100g": 48.0,
  "sugars_100g": 6.2,
  "fiber_100g": 3.1,
  "proteins_100g": 8.4,
  "salt_100g": 0.9,
  "nutriscore_grade": "c",
  "allergens": ["gluten", "milk"]
}
```

**Field notes:**
- `barcode` is nullable — a product can be created without a barcode (manual entry without a barcode scanner).
- `off_id` stores the OFF `_id` field (same as the barcode for most products but kept separate).
- `source` = `'off'` if imported from Open Food Facts; `'manual'` if user-entered.
- `updated_at` should be maintained via a trigger or set explicitly on every UPDATE.

---

### `pantry_items` table

```sql
CREATE TABLE pantry_items (
  id          SERIAL PRIMARY KEY,
  product_id  INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    NUMERIC(10, 3) NOT NULL DEFAULT 1,
  unit        VARCHAR(20),          -- 'g', 'ml', 'pcs', 'pkg', etc.
  expiry_date DATE,
  location    TEXT,                 -- e.g. 'Kühlschrank', 'Vorratskeller', 'Gefrierfach'
  notes       TEXT,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pantry_items_product_id ON pantry_items(product_id);
CREATE INDEX idx_pantry_items_expiry_date ON pantry_items(expiry_date) WHERE expiry_date IS NOT NULL;
```

**Field notes:**
- `quantity` uses `NUMERIC(10,3)` to handle fractional amounts (e.g. 0.5 kg, 250 ml).
- `unit` is a free-text field — do not enumerate; users have varied units. Frontend should suggest common values.
- `expiry_date` is nullable — many items (spices, canned goods) may not have a tracked expiry.
- `location` is free-text. Common defaults: `'Kühlschrank'`, `'Tiefkühler'`, `'Vorrat'`.
- Multiple `pantry_items` rows can reference the same `product_id` — e.g. two packages of the same pasta with different expiry dates.

---

## 2. API Endpoints

All endpoints are prefixed `/api/v1/pantry/` and require auth middleware.

### Barcode lookup

```
GET /api/v1/pantry/lookup/:barcode
```
**Path param:** `barcode` — EAN-13, EAN-8, or UPC-A string.

**Logic:**
1. Query `products` table by `barcode`.
2. If found → return product immediately (DB cache hit).
3. If not found → call Open Food Facts API.
4. If OFF returns a product → insert into `products` (source = 'off') → return product.
5. If OFF returns 404 or empty → return `{ found: false }` with HTTP `200` (not 404 — this is a valid outcome, not an error).

**Response (found):**
```json
{
  "success": true,
  "data": {
    "found": true,
    "product": {
      "id": 42,
      "barcode": "4000521001596",
      "name": "Knorr Fix Spaghetti Bolognese",
      "brand": "Knorr",
      "category": "Sauces and condiments",
      "nutritional_info": { ... },
      "image_url": "https://images.openfoodfacts.org/...",
      "source": "off"
    }
  }
}
```

**Response (not found):**
```json
{
  "success": true,
  "data": { "found": false, "barcode": "4000521001596" }
}
```

---

### Pantry items — List

```
GET /api/v1/pantry/items
```
**Query params:**
- `page` (default 1), `pageSize` (default 25)
- `search` — text search on `products.name`
- `category` — filter by `products.category`
- `location` — filter by `pantry_items.location`
- `expiring_within_days` — if set, only return items with `expiry_date <= NOW() + interval '<n> days'`
- `sort` — `expiry_asc` (default when filter active), `name_asc`, `added_desc`

**Response:** Array of pantry items with joined product fields:
```json
{
  "success": true,
  "data": [
    {
      "id": 7,
      "product_id": 42,
      "product_name": "Knorr Fix Spaghetti Bolognese",
      "product_brand": "Knorr",
      "product_category": "Sauces and condiments",
      "product_image_url": "...",
      "quantity": 2,
      "unit": "pcs",
      "expiry_date": "2026-06-15",
      "days_until_expiry": 33,
      "location": "Vorrat",
      "notes": null,
      "added_at": "2026-05-01T10:30:00Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 25, "total": 47, "totalPages": 2 }
}
```

`days_until_expiry` is computed in SQL: `(expiry_date - CURRENT_DATE)::int`. Null if `expiry_date` is null.

---

### Pantry items — Add

```
POST /api/v1/pantry/items
```
**Body:**
```json
{
  "product_id": 42,
  "quantity": 2,
  "unit": "pcs",
  "expiry_date": "2026-06-15",
  "location": "Vorrat",
  "notes": "Bought from Rewe"
}
```
All fields except `product_id` are optional. `product_id` must reference an existing `products` row.

**Response:** `201` with created pantry item.

---

### Pantry items — Update

```
PATCH /api/v1/pantry/items/:id
```
**Body:** Any subset of `quantity`, `unit`, `expiry_date`, `location`, `notes`. Partial update — only provided fields are changed. Returns updated item.

---

### Pantry items — Delete

```
DELETE /api/v1/pantry/items/:id
```
Returns `204 No Content`. Does not delete the associated `product` row.

---

### Products — Manual create

```
POST /api/v1/pantry/products
```
For when barcode lookup returns `found: false` or user wants to add a product without a barcode.

**Body:**
```json
{
  "barcode": "4000521001597",    // optional
  "name": "Hausmarke Nudeln 500g",
  "brand": "Rewe",
  "category": "Pasta",
  "nutritional_info": { ... },   // optional
  "image_url": null
}
```
Sets `source = 'manual'`. Returns `201` with created product.

---

### Products — Update

```
PATCH /api/v1/pantry/products/:id
```
Same partial-update semantics as PATCH items.

---

### Expiry warnings

```
GET /api/v1/pantry/expiring?days=7
```
Returns all pantry items with `expiry_date` between `NOW()` and `NOW() + interval '<days> days'`, ordered by `expiry_date ASC`. Uses the same response shape as the items list endpoint (no pagination — warning lists are expected to be short).

**Query param:** `days` — integer, default `7`, max `90`.

Also returns items with `expiry_date < NOW()` (already expired) in a separate `expired` array:
```json
{
  "success": true,
  "data": {
    "expiring_soon": [ ... ],   // within <days>
    "expired": [ ... ]          // past expiry date
  }
}
```

---

## 3. Open Food Facts Integration

### HTTP call (from Node.js)

Use `axios` for the OFF API call. Required headers:

```javascript
const response = await axios.get(
  `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
  {
    headers: {
      'User-Agent': 'Oikos-HomeServer/1.0 (a.j.onisor@gmail.com)',
    },
    timeout: 8000,
  }
);
```

**User-Agent is required by OFF's terms of service.** Use the format `AppName/Version (contact)`.

### Response mapping to `products` table

OFF returns a `product` object with many fields. Map as follows:

| OFF field | `products` column | Notes |
|---|---|---|
| `_id` | `off_id` | |
| `code` | `barcode` | |
| `product_name` or `product_name_de` | `name` | Prefer `product_name_de` if present |
| `brands` | `brand` | May be comma-separated — take first |
| `categories_tags[0]` | `category` | First tag, strip `en:` prefix |
| `image_front_url` | `image_url` | |
| Nutrition fields (see below) | `nutritional_info` (JSONB) | |

Nutrition mapping:
```javascript
nutritional_info = {
  energy_kcal_100g:      product.nutriments?.['energy-kcal_100g'] ?? null,
  fat_100g:              product.nutriments?.fat_100g ?? null,
  saturated_fat_100g:    product.nutriments?.['saturated-fat_100g'] ?? null,
  carbohydrates_100g:    product.nutriments?.carbohydrates_100g ?? null,
  sugars_100g:           product.nutriments?.sugars_100g ?? null,
  fiber_100g:            product.nutriments?.fiber_100g ?? null,
  proteins_100g:         product.nutriments?.proteins_100g ?? null,
  salt_100g:             product.nutriments?.salt_100g ?? null,
  nutriscore_grade:      product.nutriscore_grade ?? null,
  allergens:             product.allergens_tags?.map(t => t.replace('en:', '')) ?? [],
};
```

### ON 404 / empty result

If `response.data.status === 0` or the `product` object is absent, return `{ found: false }` to the controller. Do **not** insert anything into the DB. The frontend will display a manual-entry form.

### Rate limiting

OFF rate limit is 15 requests/minute per IP. At personal-use volumes this will never be hit, but add a try/catch for `429` status and return a `503` error with a `Retry-After` hint if it occurs.

---

## 4. Barcode Scanner (Frontend)

### Library: ZXing-WASM

Install: `npm install zxing-wasm`

ZXing-WASM is a WebAssembly port of the ZXing barcode library. It decodes barcodes from video frames in-browser with no server round-trip.

**React component: `frontend/src/pages/Pantry/ScanPage.jsx`**

Key implementation steps:

1. **Camera permission flow:**
   - On mount, call `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`.
   - `facingMode: 'environment'` requests the rear camera on mobile.
   - On permission denied: show an error message explaining that camera access is required and that HTTPS is needed. Do not crash silently.

2. **Video element:** Render a `<video>` element, assign the media stream to `video.srcObject`, and call `video.play()`.

3. **Decode loop:** Use `requestAnimationFrame` to grab frames from the video via a hidden `<canvas>`. Pass the canvas ImageData to ZXing-WASM's `readBarcodesFromImageData()` function.
   - ZXing-WASM is async (WASM initialization). Call `await prepareZXingModule()` once on mount before starting the loop.
   - Target formats: `['EAN13', 'EAN8', 'UPCA', 'UPCE']` — food packaging barcodes only.

4. **On successful decode:**
   - Stop the decode loop immediately (debounce — do not fire multiple times for the same barcode).
   - Play a brief haptic or audio feedback if available (`navigator.vibrate(100)`).
   - Call `GET /api/v1/pantry/lookup/:barcode`.
   - Show result overlay (see §6 below).

5. **Cleanup:** On component unmount, stop all media tracks (`stream.getTracks().forEach(t => t.stop())`).

**HTTPS requirement:** `getUserMedia` requires HTTPS in production. In development, `localhost` is exempt. Document this in the deployment README.

---

## 5. Expiry Date Logic

### Threshold defaults
- **Warning threshold:** 7 days (configurable — store in a `settings` table or env var in Phase 0; use env var for now: `EXPIRY_WARN_DAYS=7`)
- **Alert threshold:** 3 days (items due within 3 days are highlighted red; 4–7 days orange)
- **Expired:** Already past `expiry_date` — shown in a separate "Expired" section

### Calculation
All expiry logic is in SQL on the backend, using `(expiry_date - CURRENT_DATE)::int` as `days_until_expiry`. The frontend receives a numeric value and applies colour logic:

```
days_until_expiry < 0    → status: 'expired'   → red badge
days_until_expiry 0–3    → status: 'critical'  → red badge
days_until_expiry 4–7    → status: 'warning'   → orange badge
days_until_expiry > 7    → status: 'ok'        → green/no badge
```

### UI surfacing
- **Pantry overview list:** Items within warning threshold get a coloured badge next to the expiry date.
- **Dashboard / top-level indicator:** Show count of expiring-soon + expired items in the navigation badge (e.g. a red dot on the Pantry nav item).
- **`GET /api/v1/pantry/expiring?days=7`** is called on app load to populate the dashboard widget. No push notifications in Phase 1.

---

## 6. UI Screens

### Pantry Overview (`/pantry`)
- **Layout:** MUI `DataGrid` or custom card list (card list preferred for mobile UX).
- **Each item card shows:** Product name, brand, quantity + unit, expiry date with colour badge, location, thumbnail image if available.
- **Controls:**
  - Search bar (text, debounced 300ms, calls list endpoint with `search=` param)
  - Filter chips: category, location, "Expiring soon"
  - Sort selector: Name A–Z, Expiry date ↑, Date added ↓
  - FAB (floating action button): opens Scan screen or Add Item form
- **Expired items:** Shown in a collapsible section at the top with a red header.

### Scan Screen (`/pantry/scan`)
- Full-viewport camera view with a centered reticule rectangle as visual guide.
- Status text below reticule: "Scan a barcode..." → "Looking up product..." → product name or "Product not found".
- **On product found:** Slide-up sheet (MUI `Drawer`) shows product card with name, image, brand, Nutri-Score. Two buttons: "Add to Pantry" → opens Add Item Form; "Cancel".
- **On product not found:** Slide-up sheet: "Barcode not in database. Add manually?" → button opens Add Item Form pre-filled with the barcode.
- **Manual entry button:** Top-right of screen for users who want to add without scanning.

### Add / Edit Item Form (`/pantry/items/new` or `/pantry/items/:id/edit`)
- **Fields:**
  - Product (read-only if coming from scan; or product picker/search if manual)
  - Quantity (number input with +/− stepper buttons)
  - Unit (text field with MUI `Autocomplete` suggesting: pcs, g, kg, ml, l, pkg, Dose, Flasche, Tüte)
  - Expiry date (MUI `DatePicker`)
  - Location (text field with `Autocomplete` suggesting: Kühlschrank, Tiefkühler, Vorrat, Gefrierfach)
  - Notes (optional multiline text)
- **Validation:** Quantity > 0 required. Product required.
- **Submit:** POST or PATCH to the appropriate endpoint. On success, navigate back to overview and show a snackbar confirmation.

### Product Detail (`/pantry/products/:id`)
- Shows all product fields: name, brand, category, nutritional information (formatted table), barcode, source.
- "Edit" button opens a form for manual product updates.
- "View pantry items" link shows all pantry items for this product.

---

## 7. Edge Cases

### Barcode not found in Open Food Facts
- Return `{ found: false }` from the lookup endpoint.
- Frontend shows "Product not found. Add manually?" prompt.
- User fills in name, category, and optional nutrition info.
- On form submit, `POST /api/v1/pantry/products` creates the product (source = 'manual'), then `POST /api/v1/pantry/items` creates the pantry item.
- The barcode is stored on the manual product — a future OFF lookup for the same barcode will hit the local DB first and return the manual record.

### Duplicate scan (item already in pantry)
- The lookup endpoint returns the product if it exists — it does not check for existing pantry items.
- The Add Item Form is always shown after a successful scan. The user decides whether to add another instance (second package of the same product with a different expiry date) or cancel.
- Do not auto-increment quantity on duplicate scan — this would be wrong if the user scans a different package.
- The list endpoint groups by product_id only on the frontend (optional visual grouping); the DB stores separate rows per pantry item.

### Expiry date unknown
- `expiry_date` is nullable. If the user does not enter an expiry date, the item is stored without one.
- Items without an expiry date never appear in expiry warning results.
- In the UI, items without an expiry date show "No expiry" in a neutral grey.

### Open Food Facts rate limit (429)
- Return HTTP `503 Service Unavailable` to the frontend with message "Product lookup temporarily unavailable. Please try again in a moment or add the product manually."
- Log the 429 event on the backend.
- The frontend should offer the "Add manually" option whenever the lookup endpoint returns a non-200 status.

### Product with same barcode already in DB
- `barcode` has a `UNIQUE` constraint on `products`.
- If the lookup calls `INSERT INTO products` and the barcode already exists (race condition, or a second scan during the network call), catch the unique constraint violation (`23505` PostgreSQL error code) and return the existing product instead of throwing.

### Large nutritional_info from OFF
- OFF can return very large `nutriments` objects. Only map the fields listed in §3. Discard the rest — do not store the full OFF response.

---

## Backend Module File Responsibilities (Pantry)

| File | Responsibility |
|---|---|
| `pantry.routes.js` | Register all routes, apply `multer` if needed for future image uploads, delegate to controller |
| `pantry.controller.js` | Validate request params/body, call service methods, format response envelope |
| `pantry.service.js` | Business logic: barcode lookup sequence (DB → OFF → manual), expiry calculations, dedup |
| `pantry.model.js` | All SQL queries: `findProductByBarcode`, `createProduct`, `listPantryItems`, `createPantryItem`, `updatePantryItem`, `deletePantryItem`, `findExpiringItems` |

The OFF HTTP call belongs in `pantry.service.js` (or a dedicated `services/openFoodFacts.js` file if it grows). The controller never makes HTTP calls to external APIs.

---

## Assumptions

- HTTPS is assumed in production for camera access. In Phase 1 development on `localhost`, the browser exempts HTTPS for `getUserMedia`.
- ZXing-WASM WASM file must be served correctly — Vite handles this automatically for npm packages that include WASM, but verify the `wasm` file is included in the build output.
- The `claude` CLI binary is not required for Phase 1 (pantry has no AI features). This phase has no Claude CLI dependency.
- Open Food Facts API has no authentication requirement. The User-Agent header is the only mandatory header beyond standard HTTP.
- The `products` table will be shared across modules in the future (e.g. Shopping List will reference product names). The table lives in the `pantry` migration file but is conceptually shared data.
