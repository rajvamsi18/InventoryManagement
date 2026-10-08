# SMKG Application Guide

SMKG stands for Sri Mareswari Kirana & General Stores.

## Daily Flow

1. Use **Inventory** to configure categories, brands, measurements, and package types, then enter stock with Volume, cost, selling price, and low-stock alert.
	Stock quantity and low-stock alert are non-negative whole-unit counts. Decimal weight or volume belongs in Volume (previously Pack size), not Stock quantity. Inventory's Volume remains numeric with a separate Measurement unit dropdown.
	Brand, Category, Package type, and Measurement unit dropdowns include **Add new...**. Selecting it opens and focuses the matching Catalog options section without clearing the product form. After adding the value, SMKG selects it in the original field automatically.
2. Use **Sales** to open a new basket. Search/filter the product catalog, add products to the basket, adjust quantity or selling price, and submit. Submitting reduces stock on the same device and opens the saved order details.
	Sale quantities are positive whole units, so stock remains integer-valued after submissions, edits, deletions, and restorations.   A **Voice add** button in the basket lets the owner speak a product, quantity, pack size, unit cost, profit margin, and selling price in one sentence (e.g. "rice 2 kg unit cost 67 profit margin 20 percent"). Tap the button again to finish speaking — it keeps listening across pauses instead of cutting off. SMKG shows what it heard, ranks matching products, and lists every detected field under "Detected for new product" so the owner can review before confirming — it never adds a sale or product automatically. If no product matches, **Add as new product** opens Inventory with all detected fields prefilled, without losing the basket in progress. English and Telugu are supported via a language toggle. A second **Browser/Sarvam** toggle picks the speech engine: Browser is the free built-in engine (Android Chrome; not reliably on iPhone Safari); Sarvam records audio and sends it to a small server-side proxy for higher-accuracy transcription (small per-use cost, works on more devices including iPhone Safari, needs the shop's Sarvam proxy to be set up first). Both require an internet connection, unlike the rest of the app. Note: third-party dictation tools like Wispr Flow are not integrated into SMKG — they work independently at the phone/OS level, so an owner who has one installed can already dictate directly into any text field (like the transcript box) without any toggle here.	The basket heading displays its order number. By default it shows four most-sold quick picks; entering a search or category displays matching products with 12-item pagination.
	If a product is missing, select **Add new product**. SMKG preserves the draft order, opens Inventory, and returns to Sales after a successful save with the product already added to the order. **Return to order** cancels the detour without losing the draft.
	Editing a Recent order opens the same basket page with its existing products. Saving reverses the original stock movement and applies the edited basket atomically.
	**Back to orders** preserves an unfinished new order and shows **Continue order**. **Cancel order** explicitly discards the basket and returns to **New order**. Returning without saving an existing-order edit also discards that edit.
	Recent orders uses Order number and Amount columns; row amounts omit the repeated `Rs.` prefix.
	Tap an order to open its detail page with products, quantities, selling prices, line totals, and an Edit order action. Long press an order to enter selection mode and reveal checkboxes. One selected order shows Edit and Delete below the table; multiple selected orders show Delete only. Bulk deletion restores stock from every selected order before removing its history.
3. Use **Home** to review today's sales, monthly sales, low-stock products, and inventory value.
	Products needing attention are shown in a table with product name, pack size/measurement, brand, and stock. Selecting a row opens that product's detail page.
	The attention table and Sales snapshot fit the mobile viewport without horizontal scrolling.
4. Use **Export** in Inventory regularly and store the JSON file outside the PWA.
5. Use **Import** on a replacement/reset device to restore a compatible SMKG backup.

## Order Modes

Volume is optional in Only Order: leave it blank to save an order and generate receipts with just the product name. Inventory's numeric Volume and Measurement unit requirements are unchanged.

In **Sales**, the **Order History** tile shows **From Inventory** and **Only Order** selectors above **Recent Orders**. Select a flow to display only its saved orders. **New order** opens that flow directly, without a popup. From Inventory retains the existing catalog/basket, stock movements, product creation shortcuts, inventory-linked order history, Home metrics, and receipts. **Continue order** resumes an existing inventory draft.

**Only Order** opens a separate order page. Product and Volume are free-text fields (letters and numbers, such as `Rice 123` and `200 Grams`). Quantity must be greater than zero and can include decimals such as `1.5`, `1.25`, or `0.25`. Price and Total accept non-negative numbers; editing Price or Quantity calculates Total, and editing Total calculates Price using Quantity. Line totals and the order total are rounded to two decimal places; total-derived unit prices retain precision internally. Decimal quantities are preserved when saving/editing, importing backups, and generating receipts. Inventory-linked quantities remain whole numbers. Add/remove rows, submit, open saved orders, edit, delete with confirmation, and create/download/share receipts from this page.

Only Order records use `OR 1`, `OR 2`, and so on, without zero padding, and embed all product information directly in the order. Older padded numbers and `Order - N` labels display in this same format in history, details, and receipts. They never create catalog products, alter stock, appear in the inventory-order list, or affect Home/product sales statistics. Switch back using **From Inventory** in the Order History tile. Unsaved Only Order edits can be cancelled with confirmation; they are not persistent drafts.

In Only Order history, long press a row to reveal checkboxes. Select individual orders or use Select all orders. One selection offers Edit/Delete; multiple selections offer Delete, with confirmation before removing them. Clear selection exits selection mode. Only Order bulk deletion does not change inventory. The detail-page Edit order and Delete controls are compact on mobile.

Backup version 4 includes both order flows. Import accepts versions 1-4; older backups contain no Only Order records. Receipts for Only Order use the Volume text exactly as entered.

On mobile (up to 700px wide), Only Order creation/editing shows a compact product list rather than an input grid. Tap a product row or its pencil icon to edit it in a bottom sheet. **Add & next** adds the product to the local draft and clears the editor for another; **Done** adds/saves that product and returns to the list. Closing the editor discards only its unfinished changes. The fixed bottom bar keeps the order total, Add product, Submit/Save order, and a Cancel order icon accessible. Product rows are not persisted until Submit/Save order. Desktop keeps the existing input grid. Real phone keyboard behavior should be reviewed on-device.

## Order Receipts

After submitting, or by opening any existing order, select **Receipt** to preview an A5-style order receipt. It includes SMKG's full store name, address, contact number, order number, date/time in India, saved product names, quantities, sale prices, line amounts, and total in INR. Internal costs and profit margins are excluded. Long orders continue onto additional PDF pages. Product names include pack size and measurement unit, for example `Rice (0.5 Kilograms)`. New order lines snapshot these details; older orders fall back to the linked product's current pack details when available. Editing a newer order retains its recorded pack details.

An optional customer name appears on the preview and PDF only; it is not saved on the order. **Download PDF** saves a file named after the order, such as `SMKG-000006.pdf`. **Share PDF** opens the phone's share sheet where supported: choose WhatsApp and the recipient yourself. Otherwise the PDF downloads for manual attachment. Cancelled sharing does not change the order.

PDF generation works offline once the PWA has cached its assets. Sending through WhatsApp requires connectivity. These are order receipts, not proof of payment; no paid status, GST invoice, or payment tracking is implied. Real iPhone/Android WhatsApp sharing still needs device verification.

Receipt PDFs support English and Telugu product names, Volume text, and customer names using embedded fonts and Telugu letter shaping. The app prepares the PDF before enabling Download/Share, keeping the mobile share action tied to your tap. Font files are bundled and cached with the PWA, not downloaded from a third-party service during use. PDFs previously generated with unreadable Telugu must be regenerated from their saved orders after updating the app.

## Pricing

When a cost and profit margin are given, the app suggests:

`selling price = unit cost * (1 + profit margin / 100)`

The selling price remains editable. An order can also use a different selling price for that individual sale.
Changing selling price recalculates the margin using `(selling price - unit cost) / unit cost * 100`.

Product realized profit is calculated from sales as `line revenue - (quantity sold * unit cost captured when sold)`. Capturing cost on each order line keeps historical profit stable when the product's current purchase cost changes.

Product details show separate tiles for stock, MRP, unit cost, and profit margin. The performance section shows realized profit from completed orders.
The saved product image and supplier-batch lots are also visible on the individual product page.

## Product Records

Products can include batch number, expiry date, supplier, GST percentage, and one JPEG/PNG/WebP image up to 1.5 MB. Images are stored locally with the product and included in exported backups.

New local orders use sequential numbers such as `SMKG-000001`. The next number is derived from persisted/imported order history immediately before submission. A future shared backend must coordinate sequences when multiple devices submit concurrently.

## Current Constraints

- The application is local-first and works without an API.
- Data is kept in browser IndexedDB, not a user-visible SQLite file.
- Editing or deleting an inventory-linked order restores the prior stock movement, then applies the replacement order when saved. Only Order edits/deletions do not touch stock.
- Custom categories can be renamed; they can only be removed after their products are moved to another category.
- The same add/rename/delete rule applies to brands, measurement units, and package types.
- A product variant is matched by normalized name, brand, category, pack size, measurement unit, package type, expiry date, unit cost, and MRP. A match updates stock and GST instead of creating another catalog card.
- Supplier and batch number are maintained as pairs under the matching product. A new pair creates another stock lot; an existing pair is updated. Batch is intentionally not part of catalog identity because one catalog product can contain multiple batches.
- Catalog-option values stay collapsed until the owner selects Categories, Brands, Measurement units, or Package types.
- Products with sales history cannot be deleted because doing so would orphan order reporting.
- The Products catalog shows at most 12 items per page and opens a full product performance view.
- Product deletion is currently allowed even if it has historical sales. The next product-management enhancement should change this to archive behavior to preserve reporting integrity.
- Backup version 4 contains products, catalog options, inventory orders/items, and independent Only Order records. Versions 1-3 remain importable.
