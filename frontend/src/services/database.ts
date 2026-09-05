import Dexie, { type EntityTable } from 'dexie'

export const PRODUCT_CATEGORIES = [
  'Produce',
  'Dairy & Eggs',
  'Bakery',
  'Pantry',
  'Beverages',
  'Frozen',
  'Snacks',
  'Household',
  'Other',
] as const

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export type Product = {
  id: string
  name: string
  category: ProductCategory
  quantity: number
  unit: string
  price?: number
  profitMarginPercent?: number
  sellingPrice?: number
  lowStockAt: number
  createdAt: string
  updatedAt: string
}

export type SalesOrder = {
  id: string
  orderNumber: string
  soldAt: string
  totalAmount: number
  createdAt: string
  updatedAt: string
}

export type SalesOrderItem = {
  id: string
  orderId: string
  productId: string
  productName: string
  category: ProductCategory
  quantitySold: number
  unitSellingPrice: number
  lineTotal: number
}

const inventoryDb = new Dexie('grocery-inventory') as Dexie & {
  products: EntityTable<Product, 'id'>
  orders: EntityTable<SalesOrder, 'id'>
  orderItems: EntityTable<SalesOrderItem, 'id'>
}

inventoryDb.version(1).stores({
  products: 'id, name, category, updatedAt',
})

inventoryDb.version(2).stores({
  products: 'id, name, category, updatedAt',
  orders: 'id, orderNumber, soldAt, updatedAt',
  orderItems: 'id, orderId, productId, productName, category',
})

export { inventoryDb }