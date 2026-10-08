import { useRef } from 'react'
import type { SalesOrder } from '../services/database'

type Props = {
  order: SalesOrder
  selectionMode: boolean
  selected: boolean
  onOpen: (order: SalesOrder) => void
  onSelect: (orderId: string) => void
}

export function OrderRow({ order, selectionMode, selected, onOpen, onSelect }: Props) {
  const timer = useRef<number | undefined>(undefined)
  const longPressed = useRef(false)

  function startPress() {
    longPressed.current = false
    timer.current = window.setTimeout(() => {
      longPressed.current = true
      onSelect(order.id)
    }, 550)
  }

  function cancelPress() {
    if (timer.current !== undefined) window.clearTimeout(timer.current)
  }

  function activate() {
    cancelPress()
    if (longPressed.current) return
    if (selectionMode) onSelect(order.id)
    else onOpen(order)
  }

  return <div className={`order-row ${selected ? 'selected' : ''}`} role="button" tabIndex={0} onPointerDown={startPress} onPointerUp={activate} onPointerCancel={cancelPress} onPointerLeave={cancelPress} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectionMode ? onSelect(order.id) : onOpen(order) } }}>
    {selectionMode && <input type="checkbox" checked={selected} onChange={() => onSelect(order.id)} onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} aria-label={`Select ${order.orderNumber}`} />}
    <span>{order.orderNumber}<small>{new Date(order.soldAt).toLocaleString()}</small></span>
    <strong>{order.totalAmount.toFixed(2)}</strong>
  </div>
}