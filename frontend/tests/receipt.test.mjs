import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createReceipt, receiptDate, receiptProductName, STORE } from '../src/services/receipt.ts'

const order = { orderNumber: 'SMKG-000006', soldAt: '2026-10-07T12:00:00Z', totalAmount: 180 }
const item = { productName: 'Rice', quantitySold: 2, unitSellingPrice: 90, lineTotal: 180, unitCost: 67 }

const originalFetch = globalThis.fetch
globalThis.fetch = async (input, options) => {
  if (input instanceof URL && input.protocol === 'file:') return new Response(await readFile(input))
  return originalFetch(input, options)
}

async function pdfContents(file) {
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const pdf = await task.promise
  const pages = []
  for (let index = 1; index <= pdf.numPages; index += 1) {
    const text = await (await pdf.getPage(index)).getTextContent()
    pages.push(text.items.map(item => item.str).join(''))
  }
  const count = pdf.numPages
  await task.destroy()
  return { text: pages.join(' '), count }
}

const contains = (text, value) => text.replace(/\s+/g, '').includes(value.replace(/\s+/g, ''))

test('receipt uses saved sale values and excludes private costs', async () => {
  const file = await createReceipt(order, [item], 'Customer Test')
  const pdf = (await pdfContents(file)).text
  assert.equal(file.name, 'SMKG-000006.pdf')
  assert.equal(file.type, 'application/pdf')
  assert.ok((await file.text()).startsWith('%PDF-'))
  for (const value of ['SMKG-000006', 'Rice', '90.00', '180.00', 'Customer Test', STORE.contact]) {
    assert.ok(contains(pdf, value), value)
  }
  assert.ok(!pdf.includes('67.00'))
  assert.ok(contains(pdf, 'does not confirm payment'))
})

test('long orders paginate and retain the total', async () => {
  const items = Array.from({ length: 100 }, () => item)
  const pdf = await pdfContents(await createReceipt({ ...order, totalAmount: 18000 }, items))
  assert.ok(pdf.count > 1)
  assert.ok(pdf.text.includes('18000.00'))
})

test('receipt retains decimal quantity and its calculated amount', async () => {
  const decimal = { ...item, productName: 'Sugar', quantitySold: 0.25, unitSellingPrice: 65, lineTotal: 16.25 }
  const pdf = await pdfContents(await createReceipt({ ...order, totalAmount: 16.25 }, [decimal]))
  for (const value of ['Sugar', '0.25', '65.00', '16.25']) assert.ok(contains(pdf.text, value), value)
})

test('order dates use store timezone', () => {
  assert.equal(receiptDate('2026-10-07T12:00:00Z'), '7 Oct 2026, 5:30 pm')
})

test('pack size and unit appear beside product names in PDFs', async () => {
  const packed = { ...item, measurementValue: 0.5, unit: 'Kilograms' }
  assert.equal(receiptProductName(packed), 'Rice (0.5 Kilograms)')
  assert.equal(receiptProductName(item), 'Rice')
  assert.equal(receiptProductName({ ...item, unit: 'Grams' }), 'Rice (Grams)')
  assert.equal(receiptProductName({ ...packed, volume: '100 litres' }), 'Rice (100 litres)')
  assert.equal(receiptProductName({ ...item, volume: '' }), 'Rice')
  assert.ok(contains((await pdfContents(await createReceipt(order, [packed]))).text, 'Rice (0.5 Kilograms)'))
})

test('Telugu product names, Volume and customer names remain readable', async () => {
  const productName = '\u0c2c\u0c3f\u0c2f\u0c4d\u0c2f\u0c02'
  const volume = '30 \u0c15\u0c3f\u0c32\u0c4b\u0c32\u0c41'
  const customer = '\u0c30\u0c3e\u0c2e\u0c41'
  const file = await createReceipt(order, [{ ...item, productName, volume }], customer)
  const pdf = await pdfContents(file)
  assert.ok(contains(pdf.text, productName), pdf.text)
  assert.ok(contains(pdf.text, volume), pdf.text)
  assert.ok(contains(pdf.text, customer), pdf.text)
  assert.ok((await file.text()).includes('/FontFile2'))
})