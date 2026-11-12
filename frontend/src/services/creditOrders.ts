import type { CreditAdjustment, CreditHistory, CreditOrder, CreditPayment, CreditPaymentMethod, Customer, OnlyOrderSourceMessage, inventoryDb } from './database'
import { parseOnlyOrderLines, type OnlyOrderDraft } from './onlyOrders.ts'

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function normalizeCustomerName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function calculateCreditBalance(customerId: string, orders: CreditOrder[], payments: CreditPayment[], adjustments: CreditAdjustment[]): number {
  const voidedOrders = new Set(adjustments.filter(adjustment => adjustment.customerId === customerId && adjustment.targetType === 'order').map(adjustment => adjustment.targetId))
  const voidedPayments = new Set(adjustments.filter(adjustment => adjustment.customerId === customerId && adjustment.targetType === 'payment').map(adjustment => adjustment.targetId))
  const sales = orders.filter(order => order.customerId === customerId && !voidedOrders.has(order.id)).reduce((sum, order) => sum + order.totalAmount, 0)
  const paid = payments.filter(payment => payment.customerId === customerId && !voidedPayments.has(payment.id)).reduce((sum, payment) => sum + payment.amount, 0)
  return money(sales - paid)
}

function normalizedPhone(value?: string): string {
  return value?.replace(/[^\d+]/g, '') ?? ''
}

export async function createCustomer(db: typeof inventoryDb, name: string, phone = ''): Promise<Customer> {
  const trimmedName = name.normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (!trimmedName || trimmedName.length > 120) throw new Error('Enter a customer name (up to 120 characters).')
  const trimmedPhone = phone.trim()
  if (trimmedPhone.length > 40) throw new Error('Customer phone number is too long.')
  const normalizedName = normalizeCustomerName(trimmedName)

  return db.transaction('rw', db.customers, async () => {
    const duplicates = await db.customers.where('normalizedName').equals(normalizedName).toArray()
    if (duplicates.some(customer => normalizedPhone(customer.phone) === normalizedPhone(trimmedPhone))) {
      throw new Error('This customer already exists. Select them from the customer list.')
    }
    const now = new Date().toISOString()
    const customer: Customer = {
      id: crypto.randomUUID(),
      name: trimmedName,
      normalizedName,
      ...(trimmedPhone ? { phone: trimmedPhone } : {}),
      createdAt: now,
      updatedAt: now,
    }
    await db.customers.add(customer)
    return customer
  })
}

export async function updateCustomer(db: typeof inventoryDb, customerId: string, name: string, phone = ''): Promise<Customer> {
  const trimmedName = name.normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (!trimmedName || trimmedName.length > 120) throw new Error('Enter a customer name (up to 120 characters).')
  const trimmedPhone = phone.trim()
  if (trimmedPhone.length > 40) throw new Error('Customer phone number is too long.')
  const normalizedName = normalizeCustomerName(trimmedName)

  return db.transaction('rw', db.customers, async () => {
    const customer = await db.customers.get(customerId)
    if (!customer) throw new Error('Customer not found.')
    if (!customer.archivedAt) {
      const duplicates = await db.customers.where('normalizedName').equals(normalizedName).toArray()
      if (duplicates.some(candidate => candidate.id !== customerId && !candidate.archivedAt && normalizedPhone(candidate.phone) === normalizedPhone(trimmedPhone))) {
        throw new Error('This customer already exists. Select them from the customer list.')
      }
    }
    const updated: Customer = {
      ...customer,
      name: trimmedName,
      normalizedName,
      ...(trimmedPhone ? { phone: trimmedPhone } : { phone: undefined }),
      updatedAt: new Date().toISOString(),
    }
    await db.customers.put(updated)
    return updated
  })
}

