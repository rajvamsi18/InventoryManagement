import { Eye, Pencil, Trash2 } from 'lucide-react'
import type { Product } from '../services/database'

type Props = { products: Product[]; onView: (product: Product) => void; onDelete?: (product: Product) => void; onEdit?: (product: Product) => void }
const sizeLabel = (product: Product) => `${product.measurementValue ?? ''} ${product.unit}`.trim()
const quantityLabel = (quantity: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(quantity)

export function ProductList({ products, onView, onDelete, onEdit }: Props) {
  if (!products.length) return <div className="empty-state"><p>No matching products.</p><span>Add stock in Inventory or change your search.</span></div>
  return <div className="product-grid">{products.map((product) => <article className="product-card" key={product.id}>
    <button className="product-card-main" type="button" onClick={() => onView(product)}>
      {product.imageDataUrl ? <img className="product-image" src={product.imageDataUrl} alt="" /> : <span className="product-monogram">{(product.brand || product.name).slice(0, 2).toUpperCase()}</span>}
      <span className="product-copy"><small>{product.brand || 'Unbranded'} · {product.category}</small><strong>{product.name}</strong><span>{sizeLabel(product)} · {product.packageType || 'Item'}</span></span>
      <span className="product-price"><small>MRP</small><strong>{product.sellingPrice === undefined ? 'Not set' : `Rs. ${product.sellingPrice.toFixed(2)}`}</strong></span>
    </button>
    <footer><span className={product.quantity <= product.lowStockAt ? 'stock-badge low' : 'stock-badge'}>{quantityLabel(product.quantity)} in stock</span><div className="row-actions"><button onClick={() => onView(product)} aria-label={`View ${product.name}`}><Eye size={16} /></button>{onEdit && <button onClick={() => onEdit(product)} aria-label={`Edit ${product.name}`}><Pencil size={16} /></button>}{onDelete && <button className="danger" onClick={() => onDelete(product)} aria-label={`Delete ${product.name}`}><Trash2 size={16} /></button>}</div></footer>
  </article>)}</div>
}