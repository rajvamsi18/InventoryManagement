import type { ReadListItem } from './onlyOrders'

const WORKER_URL = import.meta.env.VITE_SARVAM_PROXY_URL as string | undefined

type ReadListResponse = { items?: unknown; error?: unknown }

export async function readWhatsAppList(text: string): Promise<ReadListItem[]> {
  if (!WORKER_URL) throw new Error('Read List is not configured yet.')

  const response = await fetch(`${WORKER_URL.replace(/\/+$/, '')}/read-list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })

  let data: ReadListResponse
  try { data = await response.json() as ReadListResponse } catch { throw new Error('Could not read the response. Please try again.') }
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Could not read this message. Please try again.')
  }
  if (!Array.isArray(data.items) || !data.items.length) throw new Error('No product lines were returned. Please review the message and try again.')

  return data.items.map((item): ReadListItem => {
    if (!item || typeof item !== 'object') throw new Error('The response contained an invalid product line.')
    const line = item as Partial<ReadListItem>
    if (typeof line.productName !== 'string' || !line.productName.trim() ||
      typeof line.volume !== 'string' || !Number.isFinite(line.quantity) || line.quantity! <= 0 ||
      typeof line.quantityAssumed !== 'boolean') {
      throw new Error('The response contained an invalid product line.')
    }
    return { productName: line.productName.trim(), volume: line.volume.trim(), quantity: line.quantity!, quantityAssumed: line.quantityAssumed }
  })
}
