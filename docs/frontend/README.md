# SMKG Frontend

## Purpose

The `frontend/` folder contains the installable, offline-first React PWA for SMKG (Sri Mareswari Kinena General Stores). It is built with React, TypeScript, Vite, Dexie, and `vite-plugin-pwa`.

## Local Data

The app uses the browser's IndexedDB via Dexie. It creates a `grocery-inventory` database on the device. Version 2 contains:

- `products`: stock, brand, category, pack size, measurement unit, package type, supplier-batch stock lots, expiry, GST, image, cost, margin, selling price, and timestamps.
- `orders`: submitted sales orders.
- `orderItems`: products, selling prices, and cost snapshots used for realized-profit reporting.
- `productOptions`: owner-managed categories, brands, measurement units, and package types.

Data persists across refreshes and offline use, but site-data clearing can remove it. The app includes JSON backup export/import. A backend sync will provide an additional Postgres backup later.

## Views

- **Home**: products, sales today/month, units sold today, and sales snapshot. Low-stock products appear in a clickable table that opens product details.
- **Products**: searchable catalog with 12 products per page. Search covers product name, brand, MRP, combined pack size/unit, category, measurement unit, and package type. Selecting a product opens stock, pricing, profit, sales, and order history details.
- **Inventory**: add and edit stock, manage catalog options, and import/export backups. Each configurable product dropdown has an Add new shortcut that opens/focuses the matching Catalog options section, preserves form input, and selects the newly added value automatically.
- Stock and order quantities use whole sellable units. Pack size remains decimal-capable for weights and volumes such as 0.5 kilograms. IndexedDB v8 normalizes legacy fractional/negative stock to the nearest non-negative whole unit.
- **Sales**: Orders summary and a separate catalog-style basket page identified by order number. Tap an order for a read-only detail page and Edit order action. Long press enters checkbox selection mode; one selection can be edited/deleted, while multiple selections can be deleted together with stock restoration.

## Run and Test

```bash
cd frontend
npm install
npm run dev
npm run build
```

`npm run build` performs the TypeScript check, production Vite build, and PWA service worker generation.

## PWA Deployment

The GitHub Actions workflow in `.github/workflows/deploy.yml` builds `frontend/` and deploys it to GitHub Pages when `main` changes. The Vite base is relative (`./`) so the deployed PWA works under a repository path.
