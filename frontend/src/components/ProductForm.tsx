import { useEffect, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { Product, ProductOptionType } from '../services/database'
import type { VoiceProductPrefill } from './VoiceOrderAssistant'

type ProductValues = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
type Props = { product?: Product; categories: string[]; brands: string[]; measurementUnits: string[]; packageTypes: string[]; addedOption?: { type: ProductOptionType; name: string }; initialValues?: VoiceProductPrefill; onRequestOption: (type: ProductOptionType) => void; onSave: (value: ProductValues) => Promise<boolean>; onCancel?: () => void }
const blank = (categories: string[], brands: string[], units: string[], packages: string[]): ProductValues => ({ name: '', brand: brands[0] ?? '', category: categories[0] ?? '', quantity: 1, unit: units[0] ?? '', measurementValue: 1, packageType: packages[0] ?? '', batchNumber: '', expiryDate: '', supplier: '', taxPercent: undefined, imageDataUrl: '', price: undefined, profitMarginPercent: undefined, sellingPrice: undefined, lowStockAt: 3 })

export function ProductForm({ product, categories, brands, measurementUnits, packageTypes, addedOption, initialValues, onRequestOption, onSave, onCancel }: Props) {
  const [values, setValues] = useState<ProductValues>(product ?? blank(categories, brands, measurementUnits, packageTypes))
  const [isSaving, setIsSaving] = useState(false)
  useEffect(() => { if (product) setValues(product) }, [product])
  useEffect(() => { if (!product) setValues((current) => ({ ...current, brand: current.brand || brands[0] || '', category: current.category || categories[0] || '', unit: current.unit || measurementUnits[0] || '', packageType: current.packageType || packageTypes[0] || '' })) }, [product, categories, brands, measurementUnits, packageTypes])
  useEffect(() => { if (!addedOption) return; const field = addedOption.type === 'brand' ? 'brand' : addedOption.type === 'category' ? 'category' : addedOption.type === 'measurementUnit' ? 'unit' : 'packageType'; setValues((current) => ({ ...current, [field]: addedOption.name })) }, [addedOption])
  useEffect(() => {
    if (product || !initialValues) return
    setValues((current) => ({
      ...current,
      name: current.name || initialValues.name,
      measurementValue: initialValues.measurementValue ?? current.measurementValue,
      unit: initialValues.unit || current.unit,
      packageType: initialValues.packageType || current.packageType,
      price: initialValues.price ?? current.price,
      profitMarginPercent: initialValues.profitMarginPercent ?? current.profitMarginPercent,
      sellingPrice: initialValues.sellingPrice ?? current.sellingPrice,
    }))
  }, [product, initialValues])
  const update = <K extends keyof ProductValues>(key: K, value: ProductValues[K]) => setValues((current) => ({ ...current, [key]: value }))
  function updateCost(cost: string) { const price = cost ? Number(cost) : undefined; setValues((current) => { const sellingPrice = price !== undefined && current.profitMarginPercent !== undefined ? Number((price * (1 + current.profitMarginPercent / 100)).toFixed(2)) : current.sellingPrice; return { ...current, price, sellingPrice } }) }
  function updateMargin(margin: string) { const profitMarginPercent = margin ? Number(margin) : undefined; setValues((current) => { const sellingPrice = current.price !== undefined && profitMarginPercent !== undefined ? Number((current.price * (1 + profitMarginPercent / 100)).toFixed(2)) : current.sellingPrice; return { ...current, profitMarginPercent, sellingPrice } }) }
  function updateSellingPrice(sellingPriceText: string) { const sellingPrice = sellingPriceText ? Number(sellingPriceText) : undefined; setValues((current) => { const profitMarginPercent = sellingPrice !== undefined && current.price !== undefined && current.price > 0 ? Number((((sellingPrice - current.price) / current.price) * 100).toFixed(2)) : current.profitMarginPercent; return { ...current, sellingPrice, profitMarginPercent } }) }
  function updateImage(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; if (file.size > 1_500_000) { window.alert('Choose an image smaller than 1.5 MB.'); event.target.value = ''; return } const reader = new FileReader(); reader.onload = () => update('imageDataUrl', String(reader.result)); reader.readAsDataURL(file) }
  async function submit(event: React.FormEvent) { event.preventDefault(); setIsSaving(true); const saved = await onSave(values); setIsSaving(false); if (saved && !product) setValues(blank(categories, brands, measurementUnits, packageTypes)) }
  const canSave = values.category && values.brand && values.unit && values.packageType && (values.measurementValue ?? 0) > 0
  function selectOption(type: ProductOptionType, value: string, field: 'brand' | 'category' | 'unit' | 'packageType') { if (value === '__add_new__') onRequestOption(type); else update(field, value) }

  return <form className="product-form" onSubmit={submit}><div className="form-heading"><div><p className="eyebrow">{product ? 'Update product' : 'New stock item'}</p><h2>{product ? product.name : 'Add to inventory'}</h2></div>{product && <button className="icon-button" type="button" onClick={onCancel} aria-label="Cancel editing"><X size={18} /></button>}</div>
    <label>Product name<input required value={values.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Basmati rice" /></label>
    <div className="form-grid"><label>Brand<select required value={values.brand ?? ''} onChange={(event) => selectOption('brand', event.target.value, 'brand')}><option value="" disabled>Select a brand</option>{brands.map((item) => <option key={item}>{item}</option>)}<option value="__add_new__">+ Add new brand</option></select></label><label>Category<select required value={values.category} onChange={(event) => selectOption('category', event.target.value, 'category')}><option value="" disabled>Select a category</option>{categories.map((item) => <option key={item}>{item}</option>)}<option value="__add_new__">+ Add new category</option></select></label></div>
    <div className="form-grid"><label>Stock quantity<input required min="0" step="1" type="number" inputMode="numeric" value={values.quantity} onChange={(event) => update('quantity', Math.max(0, Math.trunc(Number(event.target.value))))} /></label><label>Package type<select required value={values.packageType ?? ''} onChange={(event) => selectOption('packageType', event.target.value, 'packageType')}><option value="" disabled>Select a package type</option>{packageTypes.map((item) => <option key={item}>{item}</option>)}<option value="__add_new__">+ Add new package type</option></select></label></div>
    <div className="form-grid"><label>Volume<input required min="0.01" step="0.01" type="number" value={values.measurementValue ?? ''} onChange={(event) => update('measurementValue', Number(event.target.value))} placeholder="e.g. 1, 500" /></label><label>Measurement unit<select required value={values.unit} onChange={(event) => selectOption('measurementUnit', event.target.value, 'unit')}><option value="" disabled>Select a measurement unit</option>{measurementUnits.map((item) => <option key={item}>{item}</option>)}<option value="__add_new__">+ Add new measurement unit</option></select></label></div>
    <div className="form-grid"><label>Batch number<input value={values.batchNumber ?? ''} onChange={(event) => update('batchNumber', event.target.value)} placeholder="e.g. B240901" /></label><label>Expiry date<input type="date" value={values.expiryDate ?? ''} onChange={(event) => update('expiryDate', event.target.value)} /></label></div>
    <div className="form-grid"><label>Supplier<input value={values.supplier ?? ''} onChange={(event) => update('supplier', event.target.value)} placeholder="Supplier name" /></label><label>Tax / GST %<input min="0" step="0.01" type="number" value={values.taxPercent ?? ''} onChange={(event) => update('taxPercent', event.target.value ? Number(event.target.value) : undefined)} /></label></div>
    <div className="form-grid"><label>Unit cost<input min="0" step="0.01" type="number" value={values.price ?? ''} onChange={(event) => updateCost(event.target.value)} /></label><label>Profit margin %<input min="0" step="0.01" type="number" value={values.profitMarginPercent ?? ''} onChange={(event) => updateMargin(event.target.value)} /></label></div>
    <div className="form-grid"><label>Selling price (MRP)<input min="0" step="0.01" type="number" value={values.sellingPrice ?? ''} onChange={(event) => updateSellingPrice(event.target.value)} /></label><label>Low-stock alert at<input required min="0" step="1" type="number" inputMode="numeric" value={values.lowStockAt} onChange={(event) => update('lowStockAt', Math.max(0, Math.trunc(Number(event.target.value))))} /></label></div>
    <label>Product image<input accept="image/jpeg,image/png,image/webp" type="file" onChange={updateImage} />{values.imageDataUrl && <span className="image-selected">Image selected · choose another file to replace it</span>}</label><button className="save-button" disabled={isSaving || !canSave}><Check size={18} />{isSaving ? 'Saving...' : product ? 'Update product' : 'Save product'}</button>
  </form>
}