export async function createCreditOrder(db: typeof inventoryDb, customerId: string, drafts: OnlyOrderDraft[], sourceMessages: OnlyOrderSourceMessage[] = []): Promise<CreditOrder> {
  const items = parseOnlyOrderLines(drafts)

  return db.transaction('rw', db.customers, db.creditOrders, async () => {
    const customer = await db.customers.get(customerId)
    if (!customer || customer.archivedAt) throw new Error('Select an active customer.')
    const now = new Date().toISOString()
    const sequence = (await db.creditOrders.toArray()).reduce((highest, order) => Math.max(highest, Number(order.orderNumber.match(/(\d+)$/)?.[1] ?? 0)), 0) + 1
    const order: CreditOrder = {
      id: crypto.randomUUID(),
      orderNumber: `CR ${sequence}`,
      customerId,
      customerName: customer.name,
      soldAt: now,
      totalAmount: money(items.reduce((sum, item) => sum + item.total, 0)),
      items,
      sourceMessages,
      createdAt: now,
    }
    await db.creditOrders.add(order)
    return order
  })
}

export async function replaceCreditOrder(db: typeof inventoryDb, orderId: string, drafts: OnlyOrderDraft[], sourceMessages?: OnlyOrderSourceMessage[]): Promise<CreditOrder> {
  const items = parseOnlyOrderLines(drafts)

  return db.transaction('rw', [db.customers, db.creditOrders, db.creditPayments, db.creditAdjustments, db.creditHistory], async () => {
    const existing = await db.creditOrders.get(orderId)
    if (!existing) throw new Error('Credit order not found.')
    const customer = await db.customers.get(existing.customerId)
    if (!customer) throw new Error('Customer account not found.')
    const [orders, payments, adjustments] = await Promise.all([
      db.creditOrders.where('customerId').equals(customer.id).toArray(),
      db.creditPayments.where('customerId').equals(customer.id).toArray(),
      db.creditAdjustments.where('customerId').equals(customer.id).toArray(),
    ])
    if (adjustments.some(adjustment => adjustment.targetType === 'order' && adjustment.targetId === existing.id)) throw new Error('This credit order is already voided.')
    const totalAmount = money(items.reduce((sum, item) => sum + item.total, 0))
    const currentBalance = calculateCreditBalance(customer.id, orders, payments, adjustments)
    if (currentBalance - existing.totalAmount + totalAmount < 0) throw new Error('The corrected order cannot be lower than payments already recorded. Void a payment first.')
    const now = new Date().toISOString()
    const replacement: CreditOrder = {
      ...existing,
      totalAmount,
      items,
      sourceMessages: sourceMessages ?? existing.sourceMessages ?? [],
      updatedAt: now,
    }
    await db.creditHistory.add({ id: crypto.randomUUID(), customerId: customer.id, action: 'edit', targetType: 'order', targetId: existing.id, before: existing, after: replacement, createdAt: now })
    await db.creditOrders.put(replacement)
    return replacement
  })
}

export async function recordCreditPayment(
  db: typeof inventoryDb,
  input: { customerId: string; amount: number; paidAt: string; method: CreditPaymentMethod; reference?: string },
): Promise<CreditPayment> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Payment amount must be greater than zero.')
  const amount = money(input.amount)
  if (amount <= 0) throw new Error('Payment amount must be at least 0.01.')
  if (!Number.isFinite(Date.parse(input.paidAt))) throw new Error('Enter a valid payment date.')
  if (!['Cash', 'UPI', 'Bank transfer', 'Other'].includes(input.method)) throw new Error('Choose a valid payment method.')
  const reference = input.reference?.trim() ?? ''
  if (reference.length > 120) throw new Error('Payment reference is too long.')

  return db.transaction('rw', db.customers, db.creditOrders, db.creditPayments, db.creditAdjustments, async () => {
    const customer = await db.customers.get(input.customerId)
    if (!customer || customer.archivedAt) throw new Error('Select an active customer.')
    const [orders, payments, adjustments] = await Promise.all([
      db.creditOrders.where('customerId').equals(customer.id).toArray(),
      db.creditPayments.where('customerId').equals(customer.id).toArray(),
      db.creditAdjustments.where('customerId').equals(customer.id).toArray(),
    ])
    const balance = calculateCreditBalance(customer.id, orders, payments, adjustments)
    if (amount > balance) throw new Error(`Payment cannot exceed the outstanding balance of ${balance.toFixed(2)}.`)
    const paymentNumber = `CP ${payments.reduce((highest, payment) => Math.max(highest, Number(payment.paymentNumber.match(/(\d+)$/)?.[1] ?? 0)), 0) + 1}`
    const payment: CreditPayment = {
      id: crypto.randomUUID(),
      paymentNumber,
      customerId: customer.id,
      customerName: customer.name,
      amount,
      paidAt: input.paidAt,
      method: input.method,
      ...(reference ? { reference } : {}),
      createdAt: new Date().toISOString(),
    }
    await db.creditPayments.add(payment)
    return payment
  })
}

