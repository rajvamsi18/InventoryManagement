import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { inventoryDb } from '../src/services/database.ts'
import { archiveCustomer, calculateCreditBalance, createCreditOrder, createCustomer, deleteCreditCustomers, isCreditAdjustment, isCreditCustomer, isCreditOrder, isCreditPayment, recordCreditPayment, replaceCreditOrder, replaceCreditPayment, restoreCustomer, updateCustomer, voidCreditEntries, voidCreditEntry } from '../src/services/creditOrders.ts'
import { emptyOnlyOrderLine, updateOnlyOrderLine } from '../src/services/onlyOrders.ts'
import { readBackup } from '../src/services/backup.ts'

beforeEach(async () => {
  await inventoryDb.transaction('rw', [inventoryDb.customers, inventoryDb.creditOrders, inventoryDb.creditPayments, inventoryDb.creditAdjustments, inventoryDb.creditHistory, inventoryDb.products, inventoryDb.orders, inventoryDb.orderItems], async () => {
    await inventoryDb.creditHistory.clear()
    await inventoryDb.customers.clear()
    await inventoryDb.creditOrders.clear()
    await inventoryDb.creditPayments.clear()
    await inventoryDb.creditAdjustments.clear()
    await inventoryDb.products.clear()
    await inventoryDb.orders.clear()
    await inventoryDb.orderItems.clear()
  })
})

function riceDraft(quantity = '2', price = '10') {
  const line = { ...emptyOnlyOrderLine(), productName: 'Rice', volume: '1 kg' }
  return [updateOnlyOrderLine(updateOnlyOrderLine(line, 'quantity', quantity), 'price', price)]
}

function creditTables() {
  return Promise.all([
    inventoryDb.creditOrders.toArray(),
    inventoryDb.creditPayments.toArray(),
    inventoryDb.creditAdjustments.toArray(),
  ])
}

test('customers normalize names and credit orders do not change inventory sales or stock', async () => {
  const customer = await createCustomer(inventoryDb, '  Gopi   Kumar ', '+91 98765 43210')
  const order = await createCreditOrder(inventoryDb, customer.id, riceDraft())
  const [orders, payments, adjustments] = await creditTables()

  assert.equal(customer.name, 'Gopi Kumar')
  assert.equal(customer.normalizedName, 'gopi kumar')
  assert.equal(order.orderNumber, 'CR 1')
  assert.equal(order.customerName, 'Gopi Kumar')
  assert.equal(order.totalAmount, 20)
  assert.equal(calculateCreditBalance(customer.id, orders, payments, adjustments), 20)
  assert.equal(await inventoryDb.products.count(), 0)
  assert.equal(await inventoryDb.orders.count(), 0)
  assert.equal(await inventoryDb.orderItems.count(), 0)
  assert.ok(isCreditCustomer(customer))
  assert.ok(isCreditOrder(order))
})

test('partial customer payments reduce the account balance and overpayment is rejected', async () => {
  const customer = await createCustomer(inventoryDb, 'Gopi')
  await createCreditOrder(inventoryDb, customer.id, riceDraft())
  const payment = await recordCreditPayment(inventoryDb, {
    customerId: customer.id,
    amount: 7.5,
    paidAt: '2026-11-12',
    method: 'UPI',
    reference: 'txn-1',
  })
  const [orders, payments, adjustments] = await creditTables()

  assert.equal(payment.paymentNumber, 'CP 1')
  assert.equal(calculateCreditBalance(customer.id, orders, payments, adjustments), 12.5)
  assert.ok(isCreditPayment(payment))
  await assert.rejects(recordCreditPayment(inventoryDb, {
    customerId: customer.id,
    amount: 12.51,
    paidAt: '2026-11-12',
    method: 'Cash',
  }), /cannot exceed the outstanding balance/)
  assert.equal(await inventoryDb.creditPayments.count(), 1)
})

