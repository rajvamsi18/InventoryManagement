import type { inventoryDb, OnlyOrder, OnlyOrderLine, SalesOrderItem } from './database'

export type OnlyOrderDraft = {
  id: string
  productName: string
  volume: string
  quantity: string
  price: string
  total: string
}

export function emptyOnlyOrderLine(): OnlyOrderDraft {
  return { id: crypto.randomUUID(), productName: '', volume: '', quantity: '1', price: '', total: '' }
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export function updateOnlyOrderLine(line: OnlyOrderDraft, field: keyof OnlyOrderDraft, value: string): OnlyOrderDraft {
  const next = { ...line, [field]: value }
  const quantity = Number(next.quantity)
  if (field === 'total') {
    next.price = next.total !== '' && quantity > 0 ? String(Number(next.total) / quantity) : ''
  } else if (field === 'price' || field === 'quantity') {
    next.total = next.price !== '' && quantity > 0 ? String(money(quantity * Number(next.price))) : ''
  }
  return next
}

export function parseOnlyOrderLines(drafts: OnlyOrderDraft[]): OnlyOrderLine[] {
  if (!drafts.length) throw new Error('Add at least one product.')
  return drafts.map(line => {
    const quantity = Number(line.quantity)
    const price = Number(line.price)
    const total = Number(line.total)
    if (!line.productName.trim()) throw new Error('Enter Product for every row.')
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantity must be greater than zero.')
    if (line.price === '' || line.total === '' || !Number.isFinite(price) || !Number.isFinite(total) || price < 0 || total < 0) {
      throw new Error('Price and Total must be non-negative numbers.')
    }
    if (money(quantity * price) !== money(total)) throw new Error('Check Price and Total for every row.')
    return { id: line.id, productName: line.productName.trim(), volume: line.volume.trim(), quantity, price, total: money(total) }
  })
}

export function onlyOrderNumber(value: string): string {
  const sequence = Number(value.match(/(\d+)$/)?.[1])
  return Number.isSafeInteger(sequence) && sequence > 0 ? `OR ${sequence}` : value
}

export async function saveOnlyOrder(db: typeof inventoryDb, drafts: OnlyOrderDraft[], orderId?: string): Promise<OnlyOrder> {
  const items = parseOnlyOrderLines(drafts)
  return db.transaction('rw', db.onlyOrders, async () => {
    const existing = orderId ? await db.onlyOrders.get(orderId) : undefined
    if (orderId && !existing) throw new Error('This order no longer exists.')
    const now = new Date().toISOString()
    const sequence = existing ? 0 : (await db.onlyOrders.toArray()).reduce((highest, order) => Math.max(highest, Number(order.orderNumber.match(/(\d+)$/)?.[1] ?? 0)), 0) + 1
    const order: OnlyOrder = {
      id: existing?.id ?? crypto.randomUUID(),
      orderNumber: existing ? onlyOrderNumber(existing.orderNumber) : `OR ${sequence}`,
      soldAt: existing?.soldAt ?? now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      totalAmount: money(items.reduce((sum, item) => sum + item.total, 0)),
      items,
    }
    await db.onlyOrders.put(order)
    return order
  })
}

export async function deleteOnlyOrders(db: typeof inventoryDb, orderIds: string[]): Promise<void> {
  await db.onlyOrders.bulkDelete(orderIds)
}

export function onlyOrderReceiptItems(order: OnlyOrder): SalesOrderItem[] {
  return order.items.map(item => ({
    id: item.id, orderId: order.id, productId: '', productName: item.productName,
    volume: item.volume, category: '', quantitySold: item.quantity,
    unitSellingPrice: item.price, lineTotal: item.total,
  }))
}

export function isOnlyOrder(value: unknown): value is OnlyOrder {
  if (!value || typeof value !== 'object') return false
  const order = value as Partial<OnlyOrder>
  if (typeof order.id !== 'string' || typeof order.orderNumber !== 'string' ||
    typeof order.soldAt !== 'string' || !Number.isFinite(Date.parse(order.soldAt)) ||
    typeof order.createdAt !== 'string' || typeof order.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(order.createdAt)) || !Number.isFinite(Date.parse(order.updatedAt)) ||
    typeof order.totalAmount !== 'number' || !Number.isFinite(order.totalAmount) || order.totalAmount < 0 ||
    !Array.isArray(order.items) || !order.items.length) return false
  if (!order.items.every(item => item && typeof item.id === 'string' &&
    typeof item.productName === 'string' && item.productName.trim() &&
    typeof item.volume === 'string' &&
    Number.isFinite(item.quantity) && item.quantity > 0 &&
    typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0 &&
    typeof item.total === 'number' && Number.isFinite(item.total) && item.total >= 0 &&
    money(item.quantity * item.price) === money(item.total))) return false
  return money(order.items.reduce((sum, item) => sum + item.total, 0)) === money(order.totalAmount)
}