# SMKG Checkpoint

**Updated:** 2026-11-13
**Application:** SMKG - Sri Mareswari Kirana & General Stores
**Current phase:** Offline-first frontend MVP

## Completed

- Credit Order verification: 11 credit ledger/backup tests, 7 Only Order tests, and 7 receipt tests pass (25 total). Production build passes; the existing PDF chunk-size warning remains. Lint reports existing warnings in other components. Isolated browser checks cover edits, multi-select deletion, archive/restore, list editing, pagination, and 320/390/1280px layouts without changing user records.

- Added a review-first WhatsApp Read List path for Only Order: paste text or receive it through the installed Android PWA share target, parse with a separate Cloudflare Workers AI route (`@cf/qwen/qwen3-30b-a3b-fp8`), and create unsaved editable draft rows. **Add another message** appends later messages to the same draft, preserving previous edits/prices and retaining all source messages for comparison. Saved orders persist source-to-line associations; Edit order can detect duplicate messages, replace only one source's lines while preserving prices for unchanged product/Volume matches, or delete one source and its lines. These changes save with the normal order edit. It does not look up inventory or prices; imported Price/Total stay blank. Missing or unclear quantities default to 1 and carry a visible review flag. Clear size words such as big/small are instructed as Volume rather than product-name text. Worker limits input size, result rows, and request bursts, and enables JSON mode for inference. Worker and Only Order tests pass; screenshot-provided WhatsApp text parsed successfully, including quantity-free items. Additional Telugu/transliterated customer messages still need testing.
- Fixed Only Order mobile history actions so Read List and New order no longer compete with the Recent Orders heading at narrow widths; the title and two actions now use separate rows.

- Enabled positive decimal quantities in Only Order on mobile and desktop, including saving/editing, backup validation, and receipts. Zero/negative/non-finite quantities remain invalid; inventory-linked stock/sale quantities are still whole numbers. Regression coverage includes 1.25 x 65 = 81.25 and 0.25 x 65 = 16.25, reverse price derivation, decimal persistence/backup acceptance, and receipt output.

- Fixed unreadable Telugu receipt PDFs by replacing Helvetica/jsPDF rendering with pdfmake OpenType shaping and locally bundled Noto Latin/Telugu fonts. Supports mixed product names, Telugu Volume/customer text, and selectable Unicode PDF text. PDF preparation now completes before Download/Share; old PDFs must be regenerated. Fonts and their license are precached for offline use. All seven regression tests pass; inspected a rendered mixed-language PDF without system-font fallback and verified fresh production PDF generation/share with its server stopped (active user gesture retained). Runtime dependency audit is clean. Receipt renderer is larger but still lazy-loaded.

- Changed Only Order labels to `OR N` in history, details, saved records and receipts; legacy labels normalize without changing inventory-order numbering. Added Only Order long-press multi-selection, checkboxes/select-all, single Edit, confirmed bulk Delete, and Clear selection. Reduced mobile detail action sizes and prevented checkbox pointer/keyboard events from double-toggling shared order rows. Verified cancellation and deletion with temporary fixtures, unselected-order/inventory preservation, OR receipt PDF output, mobile layouts, and checkbox interaction in both flows.

- Added mobile-only compact Only Order entry/editing with a bottom-sheet product editor, Add & next/Done actions, temporary product drafts, row editing/deletion, and a fixed safe-area-aware total/Add/Submit/Cancel bar. Desktop grid is unchanged. Verified eight-product entry, cancellation, quantity validation, edits/deletion, no persistence before submission, order submission and saved-order edits, receipt values, mobile 320/390px and shortened-viewport layouts, and desktop switching. Build, lint and all six regression tests pass; actual iPhone keyboard behavior remains for owner review.

- Made Volume optional in Only Order creation/editing and backup validation. Blank-volume receipts show just the product name. Inventory Volume requirements are unchanged; regression tests cover blank-volume saving and backup compatibility.

- Updated Sales navigation to an **Orders** landing page with From Inventory and Only Order choices. Selecting a flow reveals inline **All Orders** and **Create Order** choices (no chooser popup); Only Order creation offers inline **From list** (WhatsApp Read List) or **Without list**, while From Inventory retains its catalog basket. The Read List message-entry dialog remains. Each All Orders view has its own 5/10/20 pagination and searches all saved orders by order number, customer, date, or exact amount before paging. The history view has an **Orders** back action, and customer names appear below order numbers.

- Improved order creation and detail pages with optional saved customer names. The name is shown below the order number during entry, in order history/details, and in receipts. Only Order edit/create identity text is 20px; customer rows and receipt metadata use the matching requested hierarchy.

- Added a separate lazy-loaded Only Order page and IndexedDB v9 `onlyOrders` table, embedded free-text Product/Volume lines, positive finite quantities including decimals, bidirectional Price/Total calculations, standalone numbering, editing/deletion, and shared PDF receipts. It never mutates inventory tables or contributes to Home/catalog metrics. Backup v6 includes inventory, Only Order, Credit Order data, and credit audit history and still imports v1-v5. Renamed visible product/voice-review Pack size labels to Volume. Verified calculations, inventory isolation, CRUD, receipt sharing payload, backup compatibility, chooser routing, and desktop/mobile layouts; runtime dependency audit is clean. Sarvam remains deferred.