test('voiding is auditable and refuses to void sales covered by posted payments', async () => {
  const customer = await createCustomer(inventoryDb, 'Gopi')
  const order = await createCreditOrder(inventoryDb, customer.id, riceDraft())
  const payment = await recordCreditPayment(inventoryDb, { customerId: customer.id, amount: 5, paidAt: '2026-11-12', method: 'Cash' })

  await assert.rejects(voidCreditEntry(inventoryDb, {
    customerId: customer.id,
    targetType: 'order',
    targetId: order.id,
    reason: 'Wrong order',
  }), /Void a payment first/)

  await voidCreditEntry(inventoryDb, { customerId: customer.id, targetType: 'payment', targetId: payment.id, reason: 'Payment entered against wrong account' })
  let [orders, payments, adjustments] = await creditTables()
  assert.equal(calculateCreditBalance(customer.id, orders, payments, adjustments), 20)
  assert.ok(isCreditAdjustment(adjustments[0]))

  await voidCreditEntry(inventoryDb, { customerId: customer.id, targetType: 'order', targetId: order.id, reason: 'Wrong order' })
  ;[orders, payments, adjustments] = await creditTables()
  assert.equal(calculateCreditBalance(customer.id, orders, payments, adjustments), 0)
  assert.equal(adjustments.length, 2)
})

test('payment must reference an active customer and valid positive amount', async () => {
  await assert.rejects(createCreditOrder(inventoryDb, 'missing-customer', riceDraft()), /Select an active customer/)
  await assert.rejects(createCustomer(inventoryDb, '   '), /Enter a customer name/)
  await createCustomer(inventoryDb, 'Gopi')
  await assert.rejects(createCustomer(inventoryDb, 'Gopi'), /already exists/)

  const customer = await inventoryDb.customers.toCollection().first()
  await assert.rejects(recordCreditPayment(inventoryDb, {
    customerId: customer.id,
    amount: 0,
    paidAt: '2026-11-12',
    method: 'Cash',
  }), /greater than zero/)
})

test('backup v5 carries credit data and older v4 backups import with empty credit tables', async () => {
  const customer = await createCustomer(inventoryDb, 'Gopi', '9876543210')
  const order = await createCreditOrder(inventoryDb, customer.id, riceDraft())
  const payment = await recordCreditPayment(inventoryDb, { customerId: customer.id, amount: 5, paidAt: '2026-11-12', method: 'UPI' })
  const [customers, creditOrders, creditPayments, creditAdjustments] = await Promise.all([
    inventoryDb.customers.toArray(), inventoryDb.creditOrders.toArray(), inventoryDb.creditPayments.toArray(), inventoryDb.creditAdjustments.toArray(),
  ])
  const versionFive = {
    format: 'stockroom-inventory-backup', version: 5, exportedAt: new Date().toISOString(),
    products: [], productOptions: [], orders: [], orderItems: [], onlyOrders: [],
    customers, creditOrders, creditPayments, creditAdjustments,
  }
  const imported = await readBackup(new Blob([JSON.stringify(versionFive)]) )
  assert.equal(imported.customers[0].id, customer.id)
  assert.equal(imported.creditOrders[0].id, order.id)
  assert.equal(imported.creditPayments[0].id, payment.id)

  const invalid = { ...versionFive, creditPayments: [{ ...payment, amount: -1 }] }
  await assert.rejects(readBackup(new Blob([JSON.stringify(invalid)])), /invalid Credit Order history/)
  const orphaned = { ...versionFive, creditOrders: [{ ...order, customerId: 'missing-customer' }] }
  await assert.rejects(readBackup(new Blob([JSON.stringify(orphaned)])), /missing or duplicate references/)

  const versionFour = {
    format: 'stockroom-inventory-backup', version: 4, exportedAt: new Date().toISOString(),
    products: [], productOptions: [], orders: [], orderItems: [], onlyOrders: [],
  }
  const legacy = await readBackup(new Blob([JSON.stringify(versionFour)]))
  assert.deepEqual(legacy.customers, [])
  assert.deepEqual(legacy.creditOrders, [])
  assert.deepEqual(legacy.creditPayments, [])
  assert.deepEqual(legacy.creditAdjustments, [])
})

