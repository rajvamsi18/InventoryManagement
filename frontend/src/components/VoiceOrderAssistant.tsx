import { useRef, useState } from 'react'
import { Check, Mic, Plus, Square, X } from 'lucide-react'
import type { Product } from '../services/database'
import { matchProducts, parseSpokenOrder, type ParsedSpokenOrder } from '../services/voiceOrder'
import { getVoiceEngine, setVoiceEngine, type VoiceEngine } from '../services/voiceSettings'
import { transcribeWithSarvam } from '../services/sarvamStt'

export type VoiceProductPrefill = { name: string; measurementValue?: number; unit?: string; packageType?: string; price?: number; profitMarginPercent?: number; sellingPrice?: number }

type SpeechRecognitionAlternativeLike = { transcript: string }
type SpeechRecognitionResultLike = { 0: SpeechRecognitionAlternativeLike; isFinal: boolean }
type SpeechRecognitionEventLike = { resultIndex: number; results: { length: number; [index: number]: SpeechRecognitionResultLike } }
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type Props = {
  products: Product[]
  onConfirm: (productId: string, quantity: number) => void
  onAddNewProduct: (prefill: VoiceProductPrefill) => void
}

const currency = (amount: number) => `Rs. ${amount.toFixed(2)}`

export function VoiceOrderAssistant({ products, onConfirm, onAddNewProduct }: Props) {
  const RecognitionCtor =
    typeof window !== 'undefined'
      ? ((window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition)
      : undefined
  const recorderSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined'
  const [engine, setEngine] = useState<VoiceEngine>(getVoiceEngine)
  const [language, setLanguage] = useState<'en-IN' | 'te-IN'>('en-IN')
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [voiceError, setVoiceError] = useState<string>()
  const [transcript, setTranscript] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [matches, setMatches] = useState<{ product: Product; score: number }[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>()
  const [parsedDetails, setParsedDetails] = useState<ParsedSpokenOrder>()
  const [panelOpen, setPanelOpen] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | undefined>(undefined)
  const transcriptBufferRef = useRef('')
  const mediaRecorderRef = useRef<MediaRecorder | undefined>(undefined)

  // Neither engine can capture audio on this device — the mic control is simply not offered.
  if (!RecognitionCtor && !recorderSupported) return null

  function selectEngine(next: VoiceEngine) {
    setEngine(next)
    setVoiceEngine(next)
    setVoiceError(undefined)
  }

  function processTranscript(text: string) {
    const parsed = parseSpokenOrder(text)
    const ranked = matchProducts(products, parsed.nameQuery)
    setTranscript(text)
    setQuantity(parsed.quantity)
    setMatches(ranked)
    setSelectedProductId(ranked[0]?.product.id)
    setParsedDetails(parsed)
    setPanelOpen(true)
  }

  function startBrowserListening() {
    if (!RecognitionCtor) { setVoiceError('Browser voice typing is not supported here — switch to Sarvam.'); return }
    setVoiceError(undefined)
    transcriptBufferRef.current = ''
    const recognition = new RecognitionCtor()
    recognition.lang = language
    recognition.continuous = true
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    // Continuous mode keeps listening across pauses so a full sentence ("rice 2 kg unit price 74 selling price 90") isn't cut off.
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result.isFinal) transcriptBufferRef.current = `${transcriptBufferRef.current} ${result[0].transcript}`.trim()
      }
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => {
      setListening(false)
      if (transcriptBufferRef.current) processTranscript(transcriptBufferRef.current)
    }
    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  async function startSarvamRecording() {
    if (!recorderSupported) { setVoiceError('Microphone recording is not supported here.'); return }
    setVoiceError(undefined)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        setListening(false)
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        setTranscribing(true)
        try {
          const text = await transcribeWithSarvam(blob, language)
          processTranscript(text)
        } catch (error) {
          setVoiceError(error instanceof Error ? error.message : 'Could not transcribe audio.')
        } finally {
          setTranscribing(false)
        }
      }
      mediaRecorderRef.current = recorder
      setListening(true)
      recorder.start()
    } catch {
      setVoiceError('Microphone access was denied or is unavailable.')
    }
  }

  function startListening() {
    if (engine === 'sarvam') startSarvamRecording()
    else startBrowserListening()
  }

  function stopListening() {
    if (engine === 'sarvam') mediaRecorderRef.current?.stop()
    else recognitionRef.current?.stop()
  }

  function close() {
    setPanelOpen(false)
    setMatches([])
    setSelectedProductId(undefined)
    setParsedDetails(undefined)
  }

  function confirmAdd() {
    if (!selectedProductId) return
    onConfirm(selectedProductId, quantity)
    close()
  }

  function addAsNewProduct() {
    onAddNewProduct({
      name: parsedDetails?.nameQuery || transcript,
      measurementValue: parsedDetails?.measurementValue,
      unit: parsedDetails?.unitHint,
      packageType: parsedDetails?.packageTypeHint,
      price: parsedDetails?.unitCost,
      profitMarginPercent: parsedDetails?.profitMarginPercent,
      sellingPrice: parsedDetails?.sellingPrice,
    })
    close()
  }

  return (
    <div className="voice-assistant">
      <div className="voice-controls">
        <button type="button" className={`voice-button ${listening ? 'listening' : ''}`} onClick={listening ? stopListening : startListening} disabled={transcribing}>
          {listening ? <Square size={14} /> : <Mic size={16} />} {transcribing ? 'Transcribing…' : listening ? 'Tap to finish' : 'Voice add'}
        </button>
        <div className="voice-lang">
          <button type="button" className={language === 'en-IN' ? 'active' : ''} onClick={() => setLanguage('en-IN')}>EN</button>
          <button type="button" className={language === 'te-IN' ? 'active' : ''} onClick={() => setLanguage('te-IN')}>TE</button>
        </div>
        <div className="voice-engine">
          <button type="button" className={engine === 'browser' ? 'active' : ''} onClick={() => selectEngine('browser')}>Browser</button>
          <button type="button" className={engine === 'sarvam' ? 'active' : ''} onClick={() => selectEngine('sarvam')}>Sarvam</button>
        </div>
      </div>
      {voiceError && <p className="voice-error">{voiceError}</p>}
      {panelOpen && (
        <div className="voice-confirm">
          <div className="voice-confirm-header">
            <strong>Heard</strong>
            <button type="button" onClick={close} aria-label="Close voice result"><X size={15} /></button>
          </div>
          <input value={transcript} onChange={(event) => setTranscript(event.target.value)} />
          {matches.length ? (
            <div className="voice-matches">
              {matches.map(({ product }) => (
                <label className={selectedProductId === product.id ? 'selected' : ''} key={product.id}>
                  <input type="radio" name="voice-match" checked={selectedProductId === product.id} onChange={() => setSelectedProductId(product.id)} />
                  <span>{product.name} · {product.brand || 'Unbranded'} · {currency(product.sellingPrice ?? product.price ?? 0)}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="muted">No matching product found.</p>
          )}
          <label className="voice-quantity">
            Quantity
            <input min="1" step="1" type="number" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.trunc(Number(event.target.value)) || 1))} />
          </label>
          {parsedDetails && (
            <div className="voice-detected">
              <span>Detected for new product</span>
              <dl>
                <div><dt>Name</dt><dd>{parsedDetails.nameQuery || '—'}</dd></div>
                <div><dt>Pack size</dt><dd>{parsedDetails.measurementValue !== undefined ? `${parsedDetails.measurementValue} ${parsedDetails.unitHint ?? ''}` : '—'}</dd></div>
                <div><dt>Package type</dt><dd>{parsedDetails.packageTypeHint ?? '—'}</dd></div>
                <div><dt>Unit cost</dt><dd>{parsedDetails.unitCost !== undefined ? currency(parsedDetails.unitCost) : '—'}</dd></div>
                <div><dt>Profit margin</dt><dd>{parsedDetails.profitMarginPercent !== undefined ? `${parsedDetails.profitMarginPercent}%` : '—'}</dd></div>
                <div><dt>Selling price (MRP)</dt><dd>{parsedDetails.sellingPrice !== undefined ? currency(parsedDetails.sellingPrice) : '—'}</dd></div>
              </dl>
            </div>
          )}
          <div className="voice-actions">
            {selectedProductId && (
              <button type="button" className="save-button" onClick={confirmAdd}><Check size={16} /> Add to basket</button>
            )}
            <button type="button" className="add-product-link" onClick={addAsNewProduct}>
              <Plus size={16} /> Add as new product
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
