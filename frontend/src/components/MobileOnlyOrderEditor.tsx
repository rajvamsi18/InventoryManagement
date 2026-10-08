import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { emptyOnlyOrderLine, parseOnlyOrderLines, updateOnlyOrderLine, type OnlyOrderDraft } from '../services/onlyOrders'

type Props = {
  lines: OnlyOrderDraft[]
  onChange: (lines: OnlyOrderDraft[]) => void
  onSubmit: (event: React.FormEvent, lines: OnlyOrderDraft[]) => void
  onCancel: () => void
  saving: boolean
  editing: boolean
}

const blankLine = (line: OnlyOrderDraft) => !line.productName && !line.volume && !line.price && !line.total
const currency = (amount: number) => `Rs. ${amount.toFixed(2)}`

export function MobileOnlyOrderEditor({ lines, onChange, onSubmit, onCancel, saving, editing }: Props) {
  const rows = lines.filter(line => !blankLine(line))
  const [draft, setDraft] = useState<OnlyOrderDraft | undefined>(() => rows.length ? undefined : emptyOnlyOrderLine())
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const productRef = useRef<HTMLInputElement>(null)
  const total = rows.reduce((sum, line) => sum + (Number(line.total) || 0), 0)

  useEffect(() => {
    const dialog = dialogRef.current
    if (draft && !dialog?.open) {
      dialog?.showModal()
      productRef.current?.focus()
    } else if (!draft && dialog?.open) dialog.close()
  }, [draft])

  function open(line = emptyOnlyOrderLine()) {
    setError('')
    setDraft({ ...line })
  }

  function change(field: keyof OnlyOrderDraft, value: string) {
    setDraft(current => current ? updateOnlyOrderLine(current, field, value) : current)
    setError('')
  }

  function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft) return
    try {
      parseOnlyOrderLines([draft])
      onChange(rows.some(line => line.id === draft.id) ? rows.map(line => line.id === draft.id ? draft : line) : [...rows, draft])
      const button = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
      setError('')
      if (button?.value === 'next') {
        setDraft(emptyOnlyOrderLine())
        productRef.current?.focus()
      } else setDraft(undefined)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Check the product details.')
    }
  }

  return <>
    <form className="mobile-only-order-form" onSubmit={event => onSubmit(event, rows)}>
      <div className="mobile-order-list">
        {rows.length ? rows.map((line, index) => <div className="mobile-order-row" key={line.id}>
          <button type="button" className="mobile-order-product" disabled={saving} onClick={() => open(line)} aria-label={`Edit ${line.productName || `product ${index + 1}`}`}>
            <span className="mobile-order-description"><strong>{line.productName || 'Unnamed product'}</strong>{line.volume && <small>{line.volume}</small>}</span>
            <span className="mobile-order-amount"><strong>{currency(Number(line.total) || 0)}</strong><small>{line.quantity} x {currency(Number(line.price) || 0)}</small></span>
          </button>
          <button type="button" className="icon-button" title="Edit product" aria-label={`Edit product ${index + 1}`} disabled={saving} onClick={() => open(line)}><Pencil size={16} /></button>
          <button type="button" className="icon-button" title="Remove product" aria-label={`Remove product ${index + 1}`} disabled={saving} onClick={() => onChange(rows.filter(item => item.id !== line.id))}><Trash2 size={17} /></button>
        </div>) : <p className="muted">No products added.</p>}
      </div>
      <div className="mobile-order-bar">
        <div className="mobile-order-total"><span>{rows.length} product{rows.length === 1 ? '' : 's'}</span><strong>{currency(total)}</strong><button type="button" className="icon-button" title="Cancel order" aria-label="Cancel order" disabled={saving} onClick={onCancel}><X size={18} /></button></div>
        <div className="mobile-order-bar-actions">
          <button type="button" className="primary-button" disabled={saving} onClick={() => open()}><Plus size={17} /> Add product</button>
          <button type="submit" className="save-button" disabled={saving || !rows.length}><Check size={17} />{saving ? 'Saving...' : editing ? 'Save order' : 'Submit order'}</button>
        </div>
      </div>
    </form>
    <dialog ref={dialogRef} className="mobile-product-sheet" aria-labelledby="mobile-product-title" onCancel={() => setDraft(undefined)} onClose={() => setDraft(undefined)}>
      <form onSubmit={saveProduct}>
        <header><h2 id="mobile-product-title">{draft && rows.some(line => line.id === draft.id) ? 'Edit product' : 'Add product'}</h2><button type="button" className="icon-button" title="Close product editor" aria-label="Close product editor" onClick={() => setDraft(undefined)}><X size={20} /></button></header>
        {draft && <div className="mobile-product-fields">
          <label>Product<input ref={productRef} required maxLength={200} value={draft.productName} onChange={event => change('productName', event.target.value)} /></label>
          <label>Volume (optional)<input maxLength={100} value={draft.volume} onChange={event => change('volume', event.target.value)} /></label>
          <div className="mobile-product-prices">
            <label>Quantity<input required type="number" inputMode="decimal" min="0" step="any" value={draft.quantity} onChange={event => change('quantity', event.target.value)} /></label>
            <label>Price<input required type="number" inputMode="decimal" min="0" step="any" value={draft.price} onChange={event => change('price', event.target.value)} /></label>
            <label>Total<input required type="number" inputMode="decimal" min="0" step="0.01" value={draft.total} onChange={event => change('total', event.target.value)} /></label>
          </div>
          {error && <p role="alert" className="voice-error">{error}</p>}
        </div>}
        <footer>
          <button type="submit" className="primary-button" value="next"><Plus size={17} /> Add &amp; next</button>
          <button type="submit" className="save-button" value="done"><Check size={17} /> Done</button>
        </footer>
      </form>
    </dialog>
  </>
}