test('customer profile edits preserve historical snapshots and archive requires zero balance', async () => {
  const customer = await createCustomer(inventoryDb, 'Gopi', '9876543210')
  const order = await createCreditOrder(inventoryDb, customer.id, riceDraft())
  const updated = await updateCustomer(inventoryDb, customer.id, 'Gopi Kumar', '98765 43210')
  assert.equal(updated.name, 'Gopi Kumar')
  assert.equal((await inventoryDb.creditOrders.get(order.id)).customerName, 'Gopi')
  await assert.rejects(archiveCustomer(inventoryDb, customer.id), /Settle the customer balance/)

  await recordCreditPayment(inventoryDb, { customerId: customer.id, amount: 20, paidAt: '2026-11-12', method: 'Cash' })
  await archiveCustomer(inventoryDb, customer.id)
  assert.ok((await inventoryDb.customers.get(customer.id)).archivedAt)
  await restoreCustomer(inventoryDb, customer.id)
  assert.equal((await inventoryDb.customers.get(customer.id)).archivedAt, undefined)
})

test('editing keeps transaction IDs and numbers and stores linked before/after history separately', async () => {
  const customer = await createCustomer(inventoryDb, 'Gopi')
  const order = await createCreditOrder(inventoryDb, customer.id, riceDraft())
  const payment = await recordCreditPayment(inventoryDb, { customerId: customer.id, amount: 5, paidAt: '2026-11-12', method: 'Cash' })
  const correctedPayment = await replaceCreditPayment(inventoryDb, payment.id, { amount: 7, paidAt: '2026-11-12', method: 'UPI', reference: 'edited' })
  const correctedOrder = await replaceCreditOrder(inventoryDb, order.id, riceDraft('3', '10'))
  const [orders, payments, adjustments] = await creditTables()

  assert.equal(correctedPayment.id, payment.id)
  assert.equal(correctedOrder.id, order.id)
  assert.equal(correctedPayment.paymentNumber, 'CP 1')
  assert.equal(correctedOrder.orderNumber, 'CR 1')
  assert.equal(correctedOrder.soldAt, order.soldAt)
  assert.equal(orders.length, 1)
  assert.equal(payments.length, 1)
  assert.equal(adjustments.length, 0)
  assert.equal(calculateCreditBalance(customer.id, orders, payments, adjustments), 23)
  const history = await inventoryDb.creditHistory.toArray()
  assert.equal(history.length, 2)
  const paymentEdit = history.find(entry => entry.targetType === 'payment')
  assert.equal(paymentEdit.customerId, customer.id)
  assert.equal(paymentEdit.targetId, payment.id)
  assert.equal(paymentEdit.before.amount, 5)
  assert.equal(paymentEdit.before.method, 'Cash')
  assert.equal(paymentEdit.after.amount, 7)
  assert.equal(paymentEdit.after.method, 'UPI')
  assert.equal(paymentEdit.after.reference, 'edited')
})

test('bulk deletion validates the final balance and rolls back an invalid selection', async () => {
  const customer = await createCustomer(inventoryDb, 'Bulk account')
  const order = await createCreditOrder(inventoryDb, customer.id, riceDraft())
  const payment = await recordCreditPayment(inventoryDb, { customerId: customer.id, amount: 20, paidAt: '2026-11-12', method: 'Cash' })
  await assert.rejects(voidCreditEntries(inventoryDb, { customerId: customer.id, entries: [{ targetType: 'order', targetId: order.id }], reason: 'Wrong account' }), /payments would exceed/)
  assert.equal(await inventoryDb.creditHistory.count(), 0)
  assert.equal(await inventoryDb.creditAdjustments.count(), 0)
  await voidCreditEntries(inventoryDb, { customerId: customer.id, entries: [{ targetType: 'order', targetId: order.id }, { targetType: 'payment', targetId: payment.id }], reason: 'Wrong account' })
  const [orders, payments, adjustments] = await creditTables()
  assert.equal(calculateCreditBalance(customer.id, orders, payments, adjustments), 0)
  const history = await inventoryDb.creditHistory.toArray()
  assert.equal(history.length, 2)
  assert.ok(history.every(entry => entry.action === 'void' && entry.customerId === customer.id && entry.before.id === entry.targetId))
  await archiveCustomer(inventoryDb, customer.id)
  assert.ok((await inventoryDb.customers.get(customer.id)).archivedAt)
})

