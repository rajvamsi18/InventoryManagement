import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Check, Clipboard, Pencil, Plus, Trash2, X } from 'lucide-react'
import { inventoryDb, type OnlyOrder, type OnlyOrderSourceMessage } from '../services/database'
import { appendReadListDrafts, deleteOnlyOrders, draftsFromReadList, emptyOnlyOrderLine, hasDuplicateReadListMessage, onlyOrderNumber, onlyOrderReceiptItems, removeReadListDrafts, replaceReadListDrafts, saveOnlyOrder, updateOnlyOrderLine, type OnlyOrderDraft } from '../services/onlyOrders'
import { readWhatsAppList } from '../services/readWhatsAppList'
import { OrderReceipt } from './OrderReceipt'
import { OrderHistoryHeader } from './OrderHistoryHeader'
import { OrderHistoryPagination } from './OrderHistoryPagination'
import { OrderHistorySearch } from './OrderHistorySearch'
import { matchesOrderSearch } from '../services/orderSearch'
import { OrderRow } from './OrderRow'
import { MobileOnlyOrderEditor } from './MobileOnlyOrderEditor'

type Props = { onBack: () => void; onSelectCredit: () => void; sharedMessage?: string; onSharedMessageConsumed?: () => void; openChooser?: boolean; onChooserOpened?: () => void }
const currency = (amount: number) => `Rs. ${amount.toFixed(2)}`
const mobileQuery = '(max-width: 700px)'
type HistoryRangePreset = 'all' | 'today' | 'week' | 'month' | 'custom'

function dateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function subscribeMobile(callback: () => void) {
  const media = window.matchMedia(mobileQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

export function OnlyOrdersPage({ onBack, onSelectCredit, sharedMessage, onSharedMessageConsumed, openChooser = false, onChooserOpened }: Props) {
  const isMobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia(mobileQuery).matches, () => false)
  const orders = useLiveQuery(async () => (await inventoryDb.onlyOrders.orderBy('soldAt').reverse().toArray()).map(order => ({ ...order, orderNumber: onlyOrderNumber(order.orderNumber) })), []) ?? []
  const [mode, setMode] = useState<'list' | 'edit' | 'detail'>('list')
  const [customerName, setCustomerName] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [orderSearch, setOrderSearch] = useState('')
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')
  const [historyRangePreset, setHistoryRangePreset] = useState<HistoryRangePreset>('all')
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState<5 | 10 | 20>(5)
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
  const [sourceMessages, setSourceMessages] = useState<OnlyOrderSourceMessage[]>([])
  const [appendToDraft, setAppendToDraft] = useState(false)
  const [editingSourceMessageId, setEditingSourceMessageId] = useState<string>()
  const readListDialogRef = useRef<HTMLDialogElement>(null)
  const selected = orders.find(order => order.id === selectedId)
  const selectedOrders = orders.filter(order => selectedOrderIds.includes(order.id))
  const dateFilteredOrders = orders.filter(order => {
    const soldDate = dateInputValue(new Date(order.soldAt))
    return (!historyDateFrom || soldDate >= historyDateFrom) && (!historyDateTo || soldDate <= historyDateTo)
  })
  const filteredOrders = dateFilteredOrders.filter(order => matchesOrderSearch(order, orderSearch))
  const dateRangeTotal = dateFilteredOrders.reduce((sum, order) => sum + order.totalAmount, 0)
  const customerTotals = new Map<string, { name: string; total: number }>()
  for (const order of dateFilteredOrders) {
    const name = order.customerName?.trim()
    if (!name) continue
    const key = name.toLocaleLowerCase()
    const current = customerTotals.get(key)
    customerTotals.set(key, { name: current?.name ?? name, total: (current?.total ?? 0) + order.totalAmount })
  }
  const topCustomer = [...customerTotals.values()].reduce<{ name: string; total: number } | undefined>(
    (top, customer) => !top || customer.total > top.total ? customer : top,
    undefined,
  )
  const historyPageCount = Math.max(1, Math.ceil(filteredOrders.length / historyPageSize))
  const visibleHistoryPage = Math.min(historyPage, historyPageCount)
  const visibleOrders = filteredOrders.slice((visibleHistoryPage - 1) * historyPageSize, visibleHistoryPage * historyPageSize)
  const nextOrderNumber = `OR ${orders.reduce((highest, order) => Math.max(highest, Number(order.orderNumber.match(/(\d+)$/)?.[1] ?? 0)), 0) + 1}`
  const total = lines.reduce((sum, line) => sum + (Number(line.total) || 0), 0)

  function applyHistoryRange(preset: Exclude<HistoryRangePreset, 'custom'>) {
    if (preset === 'all') {
      setHistoryDateFrom('')
      setHistoryDateTo('')
    } else {
      const end = new Date()
      const start = new Date(end)
      if (preset === 'week') start.setDate(start.getDate() - 6)
      if (preset === 'month') {
        const monthStart = new Date(end.getFullYear(), end.getMonth() - 1, 1)
        const monthEndDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()
        start.setFullYear(monthStart.getFullYear(), monthStart.getMonth(), Math.min(end.getDate(), monthEndDay))
      }
      setHistoryDateFrom(dateInputValue(start))
      setHistoryDateTo(dateInputValue(end))
    }
    setHistoryRangePreset(preset)
    setHistoryPage(1)
    setSelectedOrderIds([])
  }

  function updateHistoryDateRange(field: 'from' | 'to', value: string) {
    let from = historyDateFrom
    let to = historyDateTo
    if (field === 'from') {
      from = value
      if (from && to && from > to) to = from
      setHistoryDateFrom(from)
      setHistoryDateTo(to)
    } else {
      to = value
      if (from && to && to < from) from = to
      setHistoryDateFrom(from)
      setHistoryDateTo(to)
    }
    setHistoryRangePreset(from || to ? 'custom' : 'all')
    setHistoryPage(1)
    setSelectedOrderIds([])
  }

  useEffect(() => {
    const dialog = readListDialogRef.current
    if (readListOpen && !dialog?.open) dialog?.showModal()
    else if (!readListOpen && dialog?.open) dialog.close()
  }, [readListOpen])

  function edit(order: OnlyOrder) {
    setSelectedOrderIds([])
    setSourceMessages(order.sourceMessages ?? [])
    setCustomerName(order.customerName ?? '')
    setEditingId(order.id)
    setLines(order.items.map(item => ({ id: item.id, productName: item.productName, volume: item.volume, quantity: String(item.quantity), price: String(item.price), total: String(item.total), quantityAssumed: item.quantityAssumed, sourceMessageId: item.sourceMessageId })))
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
      const order = await saveOnlyOrder(inventoryDb, drafts, editingId, sourceMessages, customerName)
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

  function openReadList(append = false, sourceMessage?: OnlyOrderSourceMessage) {
    setReadListText(sourceMessage?.text ?? '')
    setReadListError('')
    setAppendToDraft(append)
    setEditingSourceMessageId(sourceMessage?.id)
    setReadListOpen(true)
  }

  function closeReadList() {
    setReadListOpen(false)
    setAppendToDraft(false)
    setEditingSourceMessageId(undefined)
    onSharedMessageConsumed?.()
  }

  function deleteSourceMessage(message: OnlyOrderSourceMessage) {
    if (!window.confirm('Delete this message and the product lines extracted from it?')) return
    const remainingLines = removeReadListDrafts(lines, message.id)
    if (!remainingLines.some(line => line.productName.trim())) {
      setError('Keep at least one product in the order. To remove the entire order, cancel and delete it from All Orders.')
      return
    }
    setLines(remainingLines)
    setSourceMessages(current => current.filter(item => item.id !== message.id))
    setError('')
  }

  async function submitReadList(event: React.FormEvent) {
    event.preventDefault()
    if (readingList) return
    if (hasDuplicateReadListMessage(sourceMessages, readListText, editingSourceMessageId) &&
      !window.confirm('This message is already in this order. Extract and add it again?')) return
    setReadingList(true)
    setReadListError('')
    try {
      const items = await readWhatsAppList(readListText)
      const message = readListText.trim()
      const sourceMessageId = editingSourceMessageId ?? crypto.randomUUID()
      const sourceRecord = { id: sourceMessageId, text: message }
      if (editingSourceMessageId) {
        setLines(current => replaceReadListDrafts(current, sourceMessageId, items))
        setSourceMessages(current => current.map(item => item.id === sourceMessageId ? sourceRecord : item))
      } else if (appendToDraft) {
        setLines(current => appendReadListDrafts(current, items, sourceMessageId))
        setSourceMessages(current => [...current, sourceRecord])
      } else {
        setLines(draftsFromReadList(items, sourceMessageId))
        setSourceMessages([sourceRecord])
        setEditingId(undefined)
        setSelectedOrderIds([])
      }
      setError('')
      setMode('edit')
      closeReadList()
    } catch (error) {
      setReadListError(error instanceof Error ? error.message : 'Could not read this message. Please try again.')
    } finally { setReadingList(false) }
  }

  return <section className="only-orders-page">
    <header className={`page-heading ${mode === 'detail' ? 'only-order-detail-heading' : mode === 'edit' ? 'only-order-edit-heading' : ''}`}>
      <div>
        {mode !== 'list' && <button type="button" className="back-button" disabled={saving} onClick={() => {
          if (mode !== 'edit' || window.confirm('Discard unsaved order changes?')) { setMode('list'); setError('') }
        }}><ArrowLeft size={16} /> Orders</button>}
        <h1 className={mode === 'edit' || mode === 'detail' ? 'order-number-heading' : undefined}>{mode === 'edit' ? orders.find(order => order.id === editingId)?.orderNumber ?? nextOrderNumber : selected && mode === 'detail' ? selected.orderNumber : 'Orders'}{mode === 'edit' && customerName.trim() && <span className="customer-name-highlight">Customer: {customerName.trim()}</span>}{mode === 'detail' && selected?.customerName?.trim() && <span className="customer-name-highlight">Customer: {selected.customerName.trim()}</span>}</h1>
      </div>
      {selected && mode === 'detail' && <div className="only-order-detail-actions">
        <button type="button" className="primary-button" disabled={deleting} onClick={() => edit(selected)}><Pencil size={15} /> Edit order</button>
        <button type="button" className="icon-button" title="Delete order" aria-label="Delete order" disabled={deleting} onClick={() => void remove(selected)}><Trash2 size={17} /></button>
      </div>}
    </header>
    {mode === 'edit' && <div className="order-customer-input only-order-customer-input"><label htmlFor="only-order-customer-name">Customer name (optional)</label><input id="only-order-customer-name" maxLength={120} value={customerName} onChange={event => setCustomerName(event.target.value)} disabled={saving} /></div>}
    <dialog ref={readListDialogRef} className="read-list-dialog" aria-labelledby="read-list-title" onCancel={closeReadList} onClose={closeReadList}>
      <form onSubmit={event => void submitReadList(event)}>
        <header><div><p className="eyebrow">Only Order</p><h2 id="read-list-title">{editingSourceMessageId ? 'Edit source message' : appendToDraft ? 'Add message to order' : 'Read WhatsApp list'}</h2></div>
          <button type="button" className="icon-button" title="Close Read List" aria-label="Close Read List" disabled={readingList} onClick={closeReadList}><X size={20} /></button>
        </header>
        <div className="read-list-content">
          <p className="read-list-privacy">The message is sent to AI to extract order items. It is not saved as an order until you submit.</p>
          <label>WhatsApp message<textarea required maxLength={10000} rows={8} value={readListText} onChange={event => setReadListText(event.target.value)} /></label>
          <button type="button" className="read-list-paste" onClick={() => void pasteFromClipboard()} disabled={readingList}><Clipboard size={16} /> Paste copied message</button>
          {readListError && <p role="alert" className="voice-error">{readListError}</p>}
        </div>
        <footer><button type="button" className="back-button" disabled={readingList} onClick={closeReadList}>Cancel</button>
          <button type="submit" className="save-button" disabled={readingList || !readListText.trim()}><Check size={17} /> {readingList ? 'Reading list...' : editingSourceMessageId ? 'Update products' : appendToDraft ? 'Add to order' : 'Read list'}</button>
        </footer>
      </form>
    </dialog>
    {error && <p role="alert" className="voice-error">{error}</p>}
    {mode === 'edit' && sourceMessages.length > 0 && <details className="only-order-source">
      <summary>Compare with original WhatsApp message{sourceMessages.length > 1 ? `s (${sourceMessages.length})` : ''}</summary>
      <p className="only-order-source-note">Source changes are saved when you save this order.</p>
      {sourceMessages.map((message, index) => <div className="only-order-source-message" key={message.id}>
        <pre>{sourceMessages.length > 1 ? `Message ${index + 1}\n${message.text}` : message.text}</pre>
        <div className="only-order-source-actions">
          <button type="button" className="read-list-button" disabled={saving} onClick={() => openReadList(false, message)}><Pencil size={14} /> Edit message</button>
          <button type="button" className="delete-source-message" disabled={saving} onClick={() => deleteSourceMessage(message)}><Trash2 size={14} /> Delete message</button>
        </div>
      </div>)}
    </details>}
    {mode === 'edit' && <div className="only-order-import-action"><button type="button" className="read-list-button" disabled={saving} onClick={() => openReadList(true)}><Plus size={16} /> Add another message</button></div>}
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
      <section className="orders-layout"><div className={`panel ${historyOpen ? 'order-history-panel' : ''}`}>
        <OrderHistoryHeader
          mode="only"
          view={historyOpen ? 'history' : 'orders'}
          onBackToOrders={() => { setHistoryOpen(false); setOrderSearch(''); setHistoryPage(1); setSelectedOrderIds([]) }}
          onSelectMode={next => { if (next === 'inventory' && !deleting) onBack(); else if (next === 'credit' && !deleting) onSelectCredit() }}
          onAllOrders={() => { setHistoryOpen(true); setHistoryPage(1); setOrderSearch(''); setSelectedOrderIds([]) }}
          onReadList={() => openReadList()}
          onNewOrder={() => { if (deleting) return; setSelectedOrderIds([]); setEditingId(undefined); setSourceMessages([]); setLines([emptyOnlyOrderLine()]); setCustomerName(''); setError(''); setMode('edit') }}
          openChooser={openChooser}
          onChooserOpened={onChooserOpened}
        />
        {historyOpen && <>
        <section className="order-history-date-range" aria-label="Filter order history by date">
          <div className="order-history-range-presets" role="group" aria-label="Quick date ranges">
            <button type="button" aria-pressed={historyRangePreset === 'today'} onClick={() => applyHistoryRange('today')}>Today</button>
            <button type="button" aria-pressed={historyRangePreset === 'week'} onClick={() => applyHistoryRange('week')}>Last 7 days</button>
            <button type="button" aria-pressed={historyRangePreset === 'month'} onClick={() => applyHistoryRange('month')}>Last month</button>
            <button type="button" aria-pressed={historyRangePreset === 'all'} onClick={() => applyHistoryRange('all')}>All dates</button>
          </div>
          <div className="order-history-range-inputs">
            <label>From<input type="date" value={historyDateFrom} max={historyDateTo || undefined} onChange={event => updateHistoryDateRange('from', event.target.value)} /></label>
            <label>To<input type="date" value={historyDateTo} min={historyDateFrom || undefined} onChange={event => updateHistoryDateRange('to', event.target.value)} /></label>
          </div>
        </section>
        <section className="metrics order-history-metrics">
          <div><span>Orders</span><strong>{dateFilteredOrders.length}</strong></div>
          <div><span>Average order</span><strong>{(dateFilteredOrders.length ? dateRangeTotal / dateFilteredOrders.length : 0).toFixed(2)}</strong></div>
          <div><span>Total amount</span><strong>{dateRangeTotal.toFixed(2)}</strong></div>
          <div><span>Top Customer</span><strong className="metric-text">{topCustomer?.name ?? '—'}</strong>{topCustomer && <small>{topCustomer.total.toFixed(2)}</small>}</div>
        </section>
        <OrderHistorySearch value={orderSearch} onChange={value => { setOrderSearch(value); setHistoryPage(1); setSelectedOrderIds([]) }} />
        {!selectedOrders.length && filteredOrders.length > 0 && <p className="selection-hint">Tap an order for details · Long press to select</p>}
        {filteredOrders.length ? <div className={`orders-table ${selectedOrders.length ? 'selection-mode' : ''}`}>
          <div className="orders-table-header">
            {selectedOrders.length > 0 && <input type="checkbox" aria-label="Select all orders on this page" disabled={deleting} checked={visibleOrders.length > 0 && visibleOrders.every(order => selectedOrderIds.includes(order.id))} onChange={event => setSelectedOrderIds(event.target.checked ? [...new Set([...selectedOrderIds, ...visibleOrders.map(order => order.id)])] : selectedOrderIds.filter(id => !visibleOrders.some(order => order.id === id)))} />}
            <span>Order number</span><span>Amount</span>
          </div>
          {visibleOrders.map(order => <OrderRow key={order.id} order={order} selectionMode={selectedOrders.length > 0} selected={selectedOrderIds.includes(order.id)} onOpen={() => { if (!deleting) { setSelectedId(order.id); setMode('detail') } }} onSelect={toggleOrderSelection} />)}
          {selectedOrders.length > 0 && <div className="selected-order-actions">
            <span>{selectedOrders.length} order{selectedOrders.length === 1 ? '' : 's'} selected</span>
            <div>
              {selectedOrders.length === 1 && <button type="button" className="edit-selected-order" disabled={deleting} onClick={() => edit(selectedOrders[0])}><Pencil size={15} /> Edit</button>}
              <button type="button" className="delete-selected-orders" disabled={deleting} onClick={() => void removeSelected()}><Trash2 size={15} /> {deleting ? 'Deleting...' : 'Delete'}</button>
              <button type="button" className="icon-button" title="Clear selection" aria-label="Clear selection" disabled={deleting} onClick={() => setSelectedOrderIds([])}><X size={16} /></button>
            </div>
          </div>}
        </div> : <p className="muted">{!orders.length ? 'No orders yet.' : !dateFilteredOrders.length ? 'No orders in this date range.' : 'No orders match your search.'}</p>}
        {filteredOrders.length > 0 && <OrderHistoryPagination page={visibleHistoryPage} pageSize={historyPageSize} total={filteredOrders.length} onPageChange={setHistoryPage} onPageSizeChange={pageSize => { setHistoryPageSize(pageSize); setHistoryPage(1) }} />}
        </>}
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