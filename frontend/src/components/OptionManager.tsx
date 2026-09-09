import { useEffect, useRef, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { ProductOption, ProductOptionType } from '../services/database'

const labels: Record<ProductOptionType, string> = {
  category: 'Categories',
  brand: 'Brands',
  measurementUnit: 'Measurement units',
  packageType: 'Package types',
}

type Props = {
  options: ProductOption[]
  requestedType?: ProductOptionType
  onAdd: (type: ProductOptionType, name: string) => Promise<void>
  onAdded: (type: ProductOptionType, name: string) => void
  onRename: (option: ProductOption) => Promise<void>
  onDelete: (option: ProductOption) => Promise<void>
}

export function OptionManager({ options, requestedType, onAdd, onAdded, onRename, onDelete }: Props) {
  const [type, setType] = useState<ProductOptionType>()
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
    useEffect(() => { if (requestedType) { setType(requestedType); setName(''); window.setTimeout(() => inputRef.current?.focus(), 0) } }, [requestedType])

  const visibleOptions = type ? options.filter((option) => option.type === type) : []

  async function addOption() {
    const nextName = name.trim()
    if (!nextName) return
    if (!type) return
    await onAdd(type, nextName)
    onAdded(type, nextName)
    setName('')
  }

  return <section className="option-manager">
    <div><p className="eyebrow">Inventory settings</p><h2>Catalog options</h2></div>
    <div className="option-tabs">{(Object.keys(labels) as ProductOptionType[]).map((optionType) => <button className={type === optionType ? 'active' : ''} type="button" onClick={() => { setType((current) => current === optionType ? undefined : optionType); setName('') }} key={optionType}>{labels[optionType]}</button>)}</div>
    {type && <div className="option-content"><div className="option-add"><input ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} placeholder={`Add ${labels[type].toLowerCase().slice(0, -1)}`} /><button type="button" onClick={addOption}><Plus size={16} />Add</button></div>
    <div className="option-list">{visibleOptions.length ? visibleOptions.map((option) => <span className="option-chip" key={option.id}>{option.name}<button type="button" onClick={() => onRename(option)} aria-label={`Rename ${option.name}`}><Pencil size={13} /></button><button type="button" onClick={() => onDelete(option)} aria-label={`Delete ${option.name}`}><Trash2 size={13} /></button></span>) : <span className="muted">No {labels[type].toLowerCase()} yet.</span>}</div></div>}
  </section>
}