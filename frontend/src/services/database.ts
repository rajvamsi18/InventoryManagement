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
  brand?: string
  category: ProductCategory
  quantity: number
  unit: string
  measurementValue?: number
  packageType?: string
  batchNumber?: string
  expiryDate?: string
  supplier?: string
  stockLots?: ProductStockLot[]
  taxPercent?: number
  imageDataUrl?: string
  price?: number
  profitMarginPercent?: number
  sellingPrice?: number
  lowStockAt: number
  createdAt: string
  updatedAt: string
}

export type ProductStockLot = {
  id: string
  supplier: string
  batchNumber: string
  expiryDate?: string
  quantity: number
  updatedAt: string
}

export type SalesOrder = {
  id: string
  orderNumber: string
  customerName?: string
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
  measurementValue?: number
  unit?: string
  volume?: string
  category: ProductCategory
  quantitySold: number
  unitCost?: number
  unitSellingPrice: number
  lineTotal: number
}

export type OnlyOrderLine = {
  id: string
  productName: string
  volume: string
  quantity: number
  price: number
  total: number
  quantityAssumed?: boolean
  sourceMessageId?: string
}

export type OnlyOrderSourceMessage = { id: string; text: string }

export type OnlyOrder = SalesOrder & { items: OnlyOrderLine[]; sourceMessages?: OnlyOrderSourceMessage[] }

export type Customer = {
  id: string
  name: string
  normalizedName: string
  phone?: string
  createdAt: string
  updatedAt: string
  archivedAt?: string
  deletedAt?: string
}

export type CreditOrderLine = OnlyOrderLine

export type CreditOrder = {
  id: string
  orderNumber: string
  customerId: string
  customerName: string
  soldAt: string
  totalAmount: number
  items: CreditOrderLine[]
  createdAt: string
  updatedAt?: string
  sourceMessages?: OnlyOrderSourceMessage[]
}

export type CreditPaymentMethod = 'Cash' | 'UPI' | 'Bank transfer' | 'Other'

export type CreditPayment = {
  id: string
  paymentNumber: string
  customerId: string
  customerName: string
  amount: number
  paidAt: string
  method: CreditPaymentMethod
  reference?: string
  createdAt: string
  updatedAt?: string
}

export type CreditAdjustment = {
  id: string
  customerId: string
  targetType: 'order' | 'payment'
  targetId: string
  reason: string
  createdAt: string
}

export type CreditHistory = {
  id: string
  customerId: string
  action: 'edit' | 'void'
  reason?: string
  createdAt: string
} & (
  | { targetType: 'order'; targetId: string; before: CreditOrder; after?: CreditOrder }
  | { targetType: 'payment'; targetId: string; before: CreditPayment; after?: CreditPayment }
)

export type ProductCategoryOption = {
  id: string
  name: string
  createdAt: string
}

export type ProductOptionType = 'category' | 'brand' | 'measurementUnit' | 'packageType'

export type ProductOption = {
  id: string
  type: ProductOptionType
  name: string
  createdAt: string
}

const inventoryDb = new Dexie('grocery-inventory') as Dexie & {
  products: EntityTable<Product, 'id'>
  orders: EntityTable<SalesOrder, 'id'>
  orderItems: EntityTable<SalesOrderItem, 'id'>
  onlyOrders: EntityTable<OnlyOrder, 'id'>
  customers: EntityTable<Customer, 'id'>
  creditOrders: EntityTable<CreditOrder, 'id'>
  creditPayments: EntityTable<CreditPayment, 'id'>
  creditAdjustments: EntityTable<CreditAdjustment, 'id'>
  creditHistory: EntityTable<CreditHistory, 'id'>
  categories: EntityTable<ProductCategoryOption, 'id'>
  productOptions: EntityTable<ProductOption, 'id'>
}

