import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { SalesOrder, SalesOrderItem } from './database'

export const STORE = {
  name: 'SMKG - Sri Mareswari Kirana & General Stores',
  address: '1 Nowroji Road, Daspalla Hills, Pandurangapuram, Visakhapatnam, Andhra Pradesh - 530002',
  contact: '+91 9347319292',
}

export function receiptDate(soldAt: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata',
  }).format(new Date(soldAt))
}

export function receiptProductName(item: SalesOrderItem): string {
  const pack = item.volume ?? [item.measurementValue, item.unit].filter(value => value !== undefined && value !== '').join(' ')
  return pack ? `${item.productName} (${pack})` : item.productName
}

export function createReceipt(order: SalesOrder, items: SalesOrderItem[], customerName = ''): File {
  const pdf = new jsPDF({ format: 'a5', unit: 'mm' })
  const width = pdf.internal.pageSize.getWidth()
  pdf.setTextColor(28, 101, 70)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  pdf.text('SMKG', 12, 17)
  pdf.setFontSize(10)
  pdf.text('Sri Mareswari Kirana & General Stores', 12, 24)
  pdf.setTextColor(55, 65, 60)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  const address = pdf.splitTextToSize(STORE.address, width - 24)
  pdf.text(address, 12, 31)
  const contactY = 31 + address.length * 4
  pdf.text(`Contact: ${STORE.contact}`, 12, contactY)
  pdf.setDrawColor(28, 101, 70)
  pdf.line(12, contactY + 4, width - 12, contactY + 4)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.text('ORDER RECEIPT', 12, contactY + 12)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(`Order: ${order.orderNumber}`, 12, contactY + 19)
  pdf.text(`Date: ${receiptDate(order.soldAt)} IST`, 12, contactY + 25)
  let tableY = contactY + 31
  if (customerName.trim()) {
    const customer = pdf.splitTextToSize(`Customer: ${customerName.trim()}`, width - 24)
    pdf.text(customer, 12, tableY)
    tableY += customer.length * 4 + 3
  }
  autoTable(pdf, {
    startY: tableY,
    margin: { top: 12, bottom: 18, left: 12, right: 12 },
    head: [['Product', 'Qty', 'Price (INR)', 'Amount (INR)']],
    body: items.map(item => [receiptProductName(item), item.quantitySold, item.unitSellingPrice.toFixed(2), item.lineTotal.toFixed(2)]),
    foot: [['TOTAL (INR)', '', '', order.totalAmount.toFixed(2)]],
    showFoot: 'lastPage',
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [28, 101, 70] },
    footStyles: { fillColor: [28, 101, 70] },
    columnStyles: { 0: { cellWidth: 53 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  })
  const pages = pdf.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page)
    pdf.setFontSize(8)
    pdf.setTextColor(80, 90, 85)
    pdf.text('Thank you for shopping with us.', 12, 197)
    pdf.text('This order receipt does not confirm payment.', 12, 202)
    pdf.text(`${page} / ${pages}`, width - 12, 202, { align: 'right' })
  }
  return new File([pdf.output('arraybuffer')], `${order.orderNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`, { type: 'application/pdf' })
}

export function downloadReceipt(file: File): void {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}