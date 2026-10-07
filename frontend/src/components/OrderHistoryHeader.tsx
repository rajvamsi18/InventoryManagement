import { Package, Plus, ReceiptText } from 'lucide-react'

type Props = {
  mode: 'inventory' | 'only'
  onSelectMode: (mode: 'inventory' | 'only') => void
  onNewOrder: () => void
  newOrderLabel?: string
}

export function OrderHistoryHeader({ mode, onSelectMode, onNewOrder, newOrderLabel = 'New order' }: Props) {
  return <header className="order-history-heading">
    <p className="eyebrow">Order History</p>
    <div className="order-history-modes" role="group" aria-label="Order history flow">
      <button type="button" aria-pressed={mode === 'inventory'} onClick={() => onSelectMode('inventory')}><Package size={16} /> From Inventory</button>
      <button type="button" aria-pressed={mode === 'only'} onClick={() => onSelectMode('only')}><ReceiptText size={16} /> Only Order</button>
    </div>
    <div className="orders-heading"><h2>Recent Orders</h2><button type="button" className="primary-button" onClick={onNewOrder}><Plus size={16} /> {newOrderLabel}</button></div>
  </header>
}