function defaultProductOptions(createdAt: string): ProductOption[] {
  return [
    ...MEASUREMENT_UNITS.filter((name) => name !== 'Other').map((name) => ({ id: `measurement-${name.toLowerCase()}`, type: 'measurementUnit' as const, name, createdAt })),
    ...PACKAGE_TYPES.filter((name) => name !== 'Other').map((name) => ({ id: `package-${name.toLowerCase()}`, type: 'packageType' as const, name, createdAt })),
  ]
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

inventoryDb.version(4).stores({
  products: 'id, name, brand, category, unit, packageType, updatedAt',
  orders: 'id, orderNumber, soldAt, updatedAt',
  orderItems: 'id, orderId, productId, productName, category',
  categories: 'id, name',
  productOptions: 'id, type, &[type+name]',
}).upgrade(async (transaction) => {
  const now = new Date().toISOString()
  const legacyCategories = await transaction.table('categories').toArray() as ProductCategoryOption[]
  const options: ProductOption[] = [
    ...legacyCategories.map((category) => ({ id: category.id, type: 'category' as const, name: category.name, createdAt: category.createdAt })),
    ...defaultProductOptions(now),
  ]
  await transaction.table('productOptions').bulkPut(options)
})

inventoryDb.version(5).stores({
  products: 'id, name, brand, category, unit, packageType, updatedAt',
  orders: 'id, orderNumber, soldAt, updatedAt',
  orderItems: 'id, orderId, productId, productName, category',
  categories: 'id, name',
  productOptions: 'id, type, &[type+name]',
})

inventoryDb.version(6).stores({
  products: 'id, name, brand, category, unit, packageType, updatedAt',
  orders: 'id, orderNumber, soldAt, updatedAt',
  orderItems: 'id, orderId, productId, productName, category',
  categories: 'id, name',
  productOptions: 'id, type, &[type+name]',
}).upgrade(async (transaction) => {
  const orders = await transaction.table('orders').toArray() as SalesOrder[]
  orders.sort((first, second) => first.soldAt.localeCompare(second.soldAt))
  await transaction.table('orders').bulkPut(orders.map((order, index) => ({ ...order, orderNumber: `SMKG-${String(index + 1).padStart(6, '0')}` })))
})

inventoryDb.version(7).stores({
  products: 'id, name, brand, category, unit, packageType, updatedAt',
  orders: 'id, orderNumber, soldAt, updatedAt',
  orderItems: 'id, orderId, productId, productName, category',
  categories: 'id, name',
  productOptions: 'id, type, &[type+name]',
}).upgrade(async (transaction) => {
  const products = await transaction.table('products').toArray() as Product[]
  await transaction.table('products').bulkPut(products.map((product) => ({
    ...product,
    stockLots: product.stockLots ?? (product.supplier || product.batchNumber ? [{ id: crypto.randomUUID(), supplier: product.supplier ?? '', batchNumber: product.batchNumber ?? '', expiryDate: product.expiryDate, quantity: product.quantity, updatedAt: product.updatedAt }] : []),
  })))
})

inventoryDb.version(8).stores({
  products: 'id, name, brand, category, unit, packageType, updatedAt',
  orders: 'id, orderNumber, soldAt, updatedAt',
  orderItems: 'id, orderId, productId, productName, category',
  categories: 'id, name',
  productOptions: 'id, type, &[type+name]',
}).upgrade(async (transaction) => {
  const products = await transaction.table('products').toArray() as Product[]
  await transaction.table('products').bulkPut(products.map((product) => ({
    ...product,
    quantity: Math.max(0, Math.round(product.quantity)),
    lowStockAt: Math.max(0, Math.round(product.lowStockAt)),
    stockLots: product.stockLots?.map((lot) => ({
      ...lot,
      quantity: Math.max(0, Math.round(lot.quantity)),
    })),
  })))
})

inventoryDb.version(9).stores({
  products: 'id, name, brand, category, unit, packageType, updatedAt',
  orders: 'id, orderNumber, soldAt, updatedAt',
  orderItems: 'id, orderId, productId, productName, category',
  categories: 'id, name',
  productOptions: 'id, type, &[type+name]',
  onlyOrders: 'id, orderNumber, soldAt, updatedAt',
})

inventoryDb.version(10).stores({
  products: 'id, name, brand, category, unit, packageType, updatedAt',
  orders: 'id, orderNumber, soldAt, updatedAt',
  orderItems: 'id, orderId, productId, productName, category',
  categories: 'id, name',
  productOptions: 'id, type, &[type+name]',
  onlyOrders: 'id, orderNumber, soldAt, updatedAt',
  customers: 'id, name, normalizedName, phone, archivedAt',
  creditOrders: 'id, customerId, orderNumber, soldAt, [customerId+soldAt]',
  creditPayments: 'id, customerId, paymentNumber, paidAt, [customerId+paidAt]',
  creditAdjustments: 'id, customerId, targetId, &[targetType+targetId]',
})

inventoryDb.version(11).stores({
  creditHistory: 'id, customerId, targetId, targetType, action, createdAt, [customerId+targetId]',
})

inventoryDb.on('populate', (transaction) => transaction.table('productOptions').bulkAdd(defaultProductOptions(new Date().toISOString())))

export { inventoryDb }