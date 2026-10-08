import pdfMake from 'pdfmake/build/pdfmake.js'
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces'
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

let fontPromise: Promise<Record<string, string>> | undefined

async function fontData(url: URL): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not load receipt fonts.')
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
  }
  return btoa(binary)
}

function receiptFonts(): Promise<Record<string, string>> {
  fontPromise ??= Promise.all([
    fontData(new URL('../assets/NotoSansTelugu-Regular.ttf', import.meta.url)),
    fontData(new URL('../assets/NotoSansTelugu-Bold.ttf', import.meta.url)),
    fontData(new URL('../assets/NotoSans-Regular.ttf', import.meta.url)),
    fontData(new URL('../assets/NotoSans-Bold.ttf', import.meta.url)),
  ]).then(([regular, bold, latin, latinBold]) => ({ 'regular.ttf': regular, 'bold.ttf': bold, 'latin.ttf': latin, 'latin-bold.ttf': latinBold })).catch(error => {
    fontPromise = undefined
    throw error
  })
  return fontPromise
}

function receiptText(value: string): { text: string; font: string }[] {
  const runs: { text: string; font: string }[] = []
  for (const { segment } of new Intl.Segmenter('te', { granularity: 'grapheme' }).segment(value)) {
    const font = /\p{Script=Telugu}/u.test(segment) ? 'Telugu' : 'Receipt'
    const previous = runs.at(-1)
    if (previous?.font === font) previous.text += segment
    else runs.push({ text: segment, font })
  }
  return runs
}

export async function createReceipt(order: SalesOrder, items: SalesOrderItem[], customerName = ''): Promise<File> {
  const fonts = await receiptFonts()
  const green = '#1c6546'
  const content: Content[] = [
    { text: 'SMKG', fontSize: 22, bold: true, color: green },
    { text: 'Sri Mareswari Kirana & General Stores', fontSize: 10, bold: true, color: green },
    { text: STORE.address, fontSize: 8, margin: [0, 6, 0, 3] },
    { text: `Contact: ${STORE.contact}`, fontSize: 8 },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 351.53, y2: 0, lineWidth: 1, lineColor: green }], margin: [0, 10, 0, 10] },
    { text: 'ORDER RECEIPT', fontSize: 12, bold: true, margin: [0, 0, 0, 6] },
    { text: `Order: ${order.orderNumber}`, margin: [0, 0, 0, 3] },
    { text: `Date: ${receiptDate(order.soldAt)} IST`, margin: [0, 0, 0, 6] },
  ]
  if (customerName.trim()) content.push({ text: receiptText(`Customer: ${customerName.trim()}`), margin: [0, 0, 0, 6] })
  content.push({
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: ['*', 26, 64, 76],
      body: [
        ['Product', 'Qty', 'Price (INR)', 'Amount (INR)'].map((text, index) => ({ text, bold: true, color: '#fff', alignment: index ? 'right' as const : 'left' as const })),
        ...items.map(item => [
          { text: receiptText(receiptProductName(item)) },
          { text: String(item.quantitySold), alignment: 'right' as const },
          { text: item.unitSellingPrice.toFixed(2), alignment: 'right' as const },
          { text: item.lineTotal.toFixed(2), alignment: 'right' as const },
        ]),
        [{ text: 'TOTAL (INR)', colSpan: 3, bold: true, color: '#fff' }, {}, {}, { text: order.totalAmount.toFixed(2), bold: true, color: '#fff', alignment: 'right' }],
      ],
    },
    layout: {
      fillColor: row => row === 0 || row === items.length + 1 ? green : row % 2 ? '#f3f5f3' : '#fff',
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 7,
      paddingBottom: () => 7,
    },
  })
  const definition: TDocumentDefinitions = {
    pageSize: 'A5',
    pageMargins: [34, 34, 34, 50],
    defaultStyle: { font: 'Receipt', fontSize: 9, color: '#37413c' },
    content,
    footer: (page, pages) => ({
      columns: [
        { stack: ['Thank you for shopping with us.', 'This order receipt does not confirm payment.'] },
        { text: `${page} / ${pages}`, alignment: 'right', width: 40 },
      ],
      margin: [34, 8, 34, 0], fontSize: 8, color: '#505a55',
    }),
  }
  const pdf = pdfMake.createPdf(definition, undefined, {
    Receipt: { normal: 'latin.ttf', bold: 'latin-bold.ttf', italics: 'latin.ttf', bolditalics: 'latin-bold.ttf' },
    Telugu: { normal: 'regular.ttf', bold: 'bold.ttf', italics: 'regular.ttf', bolditalics: 'bold.ttf' },
  }, fonts)
  const buffer = await new Promise<Uint8Array>(resolve => pdf.getBuffer(resolve))
  return new File([new Uint8Array(buffer)], `${order.orderNumber.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`, { type: 'application/pdf' })
}

export function downloadReceipt(file: File): void {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}