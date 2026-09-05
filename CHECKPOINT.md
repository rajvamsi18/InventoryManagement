# SMKG Checkpoint

**Updated:** 2026-09-05
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

All records use UUID identifiers and ISO timestamps to support a later FastAPI/PostgreSQL sync.

## Next Work

1. Add product detail view and archive behavior for products with historical sales.
2. Add focused automated tests using Vitest and fake-indexeddb for stock, category, and order business rules.
3. Add focused automated tests using Vitest and fake-indexeddb for stock/order business rules.
4. Set up PostgreSQL on the personal laptop using `docs/dbSetup/README.md`.
5. Build FastAPI, PostgreSQL models, sync API, and secure HTTPS/private-network connectivity.

## Important Constraints

- The PWA is GitHub Pages compatible and operates entirely offline.
- Data is browser IndexedDB, not a regular mobile Files `.sqlite` file.
- The owner must export backup files until server synchronization is available.
- An HTTPS GitHub Pages PWA cannot call a plain HTTP FastAPI server on a local laptop. Use a secure private connection or HTTPS before production sync.
