import { useEffect, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { MEASUREMENT_UNITS, PACKAGE_TYPES, type Product, type ProductCategory } from '../services/database'

type ProductValues = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
type Props = { product?: Product; categories: string[]; onAddCategory: (name: string) => Promise<void>; onSave: (value: ProductValues) => Promise<void>; onCancel?: () => void }
const blank = (): ProductValues => ({ name: '', category: 'Produce', quantity: 1, unit: 'Kilograms', packageType: 'Bag', price: undefined, profitMarginPercent: undefined, sellingPrice: undefined, lowStockAt: 3 })

export function ProductForm({ product, categories, onAddCategory, onSave, onCancel }: Props) {
  const [values, setValues] = useState<ProductValues>(product ?? blank())
  const [newCategory, setNewCategory] = useState('')
  const [customUnit, setCustomUnit] = useState('')
  const [customPackageType, setCustomPackageType] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  useEffect(() => { const next = product ?? blank(); setValues(next); setCustomUnit(MEASUREMENT_UNITS.includes(next.unit as typeof MEASUREMENT_UNITS[number]) ? '' : next.unit); setCustomPackageType(PACKAGE_TYPES.includes((next.packageType ?? '') as typeof PACKAGE_TYPES[number]) ? '' : next.packageType ?? '') }, [product])
  const update = <K extends keyof ProductValues>(key: K, value: ProductValues[K]) => setValues((current) => ({ ...current, [key]: value }))
  const hasCustomUnit = values.unit === 'Other' || !MEASUREMENT_UNITS.includes(values.unit as typeof MEASUREMENT_UNITS[number])
  const hasCustomPackageType = values.packageType === 'Other' || !PACKAGE_TYPES.includes((values.packageType ?? '') as typeof PACKAGE_TYPES[number])
  function updateMargin(margin: string) { const profitMarginPercent = margin ? Number(margin) : undefined; update('profitMarginPercent', profitMarginPercent); if (values.price !== undefined && profitMarginPercent !== undefined) update('sellingPrice', Number((values.price * (1 + profitMarginPercent / 100)).toFixed(2))) }
  async function addCategory() { const name = newCategory.trim(); if (!name) return; await onAddCategory(name); update('category', name); setNewCategory('') }
  async function submit(event: React.FormEvent) { event.preventDefault(); setIsSaving(true); await onSave({ ...values, unit: values.unit === 'Other' ? customUnit.trim() : values.unit, packageType: values.packageType === 'Other' ? customPackageType.trim() : values.packageType }); setIsSaving(false); if (!product) { setValues(blank()); setCustomUnit(''); setCustomPackageType('') } }
  return <form className="product-form" onSubmit={submit}><div className="form-heading"><div><p className="eyebrow">{product ? 'Update product' : 'New stock item'}</p><h2>{product ? product.name : 'Add to inventory'}</h2></div>{product && <button className="icon-button" type="button" onClick={onCancel} aria-label="Cancel editing"><X size={18} /></button>}</div>
    <label>Product name<input required value={values.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Basmati rice" /></label>
    <div className="form-grid"><label>Category<select value={values.category} onChange={(event) => update('category', event.target.value as ProductCategory)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Quantity<input required min="0" step="0.01" type="number" value={values.quantity} onChange={(event) => update('quantity', Number(event.target.value))} /></label></div>
    <div className="add-category"><input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="New category name" /><button type="button" onClick={addCategory}><Plus size={15} />Add category</button></div>
    <div className="form-grid"><label>Measurement unit<select value={hasCustomUnit ? 'Other' : values.unit} onChange={(event) => update('unit', event.target.value)}>{MEASUREMENT_UNITS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Package type<select value={hasCustomPackageType ? 'Other' : values.packageType} onChange={(event) => update('packageType', event.target.value)}>{PACKAGE_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label></div>
    {(hasCustomUnit || hasCustomPackageType) && <div className="form-grid">{hasCustomUnit && <label>Custom measurement unit<input required value={customUnit} onChange={(event) => setCustomUnit(event.target.value)} placeholder="e.g. Dozen" /></label>}{hasCustomPackageType && <label>Custom package type<input required value={customPackageType} onChange={(event) => setCustomPackageType(event.target.value)} placeholder="e.g. Tray" /></label>}</div>}
    <div className="form-grid"><label>Unit cost<input min="0" step="0.01" type="number" value={values.price ?? ''} onChange={(event) => update('price', event.target.value ? Number(event.target.value) : undefined)} /></label><label>Profit margin %<input min="0" step="0.01" type="number" value={values.profitMarginPercent ?? ''} onChange={(event) => updateMargin(event.target.value)} /></label></div>
    <div className="form-grid"><label>Selling price<input min="0" step="0.01" type="number" value={values.sellingPrice ?? ''} onChange={(event) => update('sellingPrice', event.target.value ? Number(event.target.value) : undefined)} /></label><label>Low-stock alert at<input required min="0" step="0.01" type="number" value={values.lowStockAt} onChange={(event) => update('lowStockAt', Number(event.target.value))} /></label></div><button className="save-button" disabled={isSaving}><Check size={18} />{isSaving ? 'Saving...' : product ? 'Update product' : 'Save product'}</button>
  </form>
}