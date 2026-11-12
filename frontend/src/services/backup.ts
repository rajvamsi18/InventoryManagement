import { inventoryDb, type CreditAdjustment, type CreditHistory, type CreditOrder, type CreditPayment, type Customer, type Product, type ProductOption, type SalesOrder, type SalesOrderItem, type OnlyOrder } from './database.ts'
import { isOnlyOrder } from './onlyOrders.ts'
import { isCreditAdjustment, isCreditCustomer, isCreditHistory, isCreditOrder, isCreditPayment } from './creditOrders.ts'

type InventoryBackup = {
  format: 'stockroom-inventory-backup'
  version: number
  exportedAt: string
  products: Product[]
  productOptions: ProductOption[]
  orders: SalesOrder[]
  orderItems: SalesOrderItem[]
  onlyOrders: OnlyOrder[]
  customers: Customer[]
  creditOrders: CreditOrder[]
  creditPayments: CreditPayment[]
  creditAdjustments: CreditAdjustment[]
  creditHistory: CreditHistory[]
}

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false
  const product = value as Record<string, unknown>
  return typeof product.id === 'string'
    && typeof product.name === 'string'
    && typeof product.category === 'string'
    && product.category.trim().length > 0
    && typeof product.quantity === 'number'
    && typeof product.unit === 'string'
    && (product.price === undefined || typeof product.price === 'number')
    && typeof product.lowStockAt === 'number'
    && typeof product.createdAt === 'string'
    && typeof product.updatedAt === 'string'
}

function isProductOption(value: unknown): value is ProductOption {
  if (!value || typeof value !== 'object') return false
  const option = value as Record<string, unknown>
  return typeof option.id === 'string' && ['category', 'brand', 'measurementUnit', 'packageType'].includes(String(option.type)) && typeof option.name === 'string' && typeof option.createdAt === 'string'
}

function isOrder(value: unknown): value is SalesOrder {
  if (!value || typeof value !== 'object') return false
  const order = value as Record<string, unknown>
  return typeof order.id === 'string' && typeof order.orderNumber === 'string' &&
    (order.customerName === undefined || (typeof order.customerName === 'string' && order.customerName.length <= 120)) &&
    typeof order.soldAt === 'string' && typeof order.totalAmount === 'number'
}

function isOrderItem(value: unknown): value is SalesOrderItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.orderId === 'string' && typeof item.productId === 'string' && typeof item.quantitySold === 'number' && typeof item.lineTotal === 'number'
}

