// Sends a recorded audio clip to our serverless proxy (see /worker), which holds the Sarvam
// API key and forwards the request. The browser never talks to Sarvam directly.
const PROXY_URL = import.meta.env.VITE_SARVAM_PROXY_URL as string | undefined

// Safari (iOS) records audio/mp4, Chrome records audio/webm — the filename extension must match
// the actual encoding or Sarvam rejects the upload with a 400.
function extensionFor(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

export async function transcribeWithSarvam(audioBlob: Blob, languageCode: 'en-IN' | 'te-IN'): Promise<string> {
  if (!PROXY_URL) throw new Error('Sarvam is not configured yet (missing VITE_SARVAM_PROXY_URL).')

  const form = new FormData()
  form.append('file', audioBlob, `speech.${extensionFor(audioBlob.type)}`)
  form.append('language_code', languageCode)

  const response = await fetch(PROXY_URL, { method: 'POST', body: form })
  if (!response.ok) throw new Error(`Sarvam transcription failed (${response.status}).`)

  const data = (await response.json()) as { transcript?: string }
  if (!data.transcript) throw new Error('Sarvam did not return a transcript.')
  return data.transcript
}
