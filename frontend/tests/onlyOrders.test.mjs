import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { inventoryDb } from '../src/services/database.ts'
import { emptyOnlyOrderLine, updateOnlyOrderLine, parseOnlyOrderLines, saveOnlyOrder, onlyOrderReceiptItems, isOnlyOrder, onlyOrderNumber } from '../src/services/onlyOrders.ts'

test('price and total derive each other; quantities reject fractions', () => {
  assert.equal(onlyOrderNumber('SMKG-ONLY-000012'), 'Order - 12')
  assert.equal(onlyOrderNumber('Order - 12'), 'Order - 12')
  let line = { ...emptyOnlyOrderLine(), productName: 'Rice 123', volume: '200 Grams' }
  line = updateOnlyOrderLine(line, 'quantity', '3')
  line = updateOnlyOrderLine(line, 'price', '20')
  assert.equal(line.total, '60')
  line = updateOnlyOrderLine(line, 'total', '100')
  assert.equal(parseOnlyOrderLines([line])[0].total, 100)
  assert.equal(Number(line.price), 100 / 3)
  assert.equal(parseOnlyOrderLines([{ ...line, volume: '   ' }])[0].volume, '')
  line = updateOnlyOrderLine(line, 'quantity', '2')
  assert.equal(line.total, '66.67')
  for (const quantity of ['0', '-1', '1.5', '']) {
    assert.throws(() => parseOnlyOrderLines([{ ...line, quantity }]), /whole number/)
  }
  assert.throws(() => parseOnlyOrderLines([{ ...line, price: '-2' }]), /non-negative/)
})

test('Only Order create/edit/delete stay isolated from inventory tables', async () => {
  const product = { id: 'only-order-isolation-test', name: 'Stock unchanged', category: 'Other', unit: 'Grams', quantity: 8, lowStockAt: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  await inventoryDb.products.put(product)
  const counts = [await inventoryDb.orders.count(), await inventoryDb.orderItems.count()]
  const draft = { ...emptyOnlyOrderLine(), productName: 'Free text 123', volume: '200 Grams', quantity: '2', price: '30', total: '60' }
  const order = await saveOnlyOrder(inventoryDb, [draft])
  const second = await saveOnlyOrder(inventoryDb, [{ ...draft, volume: '' }])
  assert.equal(second.items[0].volume, '')
  assert.ok(isOnlyOrder(second))
  assert.equal(order.orderNumber, 'Order - 1')
  assert.equal(second.orderNumber, 'Order - 2')
  assert.notEqual(order.orderNumber, second.orderNumber)
  const edited = await saveOnlyOrder(inventoryDb, [{ ...draft, quantity: '3', total: '90' }], order.id)
  assert.equal(edited.orderNumber, order.orderNumber)
  assert.equal(edited.soldAt, order.soldAt)
  assert.equal(edited.totalAmount, 90)
  assert.equal(onlyOrderReceiptItems(edited)[0].volume, '200 Grams')
  assert.ok(isOnlyOrder(edited))
  assert.equal(isOnlyOrder({ ...edited, items: [{ ...edited.items[0], quantity: 1.5 }] }), false)
  assert.equal(isOnlyOrder({ ...edited, totalAmount: 999 }), false)
  await inventoryDb.onlyOrders.bulkDelete([order.id, second.id])
  assert.deepEqual(await inventoryDb.products.get(product.id), product)
  assert.deepEqual([await inventoryDb.orders.count(), await inventoryDb.orderItems.count()], counts)
  await inventoryDb.delete()
})