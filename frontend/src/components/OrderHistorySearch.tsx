import { Search, X } from 'lucide-react'

type Props = {
  value: string
  onChange: (value: string) => void
}

export function OrderHistorySearch({ value, onChange }: Props) {
  return <label className="order-history-search">
    <Search size={17} aria-hidden="true" />
    <input
      type="search"
      aria-label="Search orders by date, order number, or customer name"
      placeholder="Search date, order number, or customer"
      value={value}
      onChange={event => onChange(event.target.value)}
    />
    {value && <button type="button" aria-label="Clear order search" onClick={() => onChange('')}><X size={16} /></button>}
  </label>
}