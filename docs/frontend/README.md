# SMKG Frontend

## Purpose

The `frontend/` folder contains the installable, offline-first React PWA for SMKG (Sri Mareswari Kinena General Stores). It is built with React, TypeScript, Vite, Dexie, and `vite-plugin-pwa`.

## Local Data

The app uses the browser's IndexedDB via Dexie. It creates a `grocery-inventory` database on the device. Version 2 contains:

- `products`: stock, cost, optional profit margin, suggested selling price, and timestamps.
- `orders`: submitted sales orders.
- `orderItems`: the products and prices sold in each order.

Data persists across refreshes and offline use, but site-data clearing can remove it. The app includes JSON backup export/import. A backend sync will provide an additional Postgres backup later.

## Views

- **Home**: products, sales today/month, units sold today, low-stock products, and sales snapshot.
- **Products**: searchable product catalog. Edit opens the Inventory tab.
- **Inventory**: add, edit, delete, search, filter, import, and export inventory.
- **Sales**: create an order, use suggested selling prices, adjust quantity/price, submit a sale, see recent orders, and delete an order to restore stock.

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
