export interface Env {
  SARVAM_API_KEY: string
  ALLOWED_ORIGIN?: string
}

const SARVAM_ENDPOINT = 'https://api.sarvam.ai/speech-to-text'

function corsHeaders(env: Env): HeadersInit {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(env) })
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders(env) })
    if (!env.SARVAM_API_KEY) return new Response('Server not configured: missing SARVAM_API_KEY', { status: 500, headers: corsHeaders(env) })

    const incoming = await request.formData()
    const file = incoming.get('file')
    const languageCode = incoming.get('language_code') ?? 'en-IN'
    if (!(file instanceof Blob)) return new Response('Missing audio file', { status: 400, headers: corsHeaders(env) })

    const outgoing = new FormData()
    outgoing.append('file', file, 'speech.webm')
    outgoing.append('model', 'saaras:v3')
    outgoing.append('language_code', String(languageCode))

    const sarvamResponse = await fetch(SARVAM_ENDPOINT, {
      method: 'POST',
      headers: { 'api-subscription-key': env.SARVAM_API_KEY },
      body: outgoing,
    })

    const body = await sarvamResponse.text()
    return new Response(body, { status: sarvamResponse.status, headers: { ...corsHeaders(env), 'Content-Type': 'application/json' } })
  },
}
