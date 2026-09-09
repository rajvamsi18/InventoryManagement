# SMKG Application Guide

SMKG stands for Sri Mareswari Kinena General Stores.

## Daily Flow

1. Use **Inventory** to configure categories, brands, measurements, and package types, then enter stock with a pack size, cost, selling price, and low-stock alert.
	Stock quantity and low-stock alert are non-negative whole-unit counts. Decimal weight or volume belongs in Pack size, not Stock quantity.
	Brand, Category, Package type, and Measurement unit dropdowns include **Add new...**. Selecting it opens and focuses the matching Catalog options section without clearing the product form. After adding the value, SMKG selects it in the original field automatically.
2. Use **Sales** to open a new basket. Search/filter the product catalog, add products to the basket, adjust quantity or selling price, and submit. Submitting reduces stock on the same device and returns to Recent orders.
	Sale quantities are positive whole units, so stock remains integer-valued after submissions, edits, deletions, and restorations.
	The basket heading displays its order number. By default it shows four most-sold quick picks; entering a search or category displays matching products with 12-item pagination.
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
- Editing or deleting an order restores the prior stock movement, then applies the replacement order when saved.
- Custom categories can be renamed; they can only be removed after their products are moved to another category.
- The same add/rename/delete rule applies to brands, measurement units, and package types.
- A product variant is matched by normalized name, brand, category, pack size, measurement unit, package type, expiry date, unit cost, and MRP. A match updates stock and GST instead of creating another catalog card.
- Supplier and batch number are maintained as pairs under the matching product. A new pair creates another stock lot; an existing pair is updated. Batch is intentionally not part of catalog identity because one catalog product can contain multiple batches.
- Catalog-option values stay collapsed until the owner selects Categories, Brands, Measurement units, or Package types.
- Products with sales history cannot be deleted because doing so would orphan order reporting.
- The Products catalog shows at most 12 items per page and opens a full product performance view.
- Product deletion is currently allowed even if it has historical sales. The next product-management enhancement should change this to archive behavior to preserve reporting integrity.
- Backup version 3 contains products, catalog options, orders, and order items. Older product-only backups remain importable.
