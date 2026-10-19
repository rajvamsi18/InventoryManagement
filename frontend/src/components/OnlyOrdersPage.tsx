import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Check, Clipboard, Pencil, Plus, Trash2, X } from 'lucide-react'
import { inventoryDb, type OnlyOrder } from '../services/database'
import { deleteOnlyOrders, draftsFromReadList, emptyOnlyOrderLine, onlyOrderNumber, onlyOrderReceiptItems, saveOnlyOrder, updateOnlyOrderLine, type OnlyOrderDraft } from '../services/onlyOrders'
import { readWhatsAppList } from '../services/readWhatsAppList'
import { OrderReceipt } from './OrderReceipt'
import { OrderHistoryHeader } from './OrderHistoryHeader'
import { OrderRow } from './OrderRow'
import { MobileOnlyOrderEditor } from './MobileOnlyOrderEditor'

type Props = { onBack: () => void; sharedMessage?: string; onSharedMessageConsumed?: () => void }
const currency = (amount: number) => `Rs. ${amount.toFixed(2)}`
const mobileQuery = '(max-width: 700px)'
function subscribeMobile(callback: () => void) {
  const media = window.matchMedia(mobileQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

export function OnlyOrdersPage({ onBack, sharedMessage, onSharedMessageConsumed }: Props) {
  const isMobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia(mobileQuery).matches, () => false)
  const orders = useLiveQuery(async () => (await inventoryDb.onlyOrders.orderBy('soldAt').reverse().toArray()).map(order => ({ ...order, orderNumber: onlyOrderNumber(order.orderNumber) })), []) ?? []
  const [mode, setMode] = useState<'list' | 'edit' | 'detail'>('list')
  const [selectedId, setSelectedId] = useState<string>()
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [editingId, setEditingId] = useState<string>()
  const [lines, setLines] = useState<OnlyOrderDraft[]>(() => [emptyOnlyOrderLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [readListOpen, setReadListOpen] = useState(() => Boolean(sharedMessage))
  const [readListText, setReadListText] = useState(() => sharedMessage ?? '')
  const [readingList, setReadingList] = useState(false)
  const [readListError, setReadListError] = useState('')
  const [sourceMessage, setSourceMessage] = useState('')
  const readListDialogRef = useRef<HTMLDialogElement>(null)
  const selected = orders.find(order => order.id === selectedId)
  const selectedOrders = orders.filter(order => selectedOrderIds.includes(order.id))
  const total = lines.reduce((sum, line) => sum + (Number(line.total) || 0), 0)

  useEffect(() => {
    const dialog = readListDialogRef.current
    if (readListOpen && !dialog?.open) dialog?.showModal()
    else if (!readListOpen && dialog?.open) dialog.close()
  }, [readListOpen])

  function edit(order: OnlyOrder) {
    setSelectedOrderIds([])
    setSourceMessage('')
    setEditingId(order.id)
    setLines(order.items.map(item => ({ id: item.id, productName: item.productName, volume: item.volume, quantity: String(item.quantity), price: String(item.price), total: String(item.total) })))
    setError('')
    setMode('edit')
  }

  async function remove(order: OnlyOrder) {
    if (deleting) return
    if (!window.confirm(`Delete ${order.orderNumber}?`)) return
    setDeleting(true)
    try {
      await deleteOnlyOrders(inventoryDb, [order.id])
      if (selectedId === order.id) { setSelectedId(undefined); setMode('list') }
    } catch { setError('Could not delete the order. Please try again.') }
    finally { setDeleting(false) }
  }

  function toggleOrderSelection(id: string) {
    if (deleting) return
    setSelectedOrderIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  async function removeSelected() {
    if (deleting || !selectedOrders.length) return
    if (!window.confirm(`Delete ${selectedOrders.length} selected order${selectedOrders.length === 1 ? '' : 's'}?`)) return
    setDeleting(true)
    setError('')
    try {
      await deleteOnlyOrders(inventoryDb, selectedOrders.map(order => order.id))
      setSelectedOrderIds([])
    } catch { setError('Could not delete the selected orders. Please try again.') }
    finally { setDeleting(false) }
  }

  function change(id: string, field: keyof OnlyOrderDraft, value: string) {
    setLines(current => current.map(line => line.id === id ? updateOnlyOrderLine(line, field, value) : line))
    setError('')
  }

  async function submit(event: React.FormEvent, drafts = lines) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const order = await saveOnlyOrder(inventoryDb, drafts, editingId)
      setSelectedId(order.id)
      setEditingId(undefined)
      setMode('detail')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save the order.')
    } finally { setSaving(false) }
  }

  async function pasteFromClipboard() {
    try {
      if (!navigator.clipboard?.readText) throw new Error()
      const text = await navigator.clipboard.readText()
      if (!text.trim()) { setReadListError('The clipboard is empty.'); return }
      setReadListText(text)
      setReadListError('')
    } catch {
      setReadListError('Clipboard access is unavailable. Paste the message into the box instead.')
    }
  }

  function closeReadList() {
    setReadListOpen(false)
    onSharedMessageConsumed?.()
  }

  async function submitReadList(event: React.FormEvent) {
    event.preventDefault()
    if (readingList) return
    setReadingList(true)
    setReadListError('')
    try {
      const items = await readWhatsAppList(readListText)
      setLines(draftsFromReadList(items))
      setSourceMessage(readListText.trim())
      setEditingId(undefined)
      setSelectedOrderIds([])
      setError('')
      setMode('edit')
      closeReadList()
    } catch (error) {
      setReadListError(error instanceof Error ? error.message : 'Could not read this message. Please try again.')
    } finally { setReadingList(false) }
  }

  return <section className="only-orders-page">
    <header className={`page-heading ${mode === 'detail' ? 'only-order-detail-heading' : ''}`}>
      <div>
        {mode !== 'list' && <button type="button" className="back-button" disabled={saving} onClick={() => {
          if (mode !== 'edit' || window.confirm('Discard unsaved order changes?')) { setMode('list'); setError('') }
        }}><ArrowLeft size={16} /> Back to Only Order</button>}
        <p className="eyebrow">{mode === 'list' ? 'Point of sale' : 'Only Order'}</p>
        <h1>{mode === 'edit' ? editingId ? 'Edit order' : 'New order' : selected && mode === 'detail' ? selected.orderNumber : 'Orders'}</h1>
      </div>
      {selected && mode === 'detail' && <div className="only-order-detail-actions">
        <button type="button" className="primary-button" disabled={deleting} onClick={() => edit(selected)}><Pencil size={15} /> Edit order</button>
        <button type="button" className="icon-button" title="Delete order" aria-label="Delete order" disabled={deleting} onClick={() => void remove(selected)}><Trash2 size={17} /></button>
      </div>}
    </header>
    <dialog ref={readListDialogRef} className="read-list-dialog" aria-labelledby="read-list-title" onCancel={closeReadList} onClose={closeReadList}>
      <form onSubmit={event => void submitReadList(event)}>
        <header><div><p className="eyebrow">Only Order</p><h2 id="read-list-title">Read WhatsApp list</h2></div>
          <button type="button" className="icon-button" title="Close Read List" aria-label="Close Read List" disabled={readingList} onClick={closeReadList}><X size={20} /></button>
        </header>
        <div className="read-list-content">
          <p className="read-list-privacy">The message is sent to AI to extract order items. It is not saved as an order until you submit.</p>
          <label>WhatsApp message<textarea required maxLength={10000} rows={8} value={readListText} onChange={event => setReadListText(event.target.value)} /></label>
          <button type="button" className="read-list-paste" onClick={() => void pasteFromClipboard()} disabled={readingList}><Clipboard size={16} /> Paste copied message</button>
          {readListError && <p role="alert" className="voice-error">{readListError}</p>}
        </div>
        <footer><button type="button" className="back-button" disabled={readingList} onClick={closeReadList}>Cancel</button>
          <button type="submit" className="save-button" disabled={readingList || !readListText.trim()}><Check size={17} /> {readingList ? 'Reading list...' : 'Read list'}</button>
        </footer>
      </form>
    </dialog>
    {error && <p role="alert" className="voice-error">{error}</p>}
    {mode === 'edit' && sourceMessage && <details className="only-order-source">
      <summary>Compare with original WhatsApp message</summary>
      <pre>{sourceMessage}</pre>
    </details>}
    {mode === 'edit' && (isMobile ? <MobileOnlyOrderEditor lines={lines} onChange={setLines} onSubmit={(event, drafts) => void submit(event, drafts)} saving={saving} editing={Boolean(editingId)} onCancel={() => { if (window.confirm('Discard unsaved order changes?')) { setMode('list'); setError('') } }} /> : <form onSubmit={event => void submit(event)} className="only-order-form">
      <fieldset disabled={saving}>
        {lines.map((line, index) => <div className="only-order-line" key={line.id}>
          <label>Product<input aria-label={`Product ${index + 1}`} required maxLength={200} value={line.productName} onChange={event => change(line.id, 'productName', event.target.value)} /></label>
          <label>Volume (optional)<input aria-label={`Volume ${index + 1}`} maxLength={100} value={line.volume} onChange={event => change(line.id, 'volume', event.target.value)} /></label>
          <label>Quantity<input aria-label={`Quantity ${index + 1}`} required type="number" inputMode="decimal" min="0" step="any" value={line.quantity} onChange={event => change(line.id, 'quantity', event.target.value)} />{line.quantityAssumed && <small className="quantity-assumed">AI assumed 1 · review</small>}</label>
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
    </form>)}
    {mode === 'list' && <>
      <section className="metrics"><div><span>Orders</span><strong>{orders.length}</strong></div><div><span>Average order</span><strong>{currency(orders.length ? orders.reduce((sum, order) => sum + order.totalAmount, 0) / orders.length : 0)}</strong></div><div><span>Total amount</span><strong>{currency(orders.reduce((sum, order) => sum + order.totalAmount, 0))}</strong></div></section>
      <section className="orders-layout"><div className="panel">
        <OrderHistoryHeader mode="only" onSelectMode={next => { if (next === 'inventory' && !deleting) onBack() }} onReadList={() => { setReadListText(''); setReadListError(''); setReadListOpen(true) }} onNewOrder={() => { if (deleting) return; setSelectedOrderIds([]); setEditingId(undefined); setSourceMessage(''); setLines([emptyOnlyOrderLine()]); setError(''); setMode('edit') }} />
        {!selectedOrders.length && orders.length > 0 && <p className="selection-hint">Tap an order for details · Long press to select</p>}
        {orders.length ? <div className={`orders-table ${selectedOrders.length ? 'selection-mode' : ''}`}>
          <div className="orders-table-header">
            {selectedOrders.length > 0 && <input type="checkbox" aria-label="Select all orders" disabled={deleting} checked={selectedOrders.length === orders.length} onChange={event => setSelectedOrderIds(event.target.checked ? orders.map(order => order.id) : [])} />}
            <span>Order number</span><span>Amount</span>
          </div>
          {orders.map(order => <OrderRow key={order.id} order={order} selectionMode={selectedOrders.length > 0} selected={selectedOrderIds.includes(order.id)} onOpen={() => { if (!deleting) { setSelectedId(order.id); setMode('detail') } }} onSelect={toggleOrderSelection} />)}
          {selectedOrders.length > 0 && <div className="selected-order-actions">
            <span>{selectedOrders.length} order{selectedOrders.length === 1 ? '' : 's'} selected</span>
            <div>
              {selectedOrders.length === 1 && <button type="button" className="edit-selected-order" disabled={deleting} onClick={() => edit(selectedOrders[0])}><Pencil size={15} /> Edit</button>}
              <button type="button" className="delete-selected-orders" disabled={deleting} onClick={() => void removeSelected()}><Trash2 size={15} /> {deleting ? 'Deleting...' : 'Delete'}</button>
              <button type="button" className="icon-button" title="Clear selection" aria-label="Clear selection" disabled={deleting} onClick={() => setSelectedOrderIds([])}><X size={16} /></button>
            </div>
          </div>}
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