test('audit snapshots and list sources survive version 6 backup validation', async () => {
  const customer = await createCustomer(inventoryDb, 'History account')
  const drafts = riceDraft()
  drafts[0].sourceMessageId = 'message-1'
  const messages = [{ id: 'message-1', text: 'Rice 2' }]
  const order = await createCreditOrder(inventoryDb, customer.id, drafts, messages)
  const edited = await replaceCreditOrder(inventoryDb, order.id, drafts)
  assert.deepEqual(edited.sourceMessages, messages)
  assert.equal(edited.items[0].sourceMessageId, 'message-1')
  const backup = { format: 'stockroom-inventory-backup', version: 6, exportedAt: new Date().toISOString(), products: [], productOptions: [], orders: [], orderItems: [], onlyOrders: [], customers: [customer], creditOrders: [edited], creditPayments: [], creditAdjustments: [], creditHistory: await inventoryDb.creditHistory.toArray() }
  const restored = await readBackup(new Blob([JSON.stringify(backup)]))
  assert.equal(restored.creditHistory.length, 1)
  const invalid = { ...backup, creditHistory: [{ ...backup.creditHistory[0], targetId: 'missing' }] }
  await assert.rejects(readBackup(new Blob([JSON.stringify(invalid)])), /invalid Credit Order audit history/)
})

test('every payment edit keeps a separate snapshot of all fields including clearing a reference', async () => {
  const customer = await createCustomer(inventoryDb, 'Payment history')
  await createCreditOrder(inventoryDb, customer.id, riceDraft('10', '10'))
  const payment = await recordCreditPayment(inventoryDb, { customerId: customer.id, amount: 10, paidAt: '2026-11-12', method: 'Cash', reference: 'first' })
  await replaceCreditPayment(inventoryDb, payment.id, { amount: 20, paidAt: '2026-11-13', method: 'UPI', reference: 'second' })
  await replaceCreditPayment(inventoryDb, payment.id, { amount: 20, paidAt: '2026-11-14', method: 'Bank transfer', reference: '' })
  const snapshots = await inventoryDb.creditHistory.toArray()
  const first = snapshots.find(entry => entry.after.reference === 'second')
  const second = snapshots.find(entry => entry.after.reference === '')
  assert.equal(first.before.amount, 10)
  assert.equal(first.after.amount, 20)
  assert.equal(first.after.paidAt, '2026-11-13')
  assert.equal(second.before.paidAt, '2026-11-13')
  assert.equal(second.before.reference, 'second')
  assert.equal(second.after.method, 'Bank transfer')
  assert.equal(second.after.paidAt, '2026-11-14')
  assert.ok(snapshots.every(entry => entry.targetId === payment.id && entry.customerId === customer.id && entry.createdAt))
  assert.equal(await inventoryDb.creditPayments.count(), 1)
})

test('invalid edits preserve the original order/payment and write no audit entries', async () => {
  const customer = await createCustomer(inventoryDb, 'Rollback account')
  const order = await createCreditOrder(inventoryDb, customer.id, riceDraft())
  const payment = await recordCreditPayment(inventoryDb, { customerId: customer.id, amount: 15, paidAt: '2026-11-12', method: 'Cash' })
  await assert.rejects(replaceCreditOrder(inventoryDb, order.id, riceDraft('1', '10')), /cannot be lower than payments/)
  await assert.rejects(replaceCreditPayment(inventoryDb, payment.id, { amount: 21, paidAt: '2026-11-12', method: 'UPI' }), /cannot exceed/)
  assert.deepEqual(await inventoryDb.creditOrders.get(order.id), order)
  assert.deepEqual(await inventoryDb.creditPayments.get(payment.id), payment)
  assert.equal(await inventoryDb.creditHistory.count(), 0)
})

