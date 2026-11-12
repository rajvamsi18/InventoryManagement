import pdfMake from 'pdfmake/build/pdfmake.js'
import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces'
import type { SalesOrder, SalesOrderItem } from './database'

export const STORE = {
  name: 'SMKG - Sri Mareswari Kirana & General Stores',
  address: '14-1-63/3, Pandimetta, Nowroji Road, Visakhapatnam - 530 002',
  contact: '+91 9347319292',
  gstin: '37AGGPC9606C1ZQ',
  dealerType: 'Composition Dealer',
}

const receiptTitleSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="112" height="30" viewBox="0 0 112 30"><rect x="0.5" y="0.5" width="111" height="29" rx="4" fill="none" stroke="#000000" stroke-width="1"/><text x="56" y="19" text-anchor="middle" font-family="Helvetica, sans-serif" font-size="12" font-weight="bold" fill="#000000">Order Receipt</text></svg>'

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

async function imageData(url: URL): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not load receipt illustration.')
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 32768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768))
  }
  return `data:image/jpeg;base64,${btoa(binary)}`
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

export async function createReceipt(order: SalesOrder, items: SalesOrderItem[]): Promise<File> {
  const [fonts, goddessIllustration] = await Promise.all([
    receiptFonts(),
    imageData(new URL('../assets/kanamahalakshmi.jpg', import.meta.url)),
  ])
  const green = '#1c6546'
  const content: Content[] = [
    {
      svg: receiptTitleSvg,
      width: 112,
      height: 30,
      alignment: 'center',
      margin: [0, 0, 0, 4],
    },
    {
      columns: [
        { width: '*', stack: [
          { text: 'SMKG', fontSize: 22, bold: true, color: green, margin: [0, 0, 0, 4] },
          { text: 'Sri Mareswari Kirana & General Stores', fontSize: 11, bold: true, color: green, margin: [0, 0, 0, 2] },
          { text: STORE.address, fontSize: 8, margin: [0, 6, 0, 3] },
          { text: `Contact: ${STORE.contact}`, fontSize: 8, margin: [0, 0, 0, 3] },
          { text: `GSTIN: ${STORE.gstin}`, fontSize: 8, margin: [0, 0, 0, 3] },
          { text: STORE.dealerType, fontSize: 8 },
        ] },
        { width: 65.5, image: goddessIllustration, margin: [8, 18, 0, 0] },
      ],
      columnGap: 8,
    },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 351.53, y2: 0, lineWidth: 1, lineColor: green }], margin: [0, 10, 0, 10] },
    { text: `Order Number: ${order.orderNumber}`, fontSize: 9, bold: true, color: green, margin: [0, 0, 0, 3] },
    { text: `Date: ${receiptDate(order.soldAt)} IST`, margin: [0, 0, 0, 6] },
  ]
  if (order.customerName?.trim()) content.push({ text: receiptText(`Customer: ${order.customerName.trim()}`), fontSize: 9, bold: true, color: green, margin: [0, 0, 0, 6] })
  content.push({
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: ['*', 26, 64, 76],
      body: [
        ['Product', 'Qty', 'Price (INR)', 'Amount (INR)'].map((text, index) => ({ text, bold: true, color: '#fff', alignment: index ? 'right' as const : 'left' as const })),
        ...items.map(item => [
          { text: receiptText(receiptProductName(item)), bold: true },
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