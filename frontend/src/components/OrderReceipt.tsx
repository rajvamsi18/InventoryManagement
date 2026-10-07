import { useState } from 'react'
import { Download, ReceiptText, Share2 } from 'lucide-react'
import type { SalesOrder, SalesOrderItem } from '../services/database'
import { createReceipt, downloadReceipt, receiptDate, receiptProductName, STORE } from '../services/receipt'

type Props = { order: SalesOrder; items: SalesOrderItem[] }

export function OrderReceipt({ order, items }: Props) {
  const [open, setOpen] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [sharing, setSharing] = useState(false)
  const [message, setMessage] = useState('')

  function download() {
    try {
      downloadReceipt(createReceipt(order, items, customerName))
      setMessage('PDF downloaded. You can attach it in WhatsApp.')
    } catch {
      setMessage('Could not create the receipt. Please try again.')
    }
  }

  async function share() {
    setSharing(true)
    setMessage('')
    try {
      const file = createReceipt(order, items, customerName)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${STORE.name} - ${order.orderNumber}` })
      } else {
        downloadReceipt(file)
        setMessage('File sharing is unavailable in this browser. PDF downloaded for attaching in WhatsApp.')
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setMessage('Could not share the receipt. Use Download PDF and attach it in WhatsApp.')
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <section className="order-receipt">
      <button className="back-button" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ReceiptText size={18} /> {open ? 'Hide receipt' : 'Receipt'}
      </button>
      {open && (
        <>
          <div className="receipt-toolbar">
            <label>Customer name (optional)
              <input value={customerName} maxLength={120} onChange={event => setCustomerName(event.target.value)} />
            </label>
            <div className="receipt-actions">
              <button type="button" className="primary-button" onClick={download} disabled={!items.length || sharing}>
                <Download size={16} /> Download PDF
              </button>
              <button type="button" className="primary-button" onClick={() => void share()} disabled={!items.length || sharing}>
                <Share2 size={16} /> {sharing ? 'Sharing...' : 'Share PDF'}
              </button>
            </div>
          </div>
          {message && <p role="status" className="receipt-status">{message}</p>}
          <article className="receipt-preview" aria-label="Order receipt preview">
            <header className="receipt-store">
              <h2>SMKG</h2>
              <strong>Sri Mareswari Kirana &amp; General Stores</strong>
              <p>{STORE.address}</p>
              <p>{STORE.contact}</p>
            </header>
            <div className="receipt-meta">
              <h3>Order Receipt</h3>
              <strong>{order.orderNumber}</strong>
              <p>{receiptDate(order.soldAt)} IST</p>
              {customerName.trim() && <p>Customer: {customerName.trim()}</p>}
            </div>
            <table>
              <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
              <tbody>{items.map(item => (
                <tr key={item.id}><td>{receiptProductName(item)}</td><td>{item.quantitySold}</td><td>{item.unitSellingPrice.toFixed(2)}</td><td>{item.lineTotal.toFixed(2)}</td></tr>
              ))}</tbody>
              <tfoot><tr><th colSpan={3}>Total (INR)</th><td>{order.totalAmount.toFixed(2)}</td></tr></tfoot>
            </table>
            <footer><p>Thank you for shopping with us.</p><small>This order receipt does not confirm payment.</small></footer>
          </article>
        </>
      )}
    </section>
  )
}