import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Check, Clipboard, ClipboardList, CreditCard, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { inventoryDb, type CreditAdjustment, type CreditOrder, type CreditPayment, type CreditPaymentMethod, type Customer, type OnlyOrderSourceMessage } from '../services/database'
import { archiveCustomer, calculateCreditBalance, createCreditOrder, createCustomer, recordCreditPayment, replaceCreditOrder, replaceCreditPayment, restoreCustomer, updateCustomer, voidCreditEntries } from '../services/creditOrders'
import { appendReadListDrafts, draftsFromReadList, emptyOnlyOrderLine, hasDuplicateReadListMessage, removeReadListDrafts, replaceReadListDrafts, updateOnlyOrderLine, type OnlyOrderDraft } from '../services/onlyOrders'
import { readWhatsAppList } from '../services/readWhatsAppList'
import { OrderHistoryHeader } from './OrderHistoryHeader'
import { OrderHistoryPagination } from './OrderHistoryPagination'
import { MobileOnlyOrderEditor } from './MobileOnlyOrderEditor'

type Props = { onSelectMode: (mode: 'inventory' | 'only' | 'credit') => void }
type CreditPage = 'home' | 'customers' | 'choose-customer' | 'customer-form' | 'order-method' | 'read-list' | 'new-order' | 'account' | 'payment'
type CustomerFormPurpose = 'account' | 'order'
type CreditOrderEntryMode = 'list' | 'manual'
type CreditActivity =
  | { kind: 'order'; id: string; date: string; order: CreditOrder; voided?: CreditAdjustment }
  | { kind: 'payment'; id: string; date: string; payment: CreditPayment; voided?: CreditAdjustment }

const currency = (amount: number) => `Rs. ${amount.toFixed(2)}`
const mobileQuery = '(max-width: 700px)'

function dateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function displayDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function isMobile(): boolean {
  return window.matchMedia(mobileQuery).matches
}

