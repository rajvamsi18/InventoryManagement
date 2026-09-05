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

export type ProductCategory = string

export const MEASUREMENT_UNITS = [
  'Kilograms',
  'Grams',
  'Litres',
  'Millilitres',
  'Metres',
  'Other',
] as const

export const PACKAGE_TYPES = ['Bag', 'Piece', 'Pack', 'Case', 'Box', 'Bottle', 'Other'] as const

export type Product = {
  id: string
  name: string
  category: ProductCategory
  quantity: number
  unit: string
  packageType?: string
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

export type ProductCategoryOption = {
  id: string
  name: string
  createdAt: string
}

const inventoryDb = new Dexie('grocery-inventory') as Dexie & {
  products: EntityTable<Product, 'id'>
  orders: EntityTable<SalesOrder, 'id'>
  orderItems: EntityTable<SalesOrderItem, 'id'>
  categories: EntityTable<ProductCategoryOption, 'id'>
}

inventoryDb.version(1).stores({
  products: 'id, name, category, updatedAt',
})

inventoryDb.version(2).stores({
  products: 'id, name, category, updatedAt',
  orders: 'id, orderNumber, soldAt, updatedAt',
  orderItems: 'id, orderId, productId, productName, category',
})

inventoryDb.version(3).stores({
  products: 'id, name, category, updatedAt',
  orders: 'id, orderNumber, soldAt, updatedAt',
  orderItems: 'id, orderId, productId, productName, category',
  categories: 'id, name',
})

export { inventoryDb }