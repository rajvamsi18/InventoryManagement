import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { inventoryDb } from '../src/services/database.ts'
import { deleteOnlyOrders, emptyOnlyOrderLine, updateOnlyOrderLine, parseOnlyOrderLines, saveOnlyOrder, onlyOrderReceiptItems, isOnlyOrder, onlyOrderNumber } from '../src/services/onlyOrders.ts'

test('price and total derive each other; positive decimal quantities are accepted', () => {
  assert.equal(onlyOrderNumber('SMKG-ONLY-000012'), 'OR 12')
  assert.equal(onlyOrderNumber('Order - 12'), 'OR 12')
  assert.equal(onlyOrderNumber('OR 3'), 'OR 3')
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
  for (const [quantity, expectedTotal] of [['1.25', 81.25], ['0.25', 16.25], ['1.5', 97.5]]) {
    const decimal = updateOnlyOrderLine({ ...line, price: '65' }, 'quantity', quantity)
    assert.equal(parseOnlyOrderLines([decimal])[0].total, expectedTotal)
    assert.equal(Number(updateOnlyOrderLine(decimal, 'total', String(expectedTotal)).price), 65)
  }
  for (const quantity of ['0', '-1', '', 'NaN', 'Infinity']) {
    assert.throws(() => parseOnlyOrderLines([{ ...line, quantity }]), /greater than zero/)
  }
  assert.throws(() => parseOnlyOrderLines([{ ...line, price: '-2' }]), /non-negative/)
})

test('Only Order create/edit/delete stay isolated from inventory tables', async () => {
  const product = { id: 'only-order-isolation-test', name: 'Stock unchanged', category: 'Other', unit: 'Grams', quantity: 8, lowStockAt: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  await inventoryDb.products.put(product)
  const counts = [await inventoryDb.orders.count(), await inventoryDb.orderItems.count()]
  const draft = { ...emptyOnlyOrderLine(), productName: 'Free text 123', volume: '200 Grams', quantity: '1.25', price: '65', total: '81.25' }
  const order = await saveOnlyOrder(inventoryDb, [draft])
  const second = await saveOnlyOrder(inventoryDb, [{ ...draft, volume: '', quantity: '0.25', total: '16.25' }])
  assert.equal(second.items[0].quantity, 0.25)
  assert.equal(second.totalAmount, 16.25)
  assert.equal(second.items[0].volume, '')
  assert.ok(isOnlyOrder(second))
  assert.equal(order.orderNumber, 'OR 1')
  assert.equal(second.orderNumber, 'OR 2')
  assert.notEqual(order.orderNumber, second.orderNumber)
  const edited = await saveOnlyOrder(inventoryDb, [{ ...draft, quantity: '0.5', total: '32.5' }], order.id)
  assert.equal(edited.orderNumber, order.orderNumber)
  assert.equal(edited.soldAt, order.soldAt)
  assert.equal(edited.totalAmount, 32.5)
  assert.equal(onlyOrderReceiptItems(edited)[0].quantitySold, 0.5)
  assert.equal(onlyOrderReceiptItems(edited)[0].volume, '200 Grams')
  assert.ok(isOnlyOrder(edited))
  assert.equal(isOnlyOrder({ ...edited, items: [{ ...edited.items[0], quantity: 0 }] }), false)
  assert.equal(isOnlyOrder({ ...edited, totalAmount: 999 }), false)
  const remaining = await saveOnlyOrder(inventoryDb, [draft])
  await deleteOnlyOrders(inventoryDb, [order.id, second.id])
  assert.deepEqual((await inventoryDb.onlyOrders.toArray()).map(order => order.id), [remaining.id])
  assert.deepEqual(await inventoryDb.products.get(product.id), product)
  assert.deepEqual([await inventoryDb.orders.count(), await inventoryDb.orderItems.count()], counts)
  await inventoryDb.delete()
})