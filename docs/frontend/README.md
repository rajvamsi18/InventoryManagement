# SMKG Frontend

## Purpose

The `frontend/` folder contains the installable, offline-first React PWA for SMKG (Sri Mareswari Kinena General Stores). It is built with React, TypeScript, Vite, Dexie, and `vite-plugin-pwa`.

## Local Data

The app uses the browser's IndexedDB via Dexie. It creates a `grocery-inventory` database on the device. Version 9 contains:

- `products`: stock, brand, category, pack size, measurement unit, package type, supplier-batch stock lots, expiry, GST, image, cost, margin, selling price, and timestamps.
- `orders`: submitted sales orders.
- `orderItems`: products, selling prices, and cost snapshots used for realized-profit reporting.
- `productOptions`: owner-managed categories, brands, measurement units, and package types.
- `onlyOrders`: independent orders with embedded free-text product/Volume lines, quantities, prices, and totals. Never included in inventory stock, sales metrics, or catalog queries. Backup v4 includes this table and imports v1-v3 compatibly.

Data persists across refreshes and offline use, but site-data clearing can remove it. The app includes JSON backup export/import. A backend sync will provide an additional Postgres backup later.

## Views

- **Home**: products, sales today/month, units sold today, and sales snapshot. Low-stock products appear in a clickable table that opens product details.
- **Products**: searchable catalog with 12 products per page. Search covers product name, brand, MRP, combined pack size/unit, category, measurement unit, and package type. Selecting a product opens stock, pricing, profit, sales, and order history details.
- **Inventory**: add and edit stock, manage catalog options, and import/export backups. Each configurable product dropdown has an Add new shortcut that opens/focuses the matching Catalog options section, preserves form input, and selects the newly added value automatically.
- Stock and order quantities use whole sellable units. Pack size remains decimal-capable for weights and volumes such as 0.5 kilograms. IndexedDB v8 normalizes legacy fractional/negative stock to the nearest non-negative whole unit.
- **Voice-assisted basket entry** (`VoiceOrderAssistant.tsx`, `services/voiceOrder.ts`): feature-detects the Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`) and renders nothing when unsupported. Supports English (`en-IN`) and Telugu (`te-IN`) via a toggle. Recognition is continuous with a manual stop so a full sentence isn't cut off at a pause. Parses quantity, product name, pack size/unit, package type, unit cost, profit margin, and selling price (deriving selling price from cost+margin when not stated), ranks catalog matches by word overlap, and shows a "Detected for new product" review of every field before requiring a manual confirm tap. Falls back to prefilling Inventory's Add new product form with all detected fields when no product matches. Requires network connectivity because browser speech recognition is cloud-based.
- **Selectable voice engine** (`services/voiceSettings.ts`, `services/sarvamStt.ts`): a Browser/Sarvam toggle next to the language switch, persisted in `localStorage`. Browser uses the built-in Web Speech API above at no cost. Sarvam records audio with `MediaRecorder` and posts it to a Cloudflare Worker proxy (see `/worker`) that holds the Sarvam API key server-side and forwards to Sarvam's speech-to-text API; the worker URL is read from `VITE_SARVAM_PROXY_URL`. If that env var isn't set, choosing Sarvam shows an inline "not configured yet" message instead of failing silently. Sarvam also works on devices without Web Speech API support (e.g. iPhone Safari), since it only needs microphone recording.
- **Sales**: Orders summary and a separate catalog-style basket page identified by order number. Tap an order for a read-only detail page and Edit order action. Long press enters checkbox selection mode; one selection can be edited/deleted, while multiple selections can be deleted together with stock restoration.
- **Order modes**: `OrderHistoryHeader.tsx` provides shared From Inventory/Only Order selectors below Order History and above Recent Orders. Each mode shows only its own saved orders and New order opens that flow directly. From Inventory keeps the existing basket; Only Order opens `OnlyOrdersPage.tsx`, an independent create/list/detail/edit/delete flow with receipts. `services/onlyOrders.ts` validates positive whole quantities and non-negative finite prices/totals, derives price/total bidirectionally, and writes only to `onlyOrders`. Number allocation is inside its transaction; Only Order labels use `Order - N`, with legacy padded labels normalized for display. Only Order receipt lines map into the shared PDF service without being persisted in `orderItems`. Product and voice-review labels now use Volume instead of Pack size; inventory field storage is unchanged.
- **Receipts** (`OrderReceipt.tsx`, `services/receipt.ts`): successful submission opens saved order details. New and existing orders support a receipt preview, optional receipt-only customer name, A5 PDF download, and Web Share file sharing with download fallback. PDFs use persisted order lines rather than mutable catalog prices, exclude costs/margins, show India time and store contact details, and paginate long orders. The receipt bundle is lazy-loaded and precached for offline use. WhatsApp is selected manually from the OS share sheet; actual device sharing requires manual verification.

## Run and Test

PDF receipts use pdfmake with bundled Noto Sans and Noto Sans Telugu regular/bold fonts. Script-aware font runs preserve Telugu grapheme clusters for OpenType shaping and retain Latin glyphs in mixed names. `createReceipt` is asynchronous; `OrderReceipt` prepares a keyed PDF for the current order/customer before enabling Download/Share, so no async generation happens between the Share tap and `navigator.share`. Stale generation results are discarded. Workbox explicitly precaches TTF files and the public OFL license. Regression tests read generated PDFs with PDF.js and cover English/Telugu text, embedded fonts, privacy, amounts and pagination. Visual rendering was inspected with system-font fallback disabled, and production cold generation/share succeeded with the preview server stopped after precaching. The larger PDF renderer remains lazy-loaded with the receipt UI.

Only Order display and saved numbering now use `OR N`; legacy labels normalize on display/edit, including receipt titles. Only Order history reuses `OrderRow` long-press selection, checkbox/select-all controls, and contextual single-edit/bulk-delete actions. `deleteOnlyOrders` deletes only from the independent table. Shared row checkboxes stop pointer/keyboard propagation so clicks toggle once rather than also activating the row. Detail actions have dedicated compact styles instead of inheriting the receipt toolbar's mobile stretching.

`MobileOnlyOrderEditor.tsx` is selected at widths up to 700px using a subscribed media query. It uses a native modal dialog styled as a bottom sheet, a separate temporary product draft, existing `updateOnlyOrderLine`/`parseOnlyOrderLines` validation, compact editable rows, and safe-area-aware fixed actions. Only committed draft rows are passed to order submission; cancelling a sheet does not mutate them. Wider screens retain the desktop editor. Browser checks cover Add & next, row editing/cancellation/deletion, submission and saved-order edits, receipts, 320/390px layouts, a shortened viewport, and switching back to the desktop grid.

Receipt product labels include pack size and measurement unit in preview and PDF. New sales snapshot `measurementValue` and `unit` on order items (optional non-indexed fields, no IndexedDB version change needed). Legacy receipts fall back to the linked product's current pack details. Recorded values take precedence over later catalog changes.

```bash
cd frontend
npm install
npm run dev
npm run build
npm run test:receipt
npm run test:only-orders
```

`npm run build` performs the TypeScript check, production Vite build, and PWA service worker generation.

## PWA Deployment

The GitHub Actions workflow in `.github/workflows/deploy.yml` builds `frontend/` and deploys it to GitHub Pages when `main` changes. The Vite base is relative (`./`) so the deployed PWA works under a repository path.