export async function downloadBackup(products: Product[], suppliedOptions?: ProductOption[]) {
  const productOptions = suppliedOptions ?? await inventoryDb.productOptions.toArray()
  const orders = await inventoryDb.orders.toArray()
  const orderItems = await inventoryDb.orderItems.toArray()
  const onlyOrders = await inventoryDb.onlyOrders.toArray()
  const customers = await inventoryDb.customers.toArray()
  const creditOrders = await inventoryDb.creditOrders.toArray()
  const creditPayments = await inventoryDb.creditPayments.toArray()
  const creditAdjustments = await inventoryDb.creditAdjustments.toArray()
  const creditHistory = await inventoryDb.creditHistory.toArray()
  const backup: InventoryBackup = {
    format: 'stockroom-inventory-backup',
    version: 6,
    exportedAt: new Date().toISOString(),
    products,
    productOptions,
    orders,
    orderItems,
    onlyOrders,
    customers,
    creditOrders,
    creditPayments,
    creditAdjustments,
    creditHistory,
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `stockroom-backup-${backup.exportedAt.slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export async function readBackup(file: File): Promise<{ products: Product[]; productOptions: ProductOption[]; orders: SalesOrder[]; orderItems: SalesOrderItem[]; onlyOrders: OnlyOrder[]; customers: Customer[]; creditOrders: CreditOrder[]; creditPayments: CreditPayment[]; creditAdjustments: CreditAdjustment[]; creditHistory: CreditHistory[] }> {
  const parsed: unknown = JSON.parse(await file.text())
  if (!parsed || typeof parsed !== 'object') throw new Error('This is not a Stockroom backup file.')
  const backup = parsed as Partial<InventoryBackup> & { version?: number }
  if (backup.format !== 'stockroom-inventory-backup' || ![1, 2, 3, 4, 5, 6].includes(backup.version ?? 0) || !Array.isArray(backup.products) || !backup.products.every(isProduct)) {
    throw new Error('This backup file is invalid or uses an unsupported version.')
  }
  if ((backup.version ?? 0) >= 2 && (!Array.isArray(backup.productOptions) || !backup.productOptions.every(isProductOption))) throw new Error('This backup contains invalid catalog options.')
  if ((backup.version ?? 0) >= 3 && (!Array.isArray(backup.orders) || !backup.orders.every(isOrder) || !Array.isArray(backup.orderItems) || !backup.orderItems.every(isOrderItem))) throw new Error('This backup contains invalid order history.')
  if ((backup.version ?? 0) >= 4 && (!Array.isArray(backup.onlyOrders) || !backup.onlyOrders.every(isOnlyOrder))) throw new Error('This backup contains invalid Only Order history.')
  if ((backup.version ?? 0) >= 5) {
    if (!Array.isArray(backup.customers) || !backup.customers.every(isCreditCustomer) || !Array.isArray(backup.creditOrders) || !backup.creditOrders.every(isCreditOrder) || !Array.isArray(backup.creditPayments) || !backup.creditPayments.every(isCreditPayment) || !Array.isArray(backup.creditAdjustments) || !backup.creditAdjustments.every(isCreditAdjustment)) throw new Error('This backup contains invalid Credit Order history.')
    const customers = backup.customers as Customer[]
    const creditOrders = backup.creditOrders as CreditOrder[]
    const creditPayments = backup.creditPayments as CreditPayment[]
    const creditAdjustments = backup.creditAdjustments as CreditAdjustment[]
    const customerIds = new Set(customers.map(customer => customer.id))
    const creditOrderIds = new Set(creditOrders.map(order => order.id))
    const creditPaymentIds = new Set(creditPayments.map(payment => payment.id))
    if (customerIds.size !== customers.length || creditOrderIds.size !== creditOrders.length || creditPaymentIds.size !== creditPayments.length ||
      !creditOrders.every(order => customerIds.has(order.customerId)) ||
      !creditPayments.every(payment => customerIds.has(payment.customerId)) ||
      !creditAdjustments.every(adjustment => adjustment.targetType === 'order'
        ? creditOrders.some(order => order.id === adjustment.targetId && order.customerId === adjustment.customerId)
        : creditPayments.some(payment => payment.id === adjustment.targetId && payment.customerId === adjustment.customerId))) {
      throw new Error('This backup contains Credit Order records with missing or duplicate references.')
    }
    if (backup.version === 6) {
      if (!Array.isArray(backup.creditHistory) || !backup.creditHistory.every(isCreditHistory)) throw new Error('This backup contains invalid Credit Order audit history.')
      const history = backup.creditHistory as CreditHistory[]
      if (new Set(history.map(entry => entry.id)).size !== history.length || !history.every(entry => customerIds.has(entry.customerId) &&
        (entry.targetType === 'order' ? creditOrders.some(order => order.id === entry.targetId && order.customerId === entry.customerId) : creditPayments.some(payment => payment.id === entry.targetId && payment.customerId === entry.customerId)))) {
        throw new Error('This backup contains audit history with missing or duplicate references.')
      }
    }
  }
  return {
    products: backup.products,
    productOptions: (backup.version ?? 0) >= 2 ? backup.productOptions ?? [] : [],
    orders: (backup.version ?? 0) >= 3 ? backup.orders ?? [] : [],
    orderItems: (backup.version ?? 0) >= 3 ? backup.orderItems ?? [] : [],
    onlyOrders: (backup.version ?? 0) >= 4 ? backup.onlyOrders ?? [] : [],
    customers: (backup.version ?? 0) >= 5 ? backup.customers ?? [] : [],
    creditOrders: (backup.version ?? 0) >= 5 ? backup.creditOrders ?? [] : [],
    creditPayments: (backup.version ?? 0) >= 5 ? backup.creditPayments ?? [] : [],
    creditAdjustments: (backup.version ?? 0) >= 5 ? backup.creditAdjustments ?? [] : [],
    creditHistory: backup.version === 6 ? backup.creditHistory ?? [] : [],
  }
}