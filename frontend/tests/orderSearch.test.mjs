import assert from 'node:assert/strict'
import test from 'node:test'
import { matchesOrderSearch } from '../src/services/orderSearch.ts'

const order = {
  id: 'order-1',
  orderNumber: 'OR 12',
  customerName: 'Raj Kumar',
  soldAt: '2026-10-31T09:41:05.000Z',
  totalAmount: 80,
  createdAt: '2026-10-31T09:41:05.000Z',
  updatedAt: '2026-10-31T09:41:05.000Z',
}

test('order search matches normalized number, customer, date, and amount across formats', () => {
  assert.equal(matchesOrderSearch(order, 'or 12'), true)
  assert.equal(matchesOrderSearch(order, 'OR12'), true)
  assert.equal(matchesOrderSearch(order, 'RAJ kum'), true)
  assert.equal(matchesOrderSearch(order, '2026-10-31'), true)
  assert.equal(matchesOrderSearch(order, '80'), true)
  assert.equal(matchesOrderSearch(order, '80.00'), true)
  assert.equal(matchesOrderSearch(order, 'Rs. 80.00'), true)
  assert.equal(matchesOrderSearch({ ...order, totalAmount: 88 }, '80'), false)
  assert.equal(matchesOrderSearch(order, 'no match'), false)
  assert.equal(matchesOrderSearch(order, ''), true)
})