import { inventoryDb, type Product, type ProductOption, type SalesOrder, type SalesOrderItem, type OnlyOrder } from './database'
import { isOnlyOrder } from './onlyOrders'

type InventoryBackup = {
  format: 'stockroom-inventory-backup'
  version: number
  exportedAt: string
  products: Product[]
  productOptions: ProductOption[]
  orders: SalesOrder[]
  orderItems: SalesOrderItem[]
  onlyOrders: OnlyOrder[]
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
  return typeof order.id === 'string' && typeof order.orderNumber === 'string' && typeof order.soldAt === 'string' && typeof order.totalAmount === 'number'
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
  const backup: InventoryBackup = {
    format: 'stockroom-inventory-backup',
    version: 4,
    exportedAt: new Date().toISOString(),
    products,
    productOptions,
    orders,
    orderItems,
    onlyOrders,
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `stockroom-backup-${backup.exportedAt.slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export async function readBackup(file: File): Promise<{ products: Product[]; productOptions: ProductOption[]; orders: SalesOrder[]; orderItems: SalesOrderItem[]; onlyOrders: OnlyOrder[] }> {
  const parsed: unknown = JSON.parse(await file.text())
  if (!parsed || typeof parsed !== 'object') throw new Error('This is not a Stockroom backup file.')
  const backup = parsed as Partial<InventoryBackup> & { version?: number }
  if (backup.format !== 'stockroom-inventory-backup' || ![1, 2, 3, 4].includes(backup.version ?? 0) || !Array.isArray(backup.products) || !backup.products.every(isProduct)) {
    throw new Error('This backup file is invalid or uses an unsupported version.')
  }
  if ((backup.version ?? 0) >= 2 && (!Array.isArray(backup.productOptions) || !backup.productOptions.every(isProductOption))) throw new Error('This backup contains invalid catalog options.')
  if ((backup.version ?? 0) >= 3 && (!Array.isArray(backup.orders) || !backup.orders.every(isOrder) || !Array.isArray(backup.orderItems) || !backup.orderItems.every(isOrderItem))) throw new Error('This backup contains invalid order history.')
  if (backup.version === 4 && (!Array.isArray(backup.onlyOrders) || !backup.onlyOrders.every(isOnlyOrder))) throw new Error('This backup contains invalid Only Order history.')
  return { products: backup.products, productOptions: (backup.version ?? 0) >= 2 ? backup.productOptions ?? [] : [], orders: (backup.version ?? 0) >= 3 ? backup.orders ?? [] : [], orderItems: (backup.version ?? 0) >= 3 ? backup.orderItems ?? [] : [], onlyOrders: backup.version === 4 ? backup.onlyOrders ?? [] : [] }
}