export async function replaceCreditPayment(
  db: typeof inventoryDb,
  paymentId: string,
  input: { amount: number; paidAt: string; method: CreditPaymentMethod; reference?: string },
): Promise<CreditPayment> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Payment amount must be greater than zero.')
  const amount = money(input.amount)
  if (amount <= 0) throw new Error('Payment amount must be at least 0.01.')
  if (!Number.isFinite(Date.parse(input.paidAt))) throw new Error('Enter a valid payment date.')
  if (!['Cash', 'UPI', 'Bank transfer', 'Other'].includes(input.method)) throw new Error('Choose a valid payment method.')
  const reference = input.reference?.trim() ?? ''
  if (reference.length > 120) throw new Error('Payment reference is too long.')

  return db.transaction('rw', [db.customers, db.creditOrders, db.creditPayments, db.creditAdjustments, db.creditHistory], async () => {
    const existing = await db.creditPayments.get(paymentId)
    if (!existing) throw new Error('Credit payment not found.')
    const customer = await db.customers.get(existing.customerId)
    if (!customer) throw new Error('Customer account not found.')
    const [orders, payments, adjustments] = await Promise.all([
      db.creditOrders.where('customerId').equals(customer.id).toArray(),
      db.creditPayments.where('customerId').equals(customer.id).toArray(),
      db.creditAdjustments.where('customerId').equals(customer.id).toArray(),
    ])
    if (adjustments.some(adjustment => adjustment.targetType === 'payment' && adjustment.targetId === existing.id)) throw new Error('This payment is already voided.')
    const availableBalance = calculateCreditBalance(customer.id, orders, payments, adjustments) + existing.amount
    if (amount > availableBalance) throw new Error(`Payment cannot exceed the outstanding balance of ${availableBalance.toFixed(2)}.`)
    const now = new Date().toISOString()
    const replacement: CreditPayment = {
      ...existing,
      amount,
      paidAt: input.paidAt,
      method: input.method,
      reference,
      updatedAt: now,
    }
    await db.creditHistory.add({ id: crypto.randomUUID(), customerId: customer.id, action: 'edit', targetType: 'payment', targetId: existing.id, before: existing, after: replacement, createdAt: now })
    await db.creditPayments.put(replacement)
    return replacement
  })
}

export async function voidCreditEntry(
  db: typeof inventoryDb,
  input: { customerId: string; targetType: CreditAdjustment['targetType']; targetId: string; reason: string },
): Promise<void> {
  return voidCreditEntries(db, { customerId: input.customerId, entries: [input], reason: input.reason })
}

