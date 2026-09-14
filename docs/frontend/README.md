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
- **Voice-assisted basket entry** (`VoiceOrderAssistant.tsx`, `services/voiceOrder.ts`): feature-detects the Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`) and renders nothing when unsupported. Supports English (`en-IN`) and Telugu (`te-IN`) via a toggle. Recognition is continuous with a manual stop so a full sentence isn't cut off at a pause. Parses quantity, product name, pack size/unit, package type, unit cost, profit margin, and selling price (deriving selling price from cost+margin when not stated), ranks catalog matches by word overlap, and shows a "Detected for new product" review of every field before requiring a manual confirm tap. Falls back to prefilling Inventory's Add new product form with all detected fields when no product matches. Requires network connectivity because browser speech recognition is cloud-based.
- **Selectable voice engine** (`services/voiceSettings.ts`, `services/sarvamStt.ts`): a Browser/Sarvam toggle next to the language switch, persisted in `localStorage`. Browser uses the built-in Web Speech API above at no cost. Sarvam records audio with `MediaRecorder` and posts it to a Cloudflare Worker proxy (see `/worker`) that holds the Sarvam API key server-side and forwards to Sarvam's speech-to-text API; the worker URL is read from `VITE_SARVAM_PROXY_URL`. If that env var isn't set, choosing Sarvam shows an inline "not configured yet" message instead of failing silently. Sarvam also works on devices without Web Speech API support (e.g. iPhone Safari), since it only needs microphone recording.
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
