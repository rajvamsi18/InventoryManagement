import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import { PRODUCT_CATEGORIES, type Product, type ProductCategory } from '../services/database'

type ProductValues = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
type Props = { product?: Product; onSave: (value: ProductValues) => Promise<void>; onCancel?: () => void }
const blank = (): ProductValues => ({ name: '', category: 'Produce', quantity: 1, unit: 'pieces', price: undefined, profitMarginPercent: undefined, sellingPrice: undefined, lowStockAt: 3 })

export function ProductForm({ product, onSave, onCancel }: Props) {
  const [values, setValues] = useState<ProductValues>(product ?? blank())
  const [isSaving, setIsSaving] = useState(false)
  useEffect(() => setValues(product ?? blank()), [product])
  const update = <K extends keyof ProductValues>(key: K, value: ProductValues[K]) => setValues((current) => ({ ...current, [key]: value }))
  function updateMargin(margin: string) { const profitMarginPercent = margin ? Number(margin) : undefined; update('profitMarginPercent', profitMarginPercent); if (values.price !== undefined && profitMarginPercent !== undefined) update('sellingPrice', Number((values.price * (1 + profitMarginPercent / 100)).toFixed(2))) }
  async function submit(event: React.FormEvent) { event.preventDefault(); setIsSaving(true); await onSave(values); setIsSaving(false); if (!product) setValues(blank()) }
  return <form className="product-form" onSubmit={submit}><div className="form-heading"><div><p className="eyebrow">{product ? 'Update product' : 'New stock item'}</p><h2>{product ? product.name : 'Add to inventory'}</h2></div>{product && <button className="icon-button" type="button" onClick={onCancel} aria-label="Cancel editing"><X size={18} /></button>}</div>
    <label>Product name<input required value={values.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Basmati rice" /></label>
    <div className="form-grid"><label>Category<select value={values.category} onChange={(event) => update('category', event.target.value as ProductCategory)}>{PRODUCT_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Quantity<input required min="0" step="0.01" type="number" value={values.quantity} onChange={(event) => update('quantity', Number(event.target.value))} /></label></div>
    <div className="form-grid"><label>Unit<input required value={values.unit} onChange={(event) => update('unit', event.target.value)} /></label><label>Unit cost<input min="0" step="0.01" type="number" value={values.price ?? ''} onChange={(event) => update('price', event.target.value ? Number(event.target.value) : undefined)} /></label></div>
    <div className="form-grid"><label>Profit margin %<input min="0" step="0.01" type="number" value={values.profitMarginPercent ?? ''} onChange={(event) => updateMargin(event.target.value)} /></label><label>Selling price<input min="0" step="0.01" type="number" value={values.sellingPrice ?? ''} onChange={(event) => update('sellingPrice', event.target.value ? Number(event.target.value) : undefined)} /></label></div>
    <label>Low-stock alert at<input required min="0" step="0.01" type="number" value={values.lowStockAt} onChange={(event) => update('lowStockAt', Number(event.target.value))} /></label><button className="save-button" disabled={isSaving}><Check size={18} />{isSaving ? 'Saving...' : product ? 'Update product' : 'Save product'}</button>
  </form>
}