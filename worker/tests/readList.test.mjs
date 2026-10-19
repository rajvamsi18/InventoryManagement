import assert from 'node:assert/strict'
import test from 'node:test'
import worker from '../src/index.ts'

const origin = 'https://rajvamsi18.github.io'

function createEnv({ modelResponse, limited = false } = {}) {
  const calls = { model: 0, limit: 0, modelName: '', prompt: '' }
  return {
    calls,
    env: {
      ALLOWED_ORIGIN: origin,
      AI: {
        async run(model, input) {
          calls.model += 1
          calls.modelName = model
          calls.prompt = input.messages[0].content
          return { response: modelResponse ?? JSON.stringify({ items: [{ productName: 'బియ్యం', volume: '5 kg', quantity: null }, { productName: 'Milk', volume: '', quantity: 1.5 }] }) }
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
  assert.equal(calls.modelName, '@cf/google/gemma-3-12b-it')
  assert.deepEqual(data.items, [
    { productName: 'బియ్యం', volume: '5 kg', quantity: 1, quantityAssumed: true },
    { productName: 'Milk', volume: '', quantity: 1.5, quantityAssumed: false },
  ])
  assert.equal('price' in data.items[0], false)
  assert.equal('total' in data.items[0], false)
  assert.match(calls.prompt, /Do not invent products or infer prices/)
  assert.equal(calls.limit, 1)
})

test('read-list rejects empty text without using AI', async () => {
  const { env, calls } = createEnv()
  const response = await worker.fetch(post({ text: '   ' }), env)
  assert.equal(response.status, 400)
  assert.equal(calls.model, 0)
  assert.equal(calls.limit, 0)
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
