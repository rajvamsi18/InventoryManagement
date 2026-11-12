import { useEffect, useState } from 'react'
import { ArrowLeft, ClipboardList, CreditCard, Package, ReceiptText } from 'lucide-react'

type Props = {
  mode: 'inventory' | 'only' | 'credit'
  view?: 'orders' | 'history'
  onSelectMode: (mode: 'inventory' | 'only' | 'credit') => void
  onBackToOrders?: () => void
  onAllOrders: () => void
  onNewOrder: () => void
  onReadList?: () => void
  readListLabel?: string
  readListDescription?: string
  openChooser?: boolean
  onChooserOpened?: () => void
}

export function OrderHistoryHeader({ mode, view = 'orders', onSelectMode, onBackToOrders, onAllOrders, onNewOrder, onReadList, readListLabel = 'From list', readListDescription = 'Read a WhatsApp order list', openChooser = false, onChooserOpened }: Props) {
  const [choiceStep, setChoiceStep] = useState<'actions' | 'create' | null>(() => view === 'orders' || openChooser ? 'actions' : null)

  useEffect(() => {
    if (openChooser) onChooserOpened?.()
  }, [openChooser, onChooserOpened])

  function chooseAllOrders() {
    setChoiceStep(null)
    onAllOrders()
  }

  function chooseCreateOrder() {
    if (onReadList) setChoiceStep('create')
    else {
      setChoiceStep(null)
      onNewOrder()
    }
  }

  return <header className="order-history-heading">
    {view === 'history' ? <div className="order-history-page-heading">
      <button type="button" className="back-button" onClick={onBackToOrders}><ArrowLeft size={16} /> Orders</button>
      <p className="eyebrow">Order History</p>
    </div> : <>
      <div className="order-history-modes" role="group" aria-label="Order flow">
        <button type="button" aria-pressed={mode === 'inventory'} onClick={() => { onSelectMode('inventory'); setChoiceStep('actions') }}><Package size={16} /> From Inventory</button>
        <button type="button" aria-pressed={mode === 'only'} onClick={() => { onSelectMode('only'); setChoiceStep('actions') }}><ReceiptText size={16} /> Only Order</button>
        <button type="button" aria-pressed={mode === 'credit'} onClick={() => { onSelectMode('credit'); setChoiceStep('actions') }}><CreditCard size={16} /> Credit Order</button>
      </div>
    </>}
    {view === 'orders' && choiceStep && <div className="order-choice-options order-choice-inline" role="group" aria-label={choiceStep === 'actions' ? 'Order actions' : 'Create order options'}>
      {choiceStep === 'actions' ? <>
        <button type="button" className="order-choice-option" onClick={chooseAllOrders}><ClipboardList size={19} /><span><strong>All Orders</strong><small>View saved orders</small></span></button>
        <button type="button" className="order-choice-option" onClick={chooseCreateOrder}><Package size={19} /><span><strong>Create Order</strong><small>Start a new order</small></span></button>
      </> : <>
        <button type="button" className="order-choice-option" onClick={() => { setChoiceStep(null); onReadList?.() }}><ClipboardList size={19} /><span><strong>{readListLabel}</strong><small>{readListDescription}</small></span></button>
        <button type="button" className="order-choice-option" onClick={() => { setChoiceStep(null); onNewOrder() }}><Package size={19} /><span><strong>Without list</strong><small>Enter order items manually</small></span></button>
        <button type="button" className="order-choice-back" onClick={() => setChoiceStep('actions')}><ArrowLeft size={15} /> Back</button>
      </>}
    </div>}
  </header>
}