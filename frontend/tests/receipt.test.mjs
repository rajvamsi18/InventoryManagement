import assert from 'node:assert/strict'
import test from 'node:test'
import { createReceipt, receiptDate, receiptProductName, STORE } from '../src/services/receipt.ts'

const order = { orderNumber: 'SMKG-000006', soldAt: '2026-10-07T12:00:00Z', totalAmount: 180 }
const item = { productName: 'Rice', quantitySold: 2, unitSellingPrice: 90, lineTotal: 180, unitCost: 67 }

test('receipt uses saved sale values and excludes private costs', async () => {
  const file = createReceipt(order, [item], 'Customer Test')
  const pdf = await file.text()
  assert.equal(file.name, 'SMKG-000006.pdf')
  assert.equal(file.type, 'application/pdf')
  assert.ok(pdf.startsWith('%PDF-'))
  for (const value of ['SMKG-000006', 'Rice', '90.00', '180.00', 'Customer Test', STORE.contact]) {
    assert.ok(pdf.includes(value), value)
  }
  assert.ok(!pdf.includes('67.00'))
  assert.ok(pdf.includes('does not confirm payment'))
})

test('long orders paginate and retain the total', async () => {
  const items = Array.from({ length: 100 }, () => item)
  const pdf = await createReceipt({ ...order, totalAmount: 18000 }, items).text()
  assert.ok(/\/Count [2-9]/.test(pdf))
  assert.ok(pdf.includes('18000.00'))
})

test('order dates use store timezone', () => {
  assert.equal(receiptDate('2026-10-07T12:00:00Z'), '7 Oct 2026, 5:30 pm')
})

test('pack size and unit appear beside product names in PDFs', async () => {
  const packed = { ...item, measurementValue: 0.5, unit: 'Kilograms' }
  assert.equal(receiptProductName(packed), 'Rice (0.5 Kilograms)')
  assert.equal(receiptProductName(item), 'Rice')
  assert.equal(receiptProductName({ ...item, unit: 'Grams' }), 'Rice (Grams)')
  assert.ok((await createReceipt(order, [packed]).text()).includes('Rice \\(0.5 Kilograms\\)'))
})