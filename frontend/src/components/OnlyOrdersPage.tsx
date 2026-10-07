import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { inventoryDb, type OnlyOrder } from '../services/database'
import { emptyOnlyOrderLine, onlyOrderNumber, onlyOrderReceiptItems, saveOnlyOrder, updateOnlyOrderLine, type OnlyOrderDraft } from '../services/onlyOrders'
import { OrderReceipt } from './OrderReceipt'
import { OrderHistoryHeader } from './OrderHistoryHeader'
import { OrderRow } from './OrderRow'

type Props = { onBack: () => void }
const currency = (amount: number) => `Rs. ${amount.toFixed(2)}`

export function OnlyOrdersPage({ onBack }: Props) {
  const orders = useLiveQuery(async () => (await inventoryDb.onlyOrders.orderBy('soldAt').reverse().toArray()).map(order => ({ ...order, orderNumber: onlyOrderNumber(order.orderNumber) })), []) ?? []
  const [mode, setMode] = useState<'list' | 'edit' | 'detail'>('list')
  const [selectedId, setSelectedId] = useState<string>()
  const [editingId, setEditingId] = useState<string>()
  const [lines, setLines] = useState<OnlyOrderDraft[]>(() => [emptyOnlyOrderLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const selected = orders.find(order => order.id === selectedId)
  const total = lines.reduce((sum, line) => sum + (Number(line.total) || 0), 0)

  function edit(order: OnlyOrder) {
    setEditingId(order.id)
    setLines(order.items.map(item => ({ id: item.id, productName: item.productName, volume: item.volume, quantity: String(item.quantity), price: String(item.price), total: String(item.total) })))
    setError('')
    setMode('edit')
  }

  async function remove(order: OnlyOrder) {
    if (!window.confirm(`Delete ${order.orderNumber}?`)) return
    try {
      await inventoryDb.onlyOrders.delete(order.id)
      if (selectedId === order.id) { setSelectedId(undefined); setMode('list') }
    } catch { setError('Could not delete the order. Please try again.') }
  }

  function change(id: string, field: keyof OnlyOrderDraft, value: string) {
    setLines(current => current.map(line => line.id === id ? updateOnlyOrderLine(line, field, value) : line))
    setError('')
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const order = await saveOnlyOrder(inventoryDb, lines, editingId)
      setSelectedId(order.id)
      setEditingId(undefined)
      setMode('detail')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save the order.')
    } finally { setSaving(false) }
  }

  return <section className="only-orders-page">
    <header className="page-heading">
      <div>
        {mode !== 'list' && <button type="button" className="back-button" disabled={saving} onClick={() => {
          if (mode !== 'edit' || window.confirm('Discard unsaved order changes?')) { setMode('list'); setError('') }
        }}><ArrowLeft size={16} /> Back to Only Order</button>}
        <p className="eyebrow">{mode === 'list' ? 'Point of sale' : 'Only Order'}</p>
        <h1>{mode === 'edit' ? editingId ? 'Edit order' : 'New order' : selected && mode === 'detail' ? selected.orderNumber : 'Orders'}</h1>
      </div>
      {selected && mode === 'detail' && <div className="receipt-actions">
        <button type="button" className="primary-button" onClick={() => edit(selected)}><Pencil size={16} /> Edit order</button>
        <button type="button" className="icon-button" title="Delete order" aria-label="Delete order" onClick={() => void remove(selected)}><Trash2 size={18} /></button>
      </div>}
    </header>
    {error && <p role="alert" className="voice-error">{error}</p>}
    {mode === 'edit' && <form onSubmit={event => void submit(event)} className="only-order-form">
      <fieldset disabled={saving}>
        {lines.map((line, index) => <div className="only-order-line" key={line.id}>
          <label>Product<input aria-label={`Product ${index + 1}`} required maxLength={200} value={line.productName} onChange={event => change(line.id, 'productName', event.target.value)} /></label>
          <label>Volume (optional)<input aria-label={`Volume ${index + 1}`} maxLength={100} value={line.volume} onChange={event => change(line.id, 'volume', event.target.value)} /></label>
          <label>Quantity<input aria-label={`Quantity ${index + 1}`} required type="number" inputMode="numeric" min="1" step="1" value={line.quantity} onChange={event => change(line.id, 'quantity', event.target.value)} /></label>
          <label>Price<input aria-label={`Price ${index + 1}`} required type="number" inputMode="decimal" min="0" step="any" value={line.price} onChange={event => change(line.id, 'price', event.target.value)} /></label>
          <label>Total<input aria-label={`Total ${index + 1}`} required type="number" inputMode="decimal" min="0" step="0.01" value={line.total} onChange={event => change(line.id, 'total', event.target.value)} /></label>
          <button type="button" className="icon-button" title="Remove product" aria-label={`Remove product ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines(current => current.filter(item => item.id !== line.id))}><Trash2 size={18} /></button>
        </div>)}
        <button type="button" className="back-button" onClick={() => setLines(current => [...current, emptyOnlyOrderLine()])}><Plus size={16} /> Add product</button>
        <div className="only-order-submit"><strong>Order total: {currency(total)}</strong>
          <button type="submit" className="save-button"><Check size={18} />{saving ? 'Saving...' : editingId ? 'Save order' : 'Submit order'}</button>
          <button type="button" className="back-button" onClick={() => { if (window.confirm('Discard unsaved order changes?')) { setMode('list'); setError('') } }}><X size={16} /> Cancel</button>
        </div>
      </fieldset>
    </form>}
    {mode === 'list' && <>
      <section className="metrics"><div><span>Orders</span><strong>{orders.length}</strong></div><div><span>Average order</span><strong>{currency(orders.length ? orders.reduce((sum, order) => sum + order.totalAmount, 0) / orders.length : 0)}</strong></div><div><span>Total amount</span><strong>{currency(orders.reduce((sum, order) => sum + order.totalAmount, 0))}</strong></div></section>
      <section className="orders-layout"><div className="panel">
        <OrderHistoryHeader mode="only" onSelectMode={next => { if (next === 'inventory') onBack() }} onNewOrder={() => { setEditingId(undefined); setLines([emptyOnlyOrderLine()]); setError(''); setMode('edit') }} />
        {orders.length ? <div className="orders-table">
          <div className="orders-table-header"><span>Order number</span><span>Amount</span></div>
          {orders.map(order => <OrderRow key={order.id} order={order} selectionMode={false} selected={false} onOpen={() => { setSelectedId(order.id); setMode('detail') }} onSelect={id => { setSelectedId(id); setMode('detail') }} />)}
        </div> : <p className="muted">No orders yet.</p>}
      </div></section>
    </>}
    {mode === 'detail' && selected && <>
      <p>{new Date(selected.soldAt).toLocaleString()}</p>
      <section className="panel order-detail-items">
        <div className="order-detail-header"><span>Product / Volume</span><span>Qty</span><span>Price</span><span>Total</span></div>
        {selected.items.map(item => <div className="order-detail-row" key={item.id}>
          <span><strong>{item.productName}</strong><small>{item.volume}</small></span>
          <span>{item.quantity}</span><span>{item.price.toFixed(2)}</span><strong>{item.total.toFixed(2)}</strong>
        </div>)}
      </section>
      <p className="only-order-summary"><strong>Order total: {currency(selected.totalAmount)}</strong></p>
      <OrderReceipt key={selected.id + selected.updatedAt} order={selected} items={onlyOrderReceiptItems(selected)} />
    </>}
  </section>
}