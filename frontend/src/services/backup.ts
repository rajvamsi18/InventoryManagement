import { PRODUCT_CATEGORIES, type Product, type ProductCategory } from './database'

type InventoryBackup = {
  format: 'stockroom-inventory-backup'
  version: 1
  exportedAt: string
  products: Product[]
}

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') return false
  const product = value as Record<string, unknown>
  return typeof product.id === 'string'
    && typeof product.name === 'string'
    && PRODUCT_CATEGORIES.includes(product.category as ProductCategory)
    && typeof product.quantity === 'number'
    && typeof product.unit === 'string'
    && (product.price === undefined || typeof product.price === 'number')
    && typeof product.lowStockAt === 'number'
    && typeof product.createdAt === 'string'
    && typeof product.updatedAt === 'string'
}

export function downloadBackup(products: Product[]) {
  const backup: InventoryBackup = {
    format: 'stockroom-inventory-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    products,
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `stockroom-backup-${backup.exportedAt.slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export async function readBackup(file: File): Promise<Product[]> {
  const parsed: unknown = JSON.parse(await file.text())
  if (!parsed || typeof parsed !== 'object') throw new Error('This is not a Stockroom backup file.')
  const backup = parsed as Partial<InventoryBackup>
  if (backup.format !== 'stockroom-inventory-backup' || backup.version !== 1 || !Array.isArray(backup.products) || !backup.products.every(isProduct)) {
    throw new Error('This backup file is invalid or uses an unsupported version.')
  }
  return backup.products
}