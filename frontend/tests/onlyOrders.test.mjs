import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import test from 'node:test'
import { inventoryDb } from '../src/services/database.ts'
import { appendReadListDrafts, deleteOnlyOrders, draftsFromReadList, emptyOnlyOrderLine, hasDuplicateReadListMessage, updateOnlyOrderLine, validateOnlyOrderDraftLine, parseOnlyOrderLines, removeReadListDrafts, replaceReadListDrafts, saveOnlyOrder, onlyOrderReceiptItems, isOnlyOrder, onlyOrderNumber } from '../src/services/onlyOrders.ts'

test('read-list rows become review drafts with blank prices and explicit assumed quantities', () => {
  const drafts = draftsFromReadList([
    { productName: 'బియ్యం', volume: '5 kg', quantity: 1, quantityAssumed: true },
    { productName: 'Milk', volume: '', quantity: 1.5, quantityAssumed: false },
  ])
  assert.equal(drafts[0].quantity, '1')
  assert.equal(drafts[0].quantityAssumed, true)
  assert.equal(drafts[0].volume, '5 kg')
  assert.equal(drafts[0].price, '')
  assert.equal(drafts[0].total, '')
  assert.equal(drafts[1].quantity, '1.5')
  assert.equal(drafts[1].quantityAssumed, false)
  assert.doesNotThrow(() => validateOnlyOrderDraftLine(drafts[0]))
  assert.throws(() => parseOnlyOrderLines(drafts), /Price and Total/)
  assert.equal(updateOnlyOrderLine(drafts[0], 'quantity', '2').quantityAssumed, false)
})

test('a second read-list appends rows without replacing existing edits or prices', () => {
  const priced = { ...emptyOnlyOrderLine(), productName: 'Rice', quantity: '2', price: '10', total: '20' }
  const partiallyEntered = { ...emptyOnlyOrderLine(), productName: 'Coffee', quantity: '1' }
  const appended = appendReadListDrafts([priced, partiallyEntered, emptyOnlyOrderLine()], [
    { productName: 'Milk', volume: '1 litre', quantity: 1, quantityAssumed: true },
  ])

  assert.equal(appended.length, 3)
  assert.equal(appended[0].productName, 'Rice')
  assert.equal(appended[0].price, '10')
  assert.equal(appended[1].productName, 'Coffee')
  assert.equal(appended[2].productName, 'Milk')
  assert.equal(appended[2].volume, '1 litre')
  assert.equal(appended[2].price, '')
  assert.equal(appended[2].quantityAssumed, true)
})

test('source-message edit replaces only linked rows and retains prices for unchanged products', () => {
  const firstMessage = draftsFromReadList([
    { productName: 'Rice', volume: 'bag', quantity: 1, quantityAssumed: false },
    { productName: 'Coffee', volume: '500 g', quantity: 1, quantityAssumed: true },
  ], 'message-1')
  const pricedRice = updateOnlyOrderLine(firstMessage[0], 'price', '10')
  const otherMessage = draftsFromReadList([{ productName: 'Milk', volume: '1 litre', quantity: 1, quantityAssumed: false }], 'message-2')[0]
  const manualLine = { ...emptyOnlyOrderLine(), productName: 'Bread', price: '2', total: '2' }
  const before = [pricedRice, firstMessage[1], otherMessage, manualLine]
  const replaced = replaceReadListDrafts(before, 'message-1', [
    { productName: 'Rice', volume: 'bag', quantity: 2, quantityAssumed: false },
    { productName: 'Vim bar', volume: '', quantity: 1, quantityAssumed: true },
  ])

  assert.equal(replaced.length, 4)
  assert.equal(replaced[0].productName, 'Rice')
  assert.equal(replaced[0].price, '10')
  assert.equal(replaced[0].total, '20')
  assert.equal(replaced[0].quantityAssumed, false)
  assert.equal(replaced[1].productName, 'Vim bar')
  assert.equal(replaced[1].price, '')
  assert.equal(replaced[2].productName, 'Milk')
  assert.equal(replaced[3].productName, 'Bread')

  const withoutFirstMessage = removeReadListDrafts(replaced, 'message-1')
  assert.deepEqual(withoutFirstMessage.map(line => line.productName), ['Milk', 'Bread'])
})

test('duplicate detection normalizes case and whitespace but permits editing the same source', () => {
  const messages = [{ id: 'source-1', text: ' Rice   1 bag\nCoffee ' }]
  assert.equal(hasDuplicateReadListMessage(messages, 'rice 1 bag coffee'), true)
  assert.equal(hasDuplicateReadListMessage(messages, 'rice 1 bag coffee', 'source-1'), false)
  assert.equal(hasDuplicateReadListMessage(messages, 'rice 2 bags'), false)
})

test('source-message associations persist on saved Only Orders and validate with backups', async () => {
  const message = { id: 'persisted-source-1', text: 'Rice 1 bag' }
  const draft = updateOnlyOrderLine({ ...draftsFromReadList([{ productName: 'Rice', volume: 'bag', quantity: 1, quantityAssumed: true }], message.id)[0] }, 'price', '10')
  const order = await saveOnlyOrder(inventoryDb, [draft], undefined, [message])
  assert.deepEqual(order.sourceMessages, [message])
  assert.equal(order.items[0].sourceMessageId, message.id)
  assert.equal(order.items[0].quantityAssumed, true)
  assert.ok(isOnlyOrder(order))
  assert.equal(isOnlyOrder({ ...order, items: [{ ...order.items[0], sourceMessageId: 'missing-source' }] }), false)

  const savedDraft = { ...draft, quantity: '2', price: '10', total: '20' }
  const edited = await saveOnlyOrder(inventoryDb, [savedDraft], order.id, [{ ...message, text: 'Rice two bags' }])
  assert.equal(edited.sourceMessages[0].text, 'Rice two bags')
  assert.equal(edited.items[0].quantity, 2)
  assert.equal(edited.items[0].sourceMessageId, message.id)
  assert.ok(isOnlyOrder(edited))
  await deleteOnlyOrders(inventoryDb, [edited.id])
})

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