import type { SalesOrder } from './database'

export function matchesOrderSearch(order: SalesOrder, query: string): boolean {
  const searchText = query.trim().toLocaleLowerCase()
  if (!searchText) return true
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')
  const normalizedQuery = normalize(searchText)
  if (!normalizedQuery) return true

  const soldAt = new Date(order.soldAt)
  const amount = order.totalAmount.toFixed(2)
  const amountQuery = searchText.replace(/^rs\.?\s*/, '').replace(/,/g, '').trim()
  const amountMatches = /^\d+(?:\.\d{0,2})?$/.test(amountQuery) && Number(amountQuery).toFixed(2) === amount
  const searchableValues = [
    order.orderNumber,
    order.customerName ?? '',
    soldAt.toLocaleDateString(),
    soldAt.toLocaleString(),
    soldAt.toISOString().slice(0, 10),
  ]
  return amountMatches || searchableValues.some(value => {
    const normalizedValue = value.toLocaleLowerCase()
    return normalizedValue.includes(searchText) || normalize(normalizedValue).includes(normalizedQuery)
  })
}