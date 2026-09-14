export type VoiceEngine = 'browser' | 'sarvam'

const STORAGE_KEY = 'smkg-voice-engine'

export function getVoiceEngine(): VoiceEngine {
  if (typeof window === 'undefined') return 'browser'
  return window.localStorage.getItem(STORAGE_KEY) === 'sarvam' ? 'sarvam' : 'browser'
}

export function setVoiceEngine(engine: VoiceEngine) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, engine)
}
