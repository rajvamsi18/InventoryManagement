import assert from 'node:assert/strict'
import test from 'node:test'
import worker from '../src/index.ts'

const origin = 'https://rajvamsi18.github.io'

function createEnv({ modelResponse, modelEnvelope, limited = false } = {}) {
  const calls = { model: 0, limit: 0, modelName: '', prompt: '', responseFormat: undefined }
  return {
    calls,
    env: {
      ALLOWED_ORIGIN: origin,
      AI: {
        async run(model, input) {
          calls.model += 1
          calls.modelName = model
          calls.prompt = input.messages[0].content
          calls.responseFormat = input.response_format
          return modelEnvelope ?? { choices: [{ message: { content: modelResponse ?? JSON.stringify({ items: [{ productName: 'బియ్యం', volume: '5 kg', quantity: null }, { productName: 'Milk', volume: '', quantity: 1.5 }] }) } }] }
        },
      },
      READ_LIST_LIMITER: {
        async limit() {
          calls.limit += 1
          return { success: !limited }
        },
      },
    },
    calls,
  }
}

function post(body, headers = {}) {
  return new Request('https://worker.example/read-list', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.4', ...headers },
    body: JSON.stringify(body),
  })
}

test('read-list returns only Only Order fields and marks an assumed quantity', async () => {
  const { env, calls } = createEnv()
  const response = await worker.fetch(post({ text: 'Please send rice and 1.5 litres milk' }), env)
  const data = await response.json()

  assert.equal(response.status, 200)
  assert.equal(calls.modelName, '@cf/qwen/qwen3-30b-a3b-fp8')
  assert.deepEqual(calls.responseFormat, { type: 'json_object' })
  assert.deepEqual(data.items, [
    { productName: 'బియ్యం', volume: '5 kg', quantity: 1, quantityAssumed: true },
    { productName: 'Milk', volume: '', quantity: 1.5, quantityAssumed: false },
  ])
  assert.equal('price' in data.items[0], false)
  assert.equal('total' in data.items[0], false)
  assert.match(calls.prompt, /Do not invent products or infer prices/)
  assert.match(calls.prompt, /Include every distinct requested product/)
  assert.match(calls.prompt, /must return two items/)
  assert.match(calls.prompt, /Big plastic bags 3/)
  assert.match(calls.prompt, /omit the size word from productName/)
  assert.match(calls.prompt, /Big plastic bags 3/)
  assert.match(calls.prompt, /put that size in volume/)
  assert.equal(calls.limit, 1)
})

test('read-list rejects empty text without using AI', async () => {
  const { env, calls } = createEnv()
  const response = await worker.fetch(post({ text: '   ' }), env)
  assert.equal(response.status, 400)
  assert.equal(calls.model, 0)
  assert.equal(calls.limit, 0)
})

test('read-list normalizes model quantity strings and flags unclear values', async () => {
  const { env } = createEnv({ modelResponse: JSON.stringify({ items: [
    { productName: 'Rice', volume: '', quantity: '1 bag' },
    { productName: 'Coffee powder', volume: '', quantity: 'two pkts' },
    { productName: 'Vim bar', volume: '', quantity: 'రెండు' },
    { productName: 'Plastic covers', volume: 'small size', quantity: 'not stated' },
  ] }) })
  const response = await worker.fetch(post({ text: 'Rice 1 bag, coffee powder 2 packets, Vim bar two, plastic covers small' }), env)
  const data = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(data.items, [
    { productName: 'Rice', volume: 'bag', quantity: 1, quantityAssumed: false },
    { productName: 'Coffee powder', volume: 'pkts', quantity: 2, quantityAssumed: false },
    { productName: 'Vim bar', volume: '', quantity: 2, quantityAssumed: false },
    { productName: 'Plastic covers', volume: 'small size', quantity: 1, quantityAssumed: true },
  ])
})

test('read-list decodes structured model content blocks', async () => {
  const { env } = createEnv({ modelResponse: { parts: [{ text: JSON.stringify({ items: [{ productName: 'Rice', volume: '', quantity: '1 bag' }] }) }] } })
  const response = await worker.fetch(post({ text: 'Rice 1 bag' }), env)
  const data = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(data.items, [{ productName: 'Rice', volume: 'bag', quantity: 1, quantityAssumed: false }])
})

test('read-list decodes an object-wrapped top-level response', async () => {
  const { env } = createEnv({ modelEnvelope: { response: { text: JSON.stringify({ items: [{ productName: 'Rice', volume: '', quantity: 2 }] }) } } })
  const response = await worker.fetch(post({ text: 'Rice two' }), env)
  const data = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(data.items, [{ productName: 'Rice', volume: '', quantity: 2, quantityAssumed: false }])
})

test('read-list enforces the rate limit before using AI', async () => {
  const { env, calls } = createEnv({ limited: true })
  const response = await worker.fetch(post({ text: 'rice' }), env)
  assert.equal(response.status, 429)
  assert.equal(calls.model, 0)
})

test('read-list rejects malformed model output instead of dropping order lines', async () => {
  const { env } = createEnv({ modelResponse: '{"items":[{"productName":"Rice","quantity":0}]}' })
  const response = await worker.fetch(post({ text: 'rice' }), env)
  assert.equal(response.status, 502)
})
