import { useEffect, useState } from 'react'
import { Download, ReceiptText, Share2 } from 'lucide-react'
import goddessIllustrationUrl from '../assets/kanamahalakshmi.jpg'
import type { SalesOrder, SalesOrderItem } from '../services/database'
import { createReceipt, downloadReceipt, receiptDate, receiptProductName, STORE } from '../services/receipt'

type Props = { order: SalesOrder; items: SalesOrderItem[] }

export function OrderReceipt({ order, items }: Props) {
  const [open, setOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [message, setMessage] = useState('')
  const [prepared, setPrepared] = useState<{ key: string; file?: File; error?: string }>()
  const receiptKey = JSON.stringify({ order, items })
  const file = prepared?.key === receiptKey ? prepared.file : undefined
  const pdfError = prepared?.key === receiptKey ? prepared.error : undefined

  useEffect(() => {
    if (!open || !items.length) return
    let cancelled = false
    const values = JSON.parse(receiptKey) as { order: SalesOrder; items: SalesOrderItem[] }
    void createReceipt(values.order, values.items).then(file => {
      if (!cancelled) setPrepared({ key: receiptKey, file })
    }).catch(() => {
      if (!cancelled) setPrepared({ key: receiptKey, error: 'Could not create the receipt. Close and reopen Receipt to retry.' })
    })
    return () => { cancelled = true }
  }, [open, receiptKey, items.length])

  function download() {
    if (!file) return
    try {
      downloadReceipt(file)
      setMessage('PDF downloaded. You can attach it in WhatsApp.')
    } catch {
      setMessage('Could not create the receipt. Please try again.')
    }
  }

  async function share() {
    if (!file) return
    setSharing(true)
    setMessage('')
    try {
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
            <div className="receipt-actions">
              <button type="button" className="primary-button" onClick={download} disabled={!file || sharing}>
                <Download size={16} /> Download PDF
              </button>
              <button type="button" className="primary-button" onClick={() => void share()} disabled={!file || sharing}>
                <Share2 size={16} /> {sharing ? 'Sharing...' : 'Share PDF'}
              </button>
            </div>
          </div>
          {!file && items.length > 0 && !pdfError && <p role="status" className="receipt-status">Preparing PDF...</p>}
          {pdfError && <p role="alert" className="receipt-status">{pdfError}</p>}
          {message && <p role="status" className="receipt-status">{message}</p>}
          <article className="receipt-preview" aria-label="Order receipt preview">
            <header className="receipt-store">
              <h3 className="receipt-document-title">Order Receipt</h3>
              <div className="receipt-brand-line">
                <h2>SMKG</h2>
              </div>
              <div className="receipt-store-copy">
                <strong>Sri Mareswari Kirana &amp; General Stores</strong>
                <p>{STORE.address}</p>
                <p>Contact: {STORE.contact}</p>
                <p>GSTIN: {STORE.gstin}</p>
                <p>{STORE.dealerType}</p>
              </div>
              <img className="receipt-goddess" src={goddessIllustrationUrl} alt="Goddess Kanaka Mahalakshmi" />
            </header>
            <div className="receipt-meta">
              <strong className="receipt-order-identifier">Order Number: {order.orderNumber}</strong>
              <p>{receiptDate(order.soldAt)} IST</p>
              {order.customerName?.trim() && <p className="receipt-customer-identifier">Customer: {order.customerName.trim()}</p>}
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