- Receipt previews and PDFs now include pack size and measurement unit beside each product name. New sales snapshot these values, order edits retain available snapshots, and legacy receipts fall back to linked inventory details. All four receipt regression tests and the production build pass.

- Added order receipt previews and paginated A5 PDFs with the current store address, labeled contact, GSTIN, Composition Dealer status, supplied Kanaka Mahalakshmi image, order number/date (India time), bold product names, quantities, selling prices, line totals, and total. The centered **Order Receipt** heading has a rounded black border above SMKG. Mobile receipt text shows a 15px store title and the deity image is 1.5px taller; the PDF has a matching modest size increase. Optional customer names are captured during creation/editing, saved with both order types, shown in history/details, and included in receipts. Internal costs/margins are excluded; receipts do not confirm payment. Existing orders offer Receipt, Download PDF, and Share PDF. Web Share opens the OS share sheet for WhatsApp selection, with download fallback. PDF generation remains offline-capable with lazy-loaded/pre-cached assets. Mobile preview and PDF regression tests pass; real phone WhatsApp sharing remains to verify.
- Added Only Order history From/To date filters and Today, Last 7 days, Last month, and All dates presets. The date-scoped order count, average, total amount, and **Top Customer** (the named customer with the highest spend in the range) update together with the visible order list; text search further narrows the list.
- Credit Order editors now show the order number above the customer name instead of an Edit Credit Order heading. Activity rows omit product summaries. Reused the shared 5/10/20 pagination for account activity and Active/Archived customer lists, with independent page state, search-before-pagination, and page clamping after deletion. Verified with isolated 12-active/12-archived customer and 13-activity fixtures at mobile and desktop widths without changing user data.
- Payment edits now show the payment number/customer identity, separate Outstanding balance and Payment edit limit lines, and equal-width aligned footer buttons. Removed the Credit landing wrapper's extra 18px grid gap; all three Sales modes have matching choice-panel positions. Verified payment layout at 320/390/1280px in an isolated browser context with no overflow or changes to user records.
- Credit account activity purchase labels now show only the order number. Removed `Rs.` from activity amounts, Active/Archived customer balances, the customer balance tile, and payment balance/edit-limit lines; preserved two decimals and activity plus/minus signs. Verified every requested screen with isolated fixtures without changing user records or receipt formatting.
- Added an independent Credit Order flow with With list and Without list entry, reusable customers, free-text purchases without stock changes, partial/full customer payments, and derived balances. Activity taps edit the same transaction ID/number; long press enables multi-selection and atomic deletion via the header bin, with per-row bins available. IndexedDB v11 adds `creditHistory` for linked before/after edit snapshots and reasoned void snapshots; voided entries remain stored but are hidden from normal activity. Order edits retain source messages and support adding/editing/deleting messages. Archive uses an in-app confirmation with clear outstanding-balance feedback; zero-balance archive/restore is tested. Back links are spaced below tabs. Backup v6 includes audit history and accepts v1-v5. Credit limits, due dates, interest, and per-order allocations remain out of scope. Isolated browser checks cover ID-preserving edits, list append, bulk delete, archive/restore, and no overflow at 320/390/1280px without changing user data.

- Updated Worker CORS configuration to allow the production Pages origin and local Vite origins, and documented the local-dev setup. The Worker must be redeployed for local Read List requests to work against the deployed endpoint.

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
- Added voice-assisted basket entry (Android Chrome; feature-detected, no-op elsewhere) with English/Telugu toggle, spoken quantity+name parsing, fuzzy product matching, mandatory confirm-before-add, and a fallback to prefill Inventory's Add new product form when nothing matches. Requires internet, unlike the rest of the offline-first app.
- Made voice recognition continuous with a manual stop, so multi-part sentences (pack size, unit cost, profit margin, selling price) aren't cut off at the first pause. Extracts pack size/unit, package type, unit cost, profit margin, and selling price (or derives selling price from cost+margin), and shows a "Detected for new product" review list of every field before the owner taps Add as new product.
- Hardened spoken price/margin parsing against currency words ("Rs"/"rupees") landing between "unit price/margin of" and the number, and added structural filler words (unit, price, cost, around, there, etc.) so misheard phrases leak less into the parsed product name.
- Added a selectable voice engine (Browser Web Speech API vs Sarvam AI) with a toggle next to the language switch. Sarvam records via `MediaRecorder` and sends the clip to a new `worker/` Cloudflare Worker proxy (keeps the Sarvam API key server-side); shows a friendly inline message if the proxy isn't configured yet instead of failing silently. Wispr Flow was evaluated but has no public API to integrate with — it already works today as a system-level dictation tool independent of SMKG.
- Removed horizontal scrolling from the Home attention table and Sales snapshot on mobile.
- Added local Home and Sales dashboards.
- Fixed tab navigation to reset scroll position; Inventory no longer autofocuses its form on mobile and jump-scrolls to the middle of the page.
- Created docs folders: `docs/frontend`, `docs/backend`, `docs/dbSetup`, and `docs/application`.

## Verified

```bash
cd frontend
npm run build
npm run test:receipt
npm run test:only-orders
```

The production build passes and generates the PWA service worker.

## Current Local Schema

- `products`
- `orders`
- `orderItems`
- `productOptions`
- `onlyOrders` (embedded lines, independent of inventory)

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