function subscribeViewport(callback: () => void) {
  const media = window.matchMedia(mobileQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

export function CreditOrdersPage({ onSelectMode }: Props) {
  const compact = useSyncExternalStore(subscribeViewport, isMobile, () => false)
  const activityPressTimer = useRef<number | undefined>(undefined)
  const activityPressOrigin = useRef({ x: 0, y: 0 })
  const longPressedActivity = useRef(false)
  const customers = useLiveQuery(() => inventoryDb.customers.orderBy('name').toArray(), []) ?? []
  const orders = useLiveQuery(() => inventoryDb.creditOrders.orderBy('soldAt').reverse().toArray(), []) ?? []
  const payments = useLiveQuery(() => inventoryDb.creditPayments.orderBy('paidAt').reverse().toArray(), []) ?? []
  const adjustments = useLiveQuery(() => inventoryDb.creditAdjustments.toArray(), []) ?? []
  const [page, setPage] = useState<CreditPage>('home')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>()
  const [customerPurpose, setCustomerPurpose] = useState<CustomerFormPurpose>('account')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [customerPages, setCustomerPages] = useState({ active: 1, archived: 1 })
  const [customerPageSizes, setCustomerPageSizes] = useState<{ active: 5 | 10 | 20; archived: 5 | 10 | 20 }>({ active: 5, archived: 5 })
  const [activityPage, setActivityPage] = useState(1)
  const [activityPageSize, setActivityPageSize] = useState<5 | 10 | 20>(5)
  const [editingCustomerId, setEditingCustomerId] = useState<string>()
  const [creditOrderEntryMode, setCreditOrderEntryMode] = useState<CreditOrderEntryMode>('manual')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [drafts, setDrafts] = useState<OnlyOrderDraft[]>([emptyOnlyOrderLine()])
  const [editingCreditOrderId, setEditingCreditOrderId] = useState<string>()
  const [editingCreditPaymentId, setEditingCreditPaymentId] = useState<string>()
  const [readListText, setReadListText] = useState('')
  const [readListError, setReadListError] = useState('')
  const [readingList, setReadingList] = useState(false)
  const [readListBackPage, setReadListBackPage] = useState<'choose-customer' | 'order-method' | 'new-order'>('choose-customer')
  const [sourceMessages, setSourceMessages] = useState<OnlyOrderSourceMessage[]>([])
  const [editingSourceId, setEditingSourceId] = useState<string>()
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(() => dateInputValue(new Date()))
  const [method, setMethod] = useState<CreditPaymentMethod>('Cash')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([])
  const [voidTarget, setVoidTarget] = useState<{ entries: CreditActivity[]; reason: string }>()
  const [archiveOpen, setArchiveOpen] = useState(false)

  const selectedCustomer = customers.find(customer => customer.id === selectedCustomerId)
  const activeCustomers = customers.filter(customer => !customer.archivedAt)
  const directoryCustomers = showArchived ? customers.filter(customer => customer.archivedAt) : activeCustomers
  const filteredCustomers = directoryCustomers.filter(customer => {
    const query = customerSearch.trim().toLocaleLowerCase()
    return !query || customer.name.toLocaleLowerCase().includes(query) || customer.phone?.toLocaleLowerCase().includes(query)
  })
  const customerOrders = selectedCustomer ? orders.filter(order => order.customerId === selectedCustomer.id) : []
  const customerPayments = selectedCustomer ? payments.filter(payment => payment.customerId === selectedCustomer.id) : []
  const customerAdjustments = selectedCustomer ? adjustments.filter(adjustment => adjustment.customerId === selectedCustomer.id) : []
  const balance = selectedCustomer ? calculateCreditBalance(selectedCustomer.id, customerOrders, customerPayments, customerAdjustments) : 0
  const voidedEntries = new Map(customerAdjustments.map(adjustment => [`${adjustment.targetType}:${adjustment.targetId}`, adjustment]))
  const editingCreditPayment = editingCreditPaymentId ? customerPayments.find(payment => payment.id === editingCreditPaymentId && !voidedEntries.has(`payment:${payment.id}`)) : undefined
  const paymentAmountLimit = balance + (editingCreditPayment?.amount ?? 0)
  const activity: CreditActivity[] = [
    ...customerOrders.map(order => ({ kind: 'order' as const, id: order.id, date: order.soldAt, order, voided: voidedEntries.get(`order:${order.id}`) })),
    ...customerPayments.map(payment => ({ kind: 'payment' as const, id: payment.id, date: payment.paidAt, payment, voided: voidedEntries.get(`payment:${payment.id}`) })),
  ].filter(entry => !entry.voided).sort((first, second) => Date.parse(second.date) - Date.parse(first.date))
  const activityKey = (entry: CreditActivity) => `${entry.kind}:${entry.id}`
  const selectedActivity = activity.filter(entry => selectedActivityIds.includes(activityKey(entry)))
  const visibleActivityPage = Math.min(activityPage, Math.max(1, Math.ceil(activity.length / activityPageSize)))
  const visibleActivity = activity.slice((visibleActivityPage - 1) * activityPageSize, visibleActivityPage * activityPageSize)
  const creditOrderNumber = editingCreditOrderId
    ? orders.find(order => order.id === editingCreditOrderId)?.orderNumber ?? 'Credit Order'
    : `CR ${orders.reduce((highest, order) => Math.max(highest, Number(order.orderNumber.split(' ').at(-1)) || 0), 0) + 1}`

  useEffect(() => () => {
    if (activityPressTimer.current !== undefined) window.clearTimeout(activityPressTimer.current)
  }, [])


  function showCustomer(customer: Customer) {
    setSelectedActivityIds([])
    setActivityPage(1)
    setSelectedCustomerId(customer.id)
    setCustomerSearch('')
    setError('')
    setPage('account')
  }

  function chooseCreditCustomer(customer: Customer) {
    setSelectedCustomerId(customer.id)
    setCustomerSearch('')
    setDrafts([emptyOnlyOrderLine()])
    setSourceMessages([])
    setEditingSourceId(undefined)
    setEditingCreditOrderId(undefined)
    setPage(creditOrderEntryMode === 'list' ? 'read-list' : 'new-order')
  }

  function startCustomerForm(purpose: CustomerFormPurpose) {
    setCustomerPurpose(purpose)
    setEditingCustomerId(undefined)
    setCustomerName('')
    setCustomerPhone('')
    setError('')
    setPage('customer-form')
  }

  async function saveCustomer(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const customer = editingCustomerId
        ? await updateCustomer(inventoryDb, editingCustomerId, customerName, customerPhone)
        : await createCustomer(inventoryDb, customerName, customerPhone)
      setSelectedCustomerId(customer.id)
      setCustomerSearch('')
      if (!editingCustomerId && customerPurpose === 'order') {
        setDrafts([emptyOnlyOrderLine()])
        setSourceMessages([])
        setEditingSourceId(undefined)
        setPage(creditOrderEntryMode === 'list' ? 'read-list' : 'new-order')
      } else setPage('account')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this customer.')
    } finally { setBusy(false) }
  }

  async function saveCreditOrder(event: FormEvent, orderDrafts = drafts) {
    event.preventDefault()
    if (busy || !selectedCustomer) return
    setBusy(true)
    setError('')
    try {
      if (editingCreditOrderId) await replaceCreditOrder(inventoryDb, editingCreditOrderId, orderDrafts, sourceMessages)
      else await createCreditOrder(inventoryDb, selectedCustomer.id, orderDrafts, sourceMessages)
      setEditingCreditOrderId(undefined)
      setDrafts([emptyOnlyOrderLine()])
      setPage('account')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this credit order.')
    } finally { setBusy(false) }
  }

  async function savePayment(event: FormEvent) {
    event.preventDefault()
    if (busy || !selectedCustomer) return
    setBusy(true)
    setError('')
    try {
      const paymentInput = { customerId: selectedCustomer.id, amount: Number(amount), paidAt, method, reference }
      if (editingCreditPaymentId) await replaceCreditPayment(inventoryDb, editingCreditPaymentId, paymentInput)
      else await recordCreditPayment(inventoryDb, paymentInput)
      setEditingCreditPaymentId(undefined)
      setAmount('')
      setReference('')
      setPage('account')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not record this payment.')
    } finally { setBusy(false) }
  }

  function voidEntry(entries: CreditActivity[]) {
    if (!selectedCustomer || !entries.length || busy) return
    setError('')
    setVoidTarget({ entries, reason: '' })
  }

  async function confirmVoidEntry(event: FormEvent) {
    event.preventDefault()
    if (!selectedCustomer || !voidTarget || busy) return
    setBusy(true)
    setError('')
    try {
      await voidCreditEntries(inventoryDb, { customerId: selectedCustomer.id, entries: voidTarget.entries.map(entry => ({ targetType: entry.kind, targetId: entry.id })), reason: voidTarget.reason })
      setSelectedActivityIds([])
      setVoidTarget(undefined)
    } catch (voidError) {
      setError(voidError instanceof Error ? voidError.message : 'Could not void this entry.')
    } finally { setBusy(false) }
  }

  async function submitReadList(event: FormEvent) {
    event.preventDefault()
    if (readingList || !readListText.trim()) return
    if (hasDuplicateReadListMessage(sourceMessages, readListText, editingSourceId)) {
      setReadListError('This message is already included in the order.')
      return
    }
    setReadingList(true)
    setReadListError('')
    try {
      const lines = await readWhatsAppList(readListText.trim())
      const sourceId = editingSourceId ?? crypto.randomUUID()
      const source = { id: sourceId, text: readListText.trim() }
      if (editingSourceId) {
        setDrafts(current => replaceReadListDrafts(current, sourceId, lines))
        setSourceMessages(current => current.map(message => message.id === sourceId ? source : message))
      } else {
        setDrafts(current => readListBackPage === 'new-order' ? appendReadListDrafts(current, lines, sourceId) : draftsFromReadList(lines, sourceId))
        setSourceMessages(current => [...current, source])
      }
      setEditingSourceId(undefined)
      setPage('new-order')
    } catch (readError) {
      setReadListError(readError instanceof Error ? readError.message : 'Could not read this list. Please try again.')
    } finally { setReadingList(false) }
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

  function startOrderEdit(entry: CreditActivity) {
    if (entry.voided) return
    setSelectedActivityIds([])
    setError('')
    if (entry.kind === 'order') {
      setEditingCreditOrderId(entry.order.id)
      setDrafts(entry.order.items.map(item => ({ id: item.id, productName: item.productName, volume: item.volume, quantity: String(item.quantity), price: String(item.price), total: String(item.total), sourceMessageId: item.sourceMessageId, quantityAssumed: item.quantityAssumed })))
      setSourceMessages(entry.order.sourceMessages ?? [])
      setPage('new-order')
    } else {
      setEditingCreditPaymentId(entry.payment.id)
      setAmount(String(entry.payment.amount))
      setPaidAt(entry.payment.paidAt.slice(0, 10))
      setMethod(entry.payment.method)
      setReference(entry.payment.reference ?? '')
      setPage('payment')
    }
  }

  function startActivityPress(entry: CreditActivity) {
    if (entry.voided || busy) return
    longPressedActivity.current = false
    if (activityPressTimer.current !== undefined) window.clearTimeout(activityPressTimer.current)
    activityPressTimer.current = window.setTimeout(() => {
      longPressedActivity.current = true
      setSelectedActivityIds(current => current.includes(activityKey(entry)) ? current : [...current, activityKey(entry)])
      activityPressTimer.current = undefined
    }, 550)
  }

  function cancelActivityPress() {
    if (activityPressTimer.current !== undefined) window.clearTimeout(activityPressTimer.current)
    activityPressTimer.current = undefined
  }

  function finishActivityPress(entry: CreditActivity) {
    cancelActivityPress()
    if (longPressedActivity.current) {
      longPressedActivity.current = false
      return
    }
    if (busy) return
    if (selectedActivityIds.length) toggleActivity(entry)
    else startOrderEdit(entry)
  }

  function toggleActivity(entry: CreditActivity) {
    if (busy) return
    const key = activityKey(entry)
    setSelectedActivityIds(current => current.includes(key) ? current.filter(id => id !== key) : [...current, key])
  }

  function openOrderReadList(message?: OnlyOrderSourceMessage) {
    setReadListText(message?.text ?? '')
    setEditingSourceId(message?.id)
    setReadListError('')
    setReadListBackPage('new-order')
    setPage('read-list')
  }

  function removeSourceMessage(sourceId: string) {
    const remaining = removeReadListDrafts(drafts, sourceId)
    if (!remaining.some(line => line.productName.trim())) {
      setError('Keep at least one product. To delete the order, return to account activity.')
      return
    }
    setDrafts(remaining)
    setSourceMessages(current => current.filter(message => message.id !== sourceId))
  }

  async function archiveSelectedCustomer() {
    if (!selectedCustomer || busy) return
    setBusy(true)
    setError('')
    try {
      await archiveCustomer(inventoryDb, selectedCustomer.id)
      setArchiveOpen(false)
      setShowArchived(true)
      setSelectedCustomerId(undefined)
      setPage('customers')
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Could not archive this customer.')
    } finally { setBusy(false) }
  }

  async function restoreSelectedCustomer() {
    if (!selectedCustomer || busy) return
    setBusy(true)
    setError('')
    try {
      await restoreCustomer(inventoryDb, selectedCustomer.id)
      setShowArchived(false)
      setPage('customers')
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Could not restore this customer.')
    } finally { setBusy(false) }
  }

  function editSelectedCustomer() {
    if (!selectedCustomer || selectedCustomer.archivedAt) return
    setEditingCustomerId(selectedCustomer.id)
    setCustomerPurpose('account')
    setCustomerName(selectedCustomer.name)
    setCustomerPhone(selectedCustomer.phone ?? '')
    setError('')
    setPage('customer-form')
  }

  function changeLine(id: string, field: keyof OnlyOrderDraft, value: string) {
    setDrafts(current => current.map(line => line.id === id ? updateOnlyOrderLine(line, field, value) : line))
    setError('')
  }

  function accountList(forOrder = false) {
    const displayedCustomers = forOrder ? activeCustomers.filter(customer => {
      const query = customerSearch.trim().toLocaleLowerCase()
      return !query || customer.name.toLocaleLowerCase().includes(query) || customer.phone?.toLocaleLowerCase().includes(query)
    }) : filteredCustomers
    const customerStatus = !forOrder && showArchived ? 'archived' : 'active'
    const pageSize = customerPageSizes[customerStatus]
    const visiblePage = Math.min(customerPages[customerStatus], Math.max(1, Math.ceil(displayedCustomers.length / pageSize)))
    const visibleCustomers = displayedCustomers.slice((visiblePage - 1) * pageSize, visiblePage * pageSize)
    return <>
      <div className="credit-customer-tools">
        <label className="order-history-search"><Search size={17} /><input value={customerSearch} onChange={event => { setCustomerSearch(event.target.value); setCustomerPages({ active: 1, archived: 1 }) }} placeholder="Search customer name or phone" /></label>
        <button type="button" className="primary-button" onClick={() => startCustomerForm(forOrder ? 'order' : 'account')}><Plus size={16} /> Add customer</button>
      </div>
      {displayedCustomers.length ? <div className="credit-customer-list">{visibleCustomers.map(customer => {
        const customerBalance = calculateCreditBalance(customer.id, orders, payments, adjustments)
        return <button type="button" className="credit-customer-row" key={customer.id} onClick={() => forOrder ? chooseCreditCustomer(customer) : showCustomer(customer)}>
          <span><strong>{customer.name}</strong><small>{customer.archivedAt ? 'Archived' : customer.phone || 'Phone not set'}</small></span>
          <span><small>Balance</small><strong>{customerBalance.toFixed(2)}</strong></span>
        </button>
      })}</div> : <p className="muted">{forOrder ? activeCustomers.length ? 'No customers match your search.' : 'No active customers. Add a customer to get started.' : directoryCustomers.length ? 'No customers match your search.' : showArchived ? 'No archived customers.' : 'No customers yet. Add a customer to get started.'}</p>}
      {displayedCustomers.length > 0 && <OrderHistoryPagination page={visiblePage} pageSize={pageSize} total={displayedCustomers.length}
        itemLabel="Customers" ariaLabel={`${customerStatus === 'archived' ? 'Archived' : 'Active'} credit customer pages`}
        onPageChange={next => setCustomerPages(current => ({ ...current, [customerStatus]: next }))}
        onPageSizeChange={size => { setCustomerPageSizes(current => ({ ...current, [customerStatus]: size })); setCustomerPages(current => ({ ...current, [customerStatus]: 1 })) }} />}
    </>
  }

  function pageBack(label: string, action: () => void, title: ReactNode) {
    return <header className="credit-page-heading"><button type="button" className="back-button" onClick={action}><ArrowLeft size={16} /> {label}</button><h2>{title}</h2></header>
  }

  return <section className={`credit-orders-page${page === 'home' ? ' credit-orders-home' : ''}`}>
    {page === 'home' && <>
      <header className="page-heading"><div><h1>Orders</h1></div></header>
      <section className="orders-layout"><div className="panel">
        <OrderHistoryHeader
          mode="credit"
          onSelectMode={onSelectMode}
          onAllOrders={() => { setCustomerSearch(''); setShowArchived(false); setPage('customers') }}
          onNewOrder={() => { setCreditOrderEntryMode('manual'); setCustomerSearch(''); setPage('choose-customer') }}
          onReadList={() => { setCreditOrderEntryMode('list'); setReadListText(''); setReadListError(''); setReadListBackPage('choose-customer'); setCustomerSearch(''); setPage('choose-customer') }}
          readListLabel="With list"
          readListDescription="Read a WhatsApp order list"
        />
      </div></section>
    </>}

    {page === 'customers' && <>
      {pageBack('Orders', () => setPage('home'), 'Credit Customers')}
      {error && <p role="alert" className="voice-error">{error}</p>}
      <div className="credit-customer-status" role="group" aria-label="Customer status">
        <button type="button" aria-pressed={!showArchived} onClick={() => { setShowArchived(false); setCustomerSearch('') }}>Active</button>
        <button type="button" aria-pressed={showArchived} onClick={() => { setShowArchived(true); setCustomerSearch('') }}>Archived</button>
      </div>
      {accountList()}
    </>}

    {page === 'choose-customer' && <>
      {pageBack('Credit Order', () => setPage('home'), 'Choose Customer')}
      <p className="muted">Choose who is buying on credit, or add a new customer.</p>
      {accountList(true)}
    </>}

    {page === 'customer-form' && <>
      {pageBack('Back', () => setPage(editingCustomerId ? 'account' : customerPurpose === 'order' ? 'choose-customer' : 'customers'), editingCustomerId ? 'Edit Customer' : 'Add Customer')}
      <form className="credit-customer-form" onSubmit={event => void saveCustomer(event)}>
        <label>Customer name<input required autoFocus maxLength={120} value={customerName} onChange={event => setCustomerName(event.target.value)} /></label>
        <label>Phone (optional)<input type="tel" maxLength={40} value={customerPhone} onChange={event => setCustomerPhone(event.target.value)} /></label>
        {error && <p role="alert" className="voice-error">{error}</p>}
        <button type="submit" className="save-button" disabled={busy}><Check size={17} /> {busy ? 'Saving...' : 'Save customer'}</button>
      </form>
    </>}

    {page === 'order-method' && selectedCustomer && <>
      {pageBack('Customer account', () => setPage('account'), `Credit Order · ${selectedCustomer.name}`)}
      <div className="order-choice-options">
        <button type="button" className="order-choice-option" onClick={() => { setReadListText(''); setReadListError(''); setReadListBackPage('order-method'); setPage('read-list') }}><ClipboardList size={19} /><span><strong>With list</strong><small>Read a WhatsApp order list</small></span></button>
        <button type="button" className="order-choice-option" onClick={() => { setDrafts([emptyOnlyOrderLine()]); setEditingCreditOrderId(undefined); setPage('new-order') }}><CreditCard size={19} /><span><strong>Without list</strong><small>Enter order items manually</small></span></button>
      </div>
    </>}

    {page === 'read-list' && selectedCustomer && <>
      {pageBack('Back', () => setPage(readListBackPage), `With list · ${selectedCustomer.name}`)}
      <form className="credit-customer-form" onSubmit={event => void submitReadList(event)}>
        <label>WhatsApp message<textarea required maxLength={10000} rows={8} value={readListText} onChange={event => setReadListText(event.target.value)} /></label>
        <button type="button" className="read-list-paste" onClick={() => void pasteFromClipboard()} disabled={readingList}><Clipboard size={16} /> Paste copied message</button>
        <p className="read-list-privacy">The message is sent to Read List AI to extract draft products. No order is saved until you submit it.</p>
        {readListError && <p role="alert" className="voice-error">{readListError}</p>}
        <button type="submit" className="save-button" disabled={readingList || !readListText.trim()}><ClipboardList size={17} /> {readingList ? 'Reading list...' : 'Read list'}</button>
      </form>
    </>}

    {page === 'new-order' && selectedCustomer && <>
      {pageBack('Customer account', () => { setEditingCreditOrderId(undefined); setPage('account') }, <span className="credit-order-identity"><span className="credit-order-number">{creditOrderNumber}</span><span className="customer-name-highlight">Customer: {selectedCustomer.name}</span></span>)}
      {error && <p role="alert" className="voice-error">{error}</p>}
      {sourceMessages.length > 0 && <details className="only-order-source">
        <summary>Compare with original WhatsApp message{sourceMessages.length > 1 ? 's' : ''}</summary>
        {sourceMessages.map(message => <div className="only-order-source-message" key={message.id}>
          <pre>{message.text}</pre>
          <div className="only-order-source-actions">
            <button type="button" className="read-list-button" disabled={busy} onClick={() => openOrderReadList(message)}><Pencil size={14} /> Edit message</button>
            <button type="button" className="delete-source-message" disabled={busy} onClick={() => removeSourceMessage(message.id)}><Trash2 size={14} /> Delete message</button>
          </div>
        </div>)}
      </details>}
      <button type="button" className="read-list-button credit-add-message" disabled={busy} onClick={() => openOrderReadList()}><Plus size={16} /> {sourceMessages.length ? 'Add another message' : 'With list · Add message'}</button>
      {compact ? <MobileOnlyOrderEditor lines={drafts} onChange={setDrafts} onSubmit={(event, values) => void saveCreditOrder(event, values)} saving={busy} editing={Boolean(editingCreditOrderId)} onCancel={() => { setEditingCreditOrderId(undefined); setDrafts([emptyOnlyOrderLine()]); setPage('account') }} /> : <form className="credit-order-form" onSubmit={event => void saveCreditOrder(event)}>
        {drafts.map((line, index) => <fieldset className="credit-order-line" key={line.id} disabled={busy}>
          <legend>Product {index + 1}</legend>
          <label>Product<input required maxLength={200} value={line.productName} onChange={event => changeLine(line.id, 'productName', event.target.value)} /></label>
          <label>Volume (optional)<input maxLength={100} value={line.volume} onChange={event => changeLine(line.id, 'volume', event.target.value)} /></label>
          <label>Quantity<input required type="number" min="0" step="any" value={line.quantity} onChange={event => changeLine(line.id, 'quantity', event.target.value)} /></label>
          <label>Price<input required type="number" min="0" step="any" value={line.price} onChange={event => changeLine(line.id, 'price', event.target.value)} /></label>
          <label>Total<input required type="number" min="0" step="0.01" value={line.total} onChange={event => changeLine(line.id, 'total', event.target.value)} /></label>
          <button type="button" className="icon-button" title="Remove product" aria-label={`Remove product ${index + 1}`} onClick={() => setDrafts(current => current.filter(item => item.id !== line.id))}><Trash2 size={17} /></button>
        </fieldset>)}
        <div className="credit-form-actions"><button type="button" className="back-button" onClick={() => setDrafts(current => [...current, emptyOnlyOrderLine()])}><Plus size={16} /> Add product</button><button type="button" className="back-button" onClick={() => { setEditingCreditOrderId(undefined); setPage('account') }}>Cancel</button><button type="submit" className="save-button" disabled={busy}>{busy ? 'Saving...' : editingCreditOrderId ? 'Save changes' : 'Save Credit Order'}</button></div>
      </form>}
    </>}

    {page === 'account' && selectedCustomer && <>
      {pageBack('Credit Customers', () => setPage('customers'), selectedCustomer.name)}
      <section className="metrics credit-account-metrics"><div><span>Outstanding balance</span><strong>{balance.toFixed(2)}</strong></div><div><span>Credit orders</span><strong>{customerOrders.filter(order => !voidedEntriesForCustomer(customerAdjustments).has(`order:${order.id}`)).length}</strong></div></section>
      <div className="credit-account-actions">{selectedCustomer.archivedAt ? <button type="button" className="save-button" disabled={busy} onClick={() => void restoreSelectedCustomer()}><Check size={16} /> Restore customer</button> : <>
        <button type="button" className="primary-button" onClick={() => { setSourceMessages([]); setEditingSourceId(undefined); setEditingCreditOrderId(undefined); setDrafts([emptyOnlyOrderLine()]); setPage('order-method') }}><Plus size={16} /> Credit Order</button>
        <button type="button" className="save-button" disabled={balance <= 0} onClick={() => { setEditingCreditPaymentId(undefined); setAmount(''); setPaidAt(dateInputValue(new Date())); setMethod('Cash'); setReference(''); setPage('payment') }}><CreditCard size={16} /> Record Payment</button>
        <button type="button" className="back-button" disabled={busy} onClick={editSelectedCustomer}>Edit customer</button>
        <button type="button" className="back-button" disabled={busy} onClick={() => { setError(''); setArchiveOpen(true) }}>Archive customer</button>
      </>}</div>
      {!selectedCustomer.archivedAt && balance !== 0 && <small className="credit-archive-hint">Settle the outstanding balance before archiving this customer.</small>}
      {error && <p role="alert" className="voice-error">{error}</p>}
      <div className="credit-activity-heading"><h3 className="credit-section-title">Account activity</h3>
        {selectedActivity.length > 0 && <div className="credit-activity-selection-actions">
          <span>{selectedActivity.length} selected</span>
          <button type="button" className="icon-button" title="Delete selected entries" aria-label="Delete selected entries" disabled={busy} onClick={() => voidEntry(selectedActivity)}><Trash2 size={17} /></button>
          <button type="button" className="icon-button" title="Clear selection" aria-label="Clear activity selection" disabled={busy} onClick={() => setSelectedActivityIds([])}><X size={17} /></button>
        </div>}
      </div>
      {activity.length ? <div className="credit-activity-list">{visibleActivity.map(entry => {
        const description = entry.kind === 'order' ? entry.order.orderNumber : `Payment · ${entry.payment.method}`
        const amountText = entry.kind === 'order' ? `+${entry.order.totalAmount.toFixed(2)}` : `-${entry.payment.amount.toFixed(2)}`
        return <article className={`credit-activity-row ${selectedActivityIds.length ? 'selection-mode' : ''} ${selectedActivityIds.includes(activityKey(entry)) ? 'is-selected' : ''}`} key={activityKey(entry)}>
          {selectedActivityIds.length > 0 && <input type="checkbox" aria-label={`Select ${description}`} checked={selectedActivityIds.includes(activityKey(entry))} disabled={busy} onChange={() => toggleActivity(entry)} />}
          <button type="button" className="credit-activity-main" aria-label={`${description}, ${amountText}`} aria-pressed={selectedActivityIds.includes(activityKey(entry))} disabled={busy}
            onPointerDown={event => { activityPressOrigin.current = { x: event.clientX, y: event.clientY }; startActivityPress(entry) }} onPointerUp={cancelActivityPress}
            onPointerMove={event => { if (Math.hypot(event.clientX - activityPressOrigin.current.x, event.clientY - activityPressOrigin.current.y) > 10) cancelActivityPress() }} onPointerLeave={cancelActivityPress} onPointerCancel={cancelActivityPress}
            onClick={() => finishActivityPress(entry)} onContextMenu={event => { event.preventDefault(); setSelectedActivityIds(current => current.includes(activityKey(entry)) ? current : [...current, activityKey(entry)]) }}>
            <span className="credit-activity-description">
            <strong>{description}</strong><time>{displayDate(entry.date)}</time>{entry.kind === 'payment' && entry.payment.reference && <small>Ref: {entry.payment.reference}</small>}
            </span>
            <span className="credit-activity-amount"><strong>{amountText}</strong></span>
          </button>
          <button type="button" className="icon-button" title={`Delete ${description}`} aria-label={`Delete ${description}`} disabled={busy} onClick={() => voidEntry([entry])}><Trash2 size={15} /></button>
        </article>
      })}</div> : <p className="muted">No credit activity yet.</p>}
      {activity.length > 0 && <OrderHistoryPagination page={visibleActivityPage} pageSize={activityPageSize} total={activity.length}
        itemLabel="Entries" ariaLabel="Account activity pages"
        onPageChange={next => { setActivityPage(next); setSelectedActivityIds([]) }}
        onPageSizeChange={size => { setActivityPageSize(size); setActivityPage(1); setSelectedActivityIds([]) }} />}
    </>}

    {page === 'payment' && selectedCustomer && <>
      {pageBack('Customer account', () => { setEditingCreditPaymentId(undefined); setPage('account') }, <span className="credit-order-identity"><span className="credit-order-number">{editingCreditPayment?.paymentNumber ?? 'Record Payment'}</span><span className="customer-name-highlight">Customer: {selectedCustomer.name}</span></span>)}
      <div className="credit-payment-balances"><p className="credit-balance-note">Outstanding balance: <strong>{balance.toFixed(2)}</strong></p>{editingCreditPayment && <p className="credit-balance-note">Payment edit limit: <strong>{paymentAmountLimit.toFixed(2)}</strong></p>}</div>
      <form className="credit-customer-form" onSubmit={event => void savePayment(event)}>
        <label>Amount<input required type="number" inputMode="decimal" min="0.01" max={paymentAmountLimit} step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></label>
        <label>Payment date<input required type="date" value={paidAt} onChange={event => setPaidAt(event.target.value)} /></label>
        <label>Method<select value={method} onChange={event => setMethod(event.target.value as CreditPaymentMethod)}><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Other</option></select></label>
        <label>Reference (optional)<input maxLength={120} value={reference} onChange={event => setReference(event.target.value)} /></label>
        {error && <p role="alert" className="voice-error">{error}</p>}
        <div className="credit-payment-actions"><button type="button" className="back-button" disabled={busy} onClick={() => { setEditingCreditPaymentId(undefined); setPage('account') }}>Cancel</button><button type="submit" className="save-button" disabled={busy}><Check size={17} /> {busy ? 'Saving...' : editingCreditPaymentId ? 'Save changes' : 'Save Payment'}</button></div>
      </form>
    </>}

    {voidTarget && <div className="credit-dialog-backdrop">
      <section className="credit-void-dialog" role="dialog" aria-modal="true" aria-labelledby="credit-void-title">
        <h2 id="credit-void-title">Delete {voidTarget.entries.length} {voidTarget.entries.length === 1 ? 'entry' : 'entries'}?</h2>
        <p>These entries will be removed from activity. Their records and deletion history will be retained.</p>
        <form onSubmit={event => void confirmVoidEntry(event)}>
          <label>Reason for deletion<textarea required autoFocus maxLength={240} rows={3} value={voidTarget.reason} onChange={event => setVoidTarget(current => current ? { ...current, reason: event.target.value } : current)} /></label>
          {error && <p role="alert" className="voice-error">{error}</p>}
          <div className="credit-form-actions"><button type="button" className="back-button" disabled={busy} onClick={() => setVoidTarget(undefined)}>Cancel</button><button type="submit" className="delete-selected-orders" disabled={busy || !voidTarget.reason.trim()}>{busy ? 'Deleting...' : 'Confirm delete'}</button></div>
        </form>
      </section>
    </div>}
    {archiveOpen && selectedCustomer && <div className="credit-dialog-backdrop"><section className="credit-void-dialog" role="dialog" aria-modal="true" aria-labelledby="credit-archive-title">
      <h2 id="credit-archive-title">Archive {selectedCustomer.name}?</h2>
      {balance !== 0 ? <p role="alert">This customer still owes {currency(balance)}. Settle the balance before archiving; orders and payments will stay available.</p> : <p>The account and its history will be kept under Archived customers. You can restore it later.</p>}
      {error && <p role="alert" className="voice-error">{error}</p>}
      <div className="credit-form-actions"><button type="button" className="back-button" disabled={busy} onClick={() => setArchiveOpen(false)}>Cancel</button><button type="button" className="save-button" disabled={busy || balance !== 0} onClick={() => void archiveSelectedCustomer()}>{busy ? 'Archiving...' : 'Confirm archive'}</button></div>
    </section></div>}
  </section>
}

function voidedEntriesForCustomer(adjustments: CreditAdjustment[]): Map<string, CreditAdjustment> {
  return new Map(adjustments.map(adjustment => [`${adjustment.targetType}:${adjustment.targetId}`, adjustment]))
}