export async function voidCreditEntries(
  db: typeof inventoryDb,
  input: { customerId: string; entries: { targetType: CreditAdjustment['targetType']; targetId: string }[]; reason: string },
): Promise<void> {
  const reason = input.reason.trim()
  if (!reason || reason.length > 240) throw new Error('Enter a void reason (up to 240 characters).')
  if (!input.entries.length) throw new Error('Select at least one entry.')
  if (new Set(input.entries.map(entry => `${entry.targetType}:${entry.targetId}`)).size !== input.entries.length) throw new Error('Select each entry only once.')
  await db.transaction('rw', [db.customers, db.creditOrders, db.creditPayments, db.creditAdjustments, db.creditHistory], async () => {
    const customer = await db.customers.get(input.customerId)
    if (!customer) throw new Error('Customer not found.')
    const [orders, payments, adjustments] = await Promise.all([
      db.creditOrders.where('customerId').equals(customer.id).toArray(),
      db.creditPayments.where('customerId').equals(customer.id).toArray(),
      db.creditAdjustments.where('customerId').equals(customer.id).toArray(),
    ])
    const now = new Date().toISOString()
    const changes: CreditAdjustment[] = []
    const history: CreditHistory[] = []
    for (const entry of input.entries) {
      if (adjustments.some(adjustment => adjustment.targetType === entry.targetType && adjustment.targetId === entry.targetId)) throw new Error('This credit entry is already voided.')
      const base = { id: crypto.randomUUID(), customerId: customer.id, action: 'void' as const, reason, createdAt: now }
      if (entry.targetType === 'order') {
        const order = orders.find(record => record.id === entry.targetId)
        if (!order) throw new Error('Credit order not found for this customer.')
        history.push({ ...base, ...entry, targetType: 'order', before: order })
      } else {
        const payment = payments.find(record => record.id === entry.targetId)
        if (!payment) throw new Error('Credit payment not found for this customer.')
        history.push({ ...base, ...entry, targetType: 'payment', before: payment })
      }
      changes.push({ id: crypto.randomUUID(), customerId: customer.id, ...entry, reason, createdAt: now })
    }
    if (calculateCreditBalance(customer.id, orders, payments, [...adjustments, ...changes]) < 0) throw new Error('Selected orders cannot be voided because payments would exceed the remaining charges. Void a payment first or include it in the selection.')
    await db.creditAdjustments.bulkAdd(changes)
    await db.creditHistory.bulkAdd(history)
  })
}

