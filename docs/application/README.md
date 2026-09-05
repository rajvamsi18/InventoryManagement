# SMKG Application Guide

SMKG stands for Sri Mareswari Kinena General Stores.

## Daily Flow

1. Use **Inventory** to enter stock and set its category, measurement unit, package type, cost, selling price, and low-stock alert.
2. Use **Sales** to create each order. Submitting it reduces stock on the same device.
3. Use **Home** to review today's sales, monthly sales, low-stock products, and inventory value.
4. Use **Export** in Inventory regularly and store the JSON file outside the PWA.
5. Use **Import** on a replacement/reset device to restore a compatible SMKG backup.

## Pricing

When a cost and profit margin are given, the app suggests:

`selling price = unit cost * (1 + profit margin / 100)`

The selling price remains editable. An order can also use a different selling price for that individual sale.

## Current Constraints

- The application is local-first and works without an API.
- Data is kept in browser IndexedDB, not a user-visible SQLite file.
- Editing or deleting an order restores the prior stock movement, then applies the replacement order when saved.
- Custom categories can be renamed; they can only be removed after their products are moved to another category.
- Product deletion is currently allowed even if it has historical sales. The next product-management enhancement should change this to archive behavior to preserve reporting integrity.
- Order creation and deletion are complete. Editing an existing order is the next sales feature.
