import { ArrowLeft, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Product } from '../services/database'

export type BasketLine = { productId: string; quantity: number; price: number }

type Props = {
  products: Product[]
  categories: string[]
  lines: BasketLine[]
  orderNumber: string
  isEditing: boolean
  soldCounts: Record<string, number>
  onAdd: (productId: string) => void
  onChange: (productId: string, field: 'quantity' | 'price', value: number) => void
  onRemove: (productId: string) => void
  onAddNewProduct: () => void
  onCancel: () => void
  onDiscard: () => void
  onSubmit: () => Promise<void>
}

const currency = (amount: number) => `Rs. ${amount.toFixed(2)}`
const quantity = (value: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(value)

export function SalesBasket({ products, categories, lines, orderNumber, isEditing, soldCounts, onAdd, onChange, onRemove, onAddNewProduct, onCancel, onDiscard, onSubmit }: Props) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [page, setPage] = useState(1)
  const normalized = search.trim().toLowerCase()
  const isSearching = Boolean(normalized) || category !== 'All'
  const matchingProducts = products.filter((product) => product.quantity > 0 && (category === 'All' || product.category === category) && [product.name, product.brand, product.category, product.unit, product.packageType, product.sellingPrice?.toString(), `${product.measurementValue ?? ''} ${product.unit}`].some((value) => value?.toLowerCase().includes(normalized)))
  const popularProducts = [...products].filter((product) => product.quantity > 0).sort((first, second) => (soldCounts[second.id] ?? 0) - (soldCounts[first.id] ?? 0)).slice(0, 4)
  const pageCount = Math.max(1, Math.ceil(matchingProducts.length / 12))
  const available = isSearching ? matchingProducts.slice((page - 1) * 12, page * 12) : popularProducts
  useEffect(() => setPage(1), [search, category])
  const total = lines.reduce((sum, line) => sum + line.quantity * line.price, 0)

  return <section className="basket-page">
    <header className="page-heading basket-heading"><div><div className="basket-nav-actions"><button className="back-button" onClick={onCancel}><ArrowLeft size={15} /> Back to orders</button><button className="cancel-order-button" onClick={onDiscard}>Cancel order</button></div><p className="eyebrow">Order number</p><h1>{orderNumber}</h1></div><button className="primary-button" onClick={onAddNewProduct}><Plus size={16} /> New product</button></header>
    <div className="basket-layout"><section className="panel basket-catalog"><div className="catalog-tools"><label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, brand, MRP, size, category, unit" /></label><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="All">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>
      <p className="basket-results-label">{isSearching ? `${matchingProducts.length} matching products` : 'Top 4 most sold products'}</p><div className="basket-product-grid">{available.length ? available.map((product) => { const line = lines.find((item) => item.productId === product.id); return <article className="basket-product" key={product.id}>{product.imageDataUrl ? <img src={product.imageDataUrl} alt="" /> : <span className="product-monogram">{(product.brand || product.name).slice(0, 2).toUpperCase()}</span>}<div><small>{product.brand || 'Unbranded'} · {product.category}</small><strong>{product.name}</strong><span>{product.measurementValue} {product.unit} · {product.packageType}</span><em>{currency(product.sellingPrice ?? product.price ?? 0)} · {quantity(product.quantity)} in stock</em></div><button disabled={Boolean(line)} onClick={() => onAdd(product.id)}>{line ? 'In basket' : 'Add to basket'}</button></article> }) : <div className="empty-state"><p>No matching products.</p><button className="add-product-link" onClick={onAddNewProduct}><Plus size={16} /> Add new product</button></div>}</div>
      {isSearching && pageCount > 1 && <nav className="pagination" aria-label="Basket product pages"><button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button>{Array.from({ length: pageCount }, (_, index) => <button className={page === index + 1 ? 'active' : ''} onClick={() => setPage(index + 1)} key={index + 1}>{index + 1}</button>)}<button disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}
    </section><aside className="panel basket-summary"><h2>Basket <span>{lines.length}</span></h2>{lines.length ? lines.map((line) => { const product = products.find((item) => item.id === line.productId); if (!product) return null; return <article className="basket-line" key={line.productId}><div><strong>{product.name}</strong><small>{product.measurementValue} {product.unit}</small></div><div className="quantity-stepper"><button onClick={() => onChange(line.productId, 'quantity', Math.max(1, Math.trunc(line.quantity) - 1))}><Minus size={14} /></button><input min="1" max={product.quantity + (isEditing ? 999999 : 0)} step="1" inputMode="numeric" type="number" value={line.quantity} onChange={(event) => onChange(line.productId, 'quantity', Math.max(1, Math.trunc(Number(event.target.value))))} /><button onClick={() => onChange(line.productId, 'quantity', Math.trunc(line.quantity) + 1)}><Plus size={14} /></button></div><label>Sale price<input min="0" step="0.01" type="number" value={line.price} onChange={(event) => onChange(line.productId, 'price', Number(event.target.value))} /></label><strong>{currency(line.quantity * line.price)}</strong><button className="remove-line" onClick={() => onRemove(line.productId)} aria-label={`Remove ${product.name}`}><Trash2 size={16} /></button></article> }) : <div className="empty-state"><ShoppingCart size={26} /><p>Your basket is empty.</p><span>Add products from the catalog.</span></div>}<div className="order-total">Order total <strong>{currency(total)}</strong></div><button className="save-button" disabled={!lines.length} onClick={onSubmit}><ShoppingCart size={18} />{isEditing ? 'Save order' : 'Submit order'}</button></aside></div>
  </section>
}