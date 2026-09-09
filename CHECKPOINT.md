# SMKG Checkpoint

**Updated:** 2026-09-09
**Application:** SMKG - Sri Mareswari Kinena General Stores
**Current phase:** Offline-first frontend MVP

## Completed

- Created the React, TypeScript, Vite PWA in `frontend/`.
- Added GitHub Pages deployment workflow in `.github/workflows/deploy.yml`.
- Configured a generated PWA manifest and offline service worker.
- Added local IndexedDB storage with Dexie (`grocery-inventory`).
- Added portable JSON backup export and validated import.
- Implemented SMKG tabs: Home, Products, Inventory, Sales.
- Added products with stock, cost, profit margin, suggested selling price, low-stock level, create, edit, delete, search, and category filter.
- Added local sales orders that atomically reduce inventory.
- Added order deletion that restores inventory quantities.
- Added submitted order editing; saving an edit reverses the prior stock movement and applies the replacement atomically.
- Added user-managed product categories and standard/manual measurement units and package types.
- Added owner-managed brands and converted all product option types to add/rename/delete controls.
- Added product pack size (`measurementValue`) so variants such as 500 grams and 1 kilogram can be distinguished.
- Moved inventory searching to the Products catalog and removed the growing product list from Inventory.
- Added multi-field catalog search, 12-item pagination, richer product cards, and product stock/sales/order details.
- Upgraded JSON backups to include owner-managed catalog options while preserving v1 import compatibility.
- Added product batch number, expiry date, supplier, GST percentage, and local image fields.
- Added bidirectional unit-cost/margin/MRP calculations.
- Added cost snapshots to order items and realized product profit reporting.
- Added sequential persisted order numbers (`SMKG-000001` onward) and backup v3 restoration of orders/order items.
- Expanded catalog search to MRP and combined pack size/measurement unit.
- Added product matching using name, brand, category, pack size/unit, package type, expiry, unit cost, and MRP; matches update stock/GST rather than creating another card.
- Added supplier-batch stock lots so one catalog product can retain multiple supplier/batch pairs.
- Protected products with sales history from deletion and separated unit cost/profit margin detail tiles.
- Rounded displayed stock quantities to avoid floating-point artifacts such as `6.949999999999999`.
- Collapsed Catalog option values until a section is selected and added product images to individual detail views.
- Added an Add new product flow from Sales that preserves the draft order, returns automatically after save, and adds the new/matched product as an order line.
- Replaced the Sales product dropdown with a dedicated searchable/filterable catalog basket page; order edits use the same basket and submission returns to Recent orders.
- Replaced Home's low-stock list with a clickable Product name / Type / Brand / In stock table linked to product details.
- Updated basket headings to show only the order number; default quick picks show four most-sold products and explicit search/filter results paginate at 12 items.
- Cancelling an existing order edit clears its draft and returns to a New order action.
- Added an explicit Cancel order action for new drafts: Back preserves/continues, while Cancel clears the basket. Recent orders now has Order number / Amount headers and plain numeric row amounts.
- Replaced per-order action links with checkboxes and contextual actions below Recent orders: one selection shows Edit/Delete; multiple selections show bulk Delete with inventory restoration.
- Hid order checkboxes by default: tap opens an order detail page, while a 550ms long press enters selection mode and reveals contextual actions.
- Added Add new shortcuts to Brand, Category, Package type, and Measurement unit fields; they open/focus the matching Catalog options section while preserving form state and automatically selecting the new value.
- Enforced non-negative whole-number product stock, low-stock thresholds, and sale quantities; IndexedDB v8 rounds legacy stock/lot quantities and every stock mutation stays integer-valued.
- Removed horizontal scrolling from the Home attention table and Sales snapshot on mobile.
- Added local Home and Sales dashboards.
- Fixed tab navigation to reset scroll position; Inventory no longer autofocuses its form on mobile and jump-scrolls to the middle of the page.
- Created docs folders: `docs/frontend`, `docs/backend`, `docs/dbSetup`, and `docs/application`.

## Verified

```bash
cd frontend
npm run build
```

The production build passes and generates the PWA service worker.

## Current Local Schema

- `products`
- `orders`
- `orderItems`
- `productOptions`

All records use UUID identifiers and ISO timestamps to support a later FastAPI/PostgreSQL sync.

## Next Work

1. Replace hard deletion with product archiving when a product has sales history.
2. Add focused automated tests using Vitest and fake-indexeddb for stock, options, pagination, and order rules.
3. Consider barcode/SKU, expiry date, supplier, tax, and product image fields after real store testing establishes which are needed.
4. Set up PostgreSQL on the personal laptop using `docs/dbSetup/README.md`.
5. Build FastAPI, PostgreSQL models, sync API, and secure HTTPS/private-network connectivity.

## Important Constraints

- The PWA is GitHub Pages compatible and operates entirely offline.
- Data is browser IndexedDB, not a regular mobile Files `.sqlite` file.
- The owner must export backup files until server synchronization is available.
- An HTTPS GitHub Pages PWA cannot call a plain HTTP FastAPI server on a local laptop. Use a secure private connection or HTTPS before production sync.