export async function archiveCustomer(db: typeof inventoryDb, customerId: string): Promise<void> {
  await db.transaction('rw', db.customers, db.creditOrders, db.creditPayments, db.creditAdjustments, async () => {
    const customer = await db.customers.get(customerId)
    if (!customer || customer.archivedAt) throw new Error('Customer is already archived or no longer exists.')
    const [orders, payments, adjustments] = await Promise.all([
      db.creditOrders.where('customerId').equals(customerId).toArray(),
      db.creditPayments.where('customerId').equals(customerId).toArray(),
      db.creditAdjustments.where('customerId').equals(customerId).toArray(),
    ])
    if (calculateCreditBalance(customerId, orders, payments, adjustments) !== 0) throw new Error('Settle the customer balance before archiving this account.')
    await db.customers.update(customerId, { archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  })
}

export async function restoreCustomer(db: typeof inventoryDb, customerId: string): Promise<void> {
  await db.transaction('rw', db.customers, async () => {
    const customer = await db.customers.get(customerId)
    if (!customer) throw new Error('Customer not found.')
    const duplicates = await db.customers.where('normalizedName').equals(customer.normalizedName).toArray()
    if (duplicates.some(candidate => candidate.id !== customerId && !candidate.archivedAt && normalizedPhone(candidate.phone) === normalizedPhone(customer.phone))) {
      throw new Error('Another active customer has the same name and phone. Update that account before restoring this one.')
    }
    await db.customers.update(customerId, { archivedAt: undefined, updatedAt: new Date().toISOString() })
  })
}

export function isCreditCustomer(value: unknown): value is Customer {
  if (!value || typeof value !== 'object') return false
  const customer = value as Partial<Customer>
  return typeof customer.id === 'string' && typeof customer.name === 'string' && customer.name.trim().length > 0 && customer.name.length <= 120 &&
    customer.normalizedName === normalizeCustomerName(customer.name) &&
    (customer.phone === undefined || (typeof customer.phone === 'string' && customer.phone.length <= 40)) &&
    typeof customer.createdAt === 'string' && Number.isFinite(Date.parse(customer.createdAt)) &&
    typeof customer.updatedAt === 'string' && Number.isFinite(Date.parse(customer.updatedAt)) &&
    (customer.archivedAt === undefined || (typeof customer.archivedAt === 'string' && Number.isFinite(Date.parse(customer.archivedAt))))
}

export function isCreditOrder(value: unknown): value is CreditOrder {
  if (!value || typeof value !== 'object') return false
  const order = value as Partial<CreditOrder>
  return typeof order.id === 'string' && typeof order.orderNumber === 'string' &&
    typeof order.customerId === 'string' && typeof order.customerName === 'string' && order.customerName.trim().length > 0 &&
    typeof order.soldAt === 'string' && Number.isFinite(Date.parse(order.soldAt)) &&
    typeof order.createdAt === 'string' && Number.isFinite(Date.parse(order.createdAt)) &&
    typeof order.totalAmount === 'number' && Number.isFinite(order.totalAmount) && order.totalAmount >= 0 &&
    Array.isArray(order.items) && order.items.length > 0 && order.items.every(item => item && typeof item.id === 'string' && typeof item.productName === 'string' && item.productName.trim() && typeof item.volume === 'string' && Number.isFinite(item.quantity) && item.quantity > 0 && Number.isFinite(item.price) && item.price >= 0 && Number.isFinite(item.total) && item.total >= 0 && money(item.quantity * item.price) === money(item.total)) &&
    money(order.items.reduce((sum, item) => sum + item.total, 0)) === money(order.totalAmount)
}

export function isCreditPayment(value: unknown): value is CreditPayment {
  if (!value || typeof value !== 'object') return false
  const payment = value as Partial<CreditPayment>
  return typeof payment.id === 'string' && typeof payment.paymentNumber === 'string' &&
    typeof payment.customerId === 'string' && typeof payment.customerName === 'string' && payment.customerName.trim().length > 0 &&
    typeof payment.amount === 'number' && Number.isFinite(payment.amount) && payment.amount > 0 &&
    typeof payment.paidAt === 'string' && Number.isFinite(Date.parse(payment.paidAt)) &&
    ['Cash', 'UPI', 'Bank transfer', 'Other'].includes(String(payment.method)) &&
    typeof payment.createdAt === 'string' && Number.isFinite(Date.parse(payment.createdAt)) &&
    (payment.reference === undefined || (typeof payment.reference === 'string' && payment.reference.length <= 120))
}

export function isCreditAdjustment(value: unknown): value is CreditAdjustment {
  if (!value || typeof value !== 'object') return false
  const adjustment = value as Partial<CreditAdjustment>
  return typeof adjustment.id === 'string' && typeof adjustment.customerId === 'string' &&
    (adjustment.targetType === 'order' || adjustment.targetType === 'payment') && typeof adjustment.targetId === 'string' &&
    typeof adjustment.reason === 'string' && adjustment.reason.trim().length > 0 && adjustment.reason.length <= 240 &&
    typeof adjustment.createdAt === 'string' && Number.isFinite(Date.parse(adjustment.createdAt))
}

export function isCreditHistory(value: unknown): value is CreditHistory {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<CreditHistory>
  if (typeof entry.id !== 'string' || typeof entry.customerId !== 'string' || typeof entry.targetId !== 'string' ||
    (entry.action !== 'edit' && entry.action !== 'void') || typeof entry.createdAt !== 'string' || !Number.isFinite(Date.parse(entry.createdAt))) return false
  if (entry.action === 'void' && (typeof entry.reason !== 'string' || !entry.reason.trim())) return false
  const validSnapshot = (snapshot: unknown) => entry.targetType === 'order' ? isCreditOrder(snapshot) : entry.targetType === 'payment' && isCreditPayment(snapshot)
  if (!validSnapshot(entry.before) || entry.before?.id !== entry.targetId || entry.before?.customerId !== entry.customerId) return false
  return entry.action === 'void' ? entry.after === undefined : validSnapshot(entry.after) && entry.after?.id === entry.targetId && entry.after?.customerId === entry.customerId
}