test('deleting active and archived customers retains ledger history and prevents reuse of deleted IDs', async () => {
  const active = await createCustomer(inventoryDb, 'Delete Active')
  const archived = await createCustomer(inventoryDb, 'Delete Archived')
  const kept = await createCustomer(inventoryDb, 'Keep Customer')
  const order = await createCreditOrder(inventoryDb, active.id, riceDraft())
  const payment = await recordCreditPayment(inventoryDb, { customerId: active.id, amount: 20, paidAt: '2026-11-13', method: 'Cash' })
  await replaceCreditPayment(inventoryDb, payment.id, { amount: 20, paidAt: '2026-11-13', method: 'UPI' })
  await archiveCustomer(inventoryDb, archived.id)
  const historyBefore = await inventoryDb.creditHistory.toArray()
  await deleteCreditCustomers(inventoryDb, [active.id, archived.id])
  assert.ok((await inventoryDb.customers.get(active.id)).deletedAt)
  assert.ok((await inventoryDb.customers.get(archived.id)).deletedAt)
  assert.equal((await inventoryDb.customers.get(kept.id)).deletedAt, undefined)
  assert.deepEqual(await inventoryDb.creditOrders.get(order.id), order)
  assert.equal(await inventoryDb.creditPayments.count(), 1)
  assert.deepEqual(await inventoryDb.creditHistory.toArray(), historyBefore)
  assert.ok(isCreditCustomer(await inventoryDb.customers.get(active.id)))
  await assert.rejects(createCreditOrder(inventoryDb, active.id, riceDraft()), /Select an active customer/)
  await assert.rejects(restoreCustomer(inventoryDb, archived.id), /Customer not found/)
  const newCustomer = await createCustomer(inventoryDb, 'Delete Active')
  assert.notEqual(newCustomer.id, active.id)
  const backup = {
    format: 'stockroom-inventory-backup', version: 6, exportedAt: new Date().toISOString(),
    products: [], productOptions: [], orders: [], orderItems: [], onlyOrders: [],
    customers: await inventoryDb.customers.toArray(), creditOrders: await inventoryDb.creditOrders.toArray(),
    creditPayments: await inventoryDb.creditPayments.toArray(), creditAdjustments: await inventoryDb.creditAdjustments.toArray(),
    creditHistory: await inventoryDb.creditHistory.toArray(),
  }
  const restored = await readBackup(new Blob([JSON.stringify(backup)]))
  assert.ok(restored.customers.find(customer => customer.id === active.id).deletedAt)
  assert.equal(restored.creditOrders[0].customerId, active.id)
  assert.deepEqual(restored.creditHistory, historyBefore)
})

test('bulk customer deletion is atomic when any account has an outstanding balance or is missing', async () => {
  const settled = await createCustomer(inventoryDb, 'Settled')
  const unpaid = await createCustomer(inventoryDb, 'Unpaid')
  await createCreditOrder(inventoryDb, unpaid.id, riceDraft())
  await assert.rejects(deleteCreditCustomers(inventoryDb, [settled.id, unpaid.id]), /Settle the outstanding balance for Unpaid/)
  assert.equal((await inventoryDb.customers.get(settled.id)).deletedAt, undefined)
  assert.equal((await inventoryDb.customers.get(unpaid.id)).deletedAt, undefined)
  await assert.rejects(deleteCreditCustomers(inventoryDb, [settled.id, 'missing']), /no longer exists/)
  assert.equal((await inventoryDb.customers.get(settled.id)).deletedAt, undefined)
  await assert.rejects(deleteCreditCustomers(inventoryDb, []), /at least one customer/)
})