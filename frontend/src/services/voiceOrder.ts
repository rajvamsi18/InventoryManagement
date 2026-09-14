import type { Product } from './database'

export type ParsedVoiceQuery = { quantity: number; nameQuery: string }

const numberWords: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ఒకటి: 1, రెండు: 2, మూడు: 3, నాలుగు: 4, ఐదు: 5, ఆరు: 6, ఏడు: 7, ఎనిమిది: 8, తొమ్మిది: 9, పది: 10,
}

const fillerWords = new Set([
  'packet', 'packets', 'pcs', 'piece', 'pieces', 'pack', 'packs', 'of', 'a', 'an', 'the', 'with', 'and', 'is', 'at', 'for',
  'rupees', 'rs', 'inr', 'bag', 'bags', 'box', 'boxes', 'bottle', 'bottles', 'case', 'cases', 'profit', 'margin', 'percent',
  'unit', 'price', 'cost', 'purchase', 'retail', 'sale', 'selling', 'mrp', 'around', 'there', 'are', 'about', 'approximately', 'roughly',
])

// Extracts a spoken quantity (digit, unit-suffixed digit, or number word) and returns the remaining words as the product name query.
export function parseVoiceQuery(rawText: string): ParsedVoiceQuery {
  const words = rawText.trim().toLowerCase().split(/\s+/).filter(Boolean)
  let quantity = 1
  let quantityFound = false
  const nameWords: string[] = []
  for (const word of words) {
    const digitMatch = word.match(/^(\d+)(kg|kgs|g|grams|gram|ml|l|litre|liter|litres|pack|packs|packet|packets|pcs|piece|pieces)?$/)
    if (digitMatch) { quantity = Number(digitMatch[1]); quantityFound = true; continue }
    if (!quantityFound && numberWords[word] !== undefined) { quantity = numberWords[word]; quantityFound = true; continue }
    if (fillerWords.has(word)) continue
    nameWords.push(word)
  }
  return { quantity: quantity > 0 ? quantity : 1, nameQuery: nameWords.join(' ').trim() }
}

const unitAliases: Record<string, string> = {
  kg: 'Kilograms', kgs: 'Kilograms', kilogram: 'Kilograms', kilograms: 'Kilograms',
  g: 'Grams', gram: 'Grams', grams: 'Grams',
  l: 'Litres', litre: 'Litres', litres: 'Litres', liter: 'Litres', liters: 'Litres',
  ml: 'Millilitres', millilitre: 'Millilitres', millilitres: 'Millilitres',
}

const packageTypeAliases: Record<string, string> = {
  bag: 'Bag', bags: 'Bag', piece: 'Piece', pieces: 'Piece', pcs: 'Piece', pack: 'Pack', packs: 'Pack',
  packet: 'Pack', packets: 'Pack', case: 'Case', cases: 'Case', box: 'Box', boxes: 'Box', bottle: 'Bottle', bottles: 'Bottle',
}

export type ParsedSpokenOrder = ParsedVoiceQuery & {
  measurementValue?: number
  unitHint?: string
  packageTypeHint?: string
  unitCost?: number
  profitMarginPercent?: number
  sellingPrice?: number
}

// Extends parseVoiceQuery for new-product creation: pulls out pack size/unit, package type, cost,
// profit margin, and selling price phrases before parsing the remaining quantity and name.
export function parseSpokenOrder(rawText: string): ParsedSpokenOrder {
  let text = ` ${rawText.trim().toLowerCase()} `
  // Some STT engines (e.g. iOS dictation) leave small quantities as words ("four kgs") instead of
  // digits, which the measurement/quantity regexes below can't match — normalize them up front.
  text = ` ${text.split(/\s+/).map((word) => (numberWords[word] !== undefined ? String(numberWords[word]) : word)).join(' ')} `

  // STT output often inserts a currency word/symbol ("rs"/"rupees"/"\u20b9") between "of/is" and the number.
  const currencyGap = '(?:of|is)?\\s*(?:rs\\.?|rupees|inr|\\u20b9)?\\s*'

  let unitCost: number | undefined
  const unitCostMatch = text.match(new RegExp(`(?:unit\\s*(?:cost|price)|cost\\s*price|purchase\\s*price)\\s*${currencyGap}(\\d+(?:\\.\\d+)?)`))
  if (unitCostMatch) { unitCost = Number(unitCostMatch[1]); text = text.replace(unitCostMatch[0], ' ') }

  let profitMarginPercent: number | undefined
  const marginAfterMatch = text.match(/(?:profit\s*)?margin\s*(?:of|is)?\s*(\d+(?:\.\d+)?)\s*(?:%|percent)?/)
  const marginBeforeMatch = !marginAfterMatch ? text.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)\s*(?:profit\s*)?margin/) : null
  const marginMatch = marginAfterMatch ?? marginBeforeMatch
  if (marginMatch) { profitMarginPercent = Number(marginMatch[1]); text = text.replace(marginMatch[0], ' ') }

  let sellingPrice: number | undefined
  const sellingMatch = text.match(new RegExp(`(?:selling\\s*price|sale\\s*price|sell\\s*price|retail\\s*price|mrp)\\s*${currencyGap}(\\d+(?:\\.\\d+)?)`))
  if (sellingMatch) { sellingPrice = Number(sellingMatch[1]); text = text.replace(sellingMatch[0], ' ') }

  let measurementValue: number | undefined
  let unitHint: string | undefined
  const measureMatch = text.match(/(\d+(?:\.\d+)?)\s*(kgs?|kilograms?|grams?|g|mls?|millilitres?|litres?|liters?|l)\b/)
  if (measureMatch) {
    measurementValue = Number(measureMatch[1])
    unitHint = unitAliases[measureMatch[2]] ?? measureMatch[2]
    text = text.replace(measureMatch[0], ' ')
  }

  let packageTypeHint: string | undefined
  const packageMatch = text.match(/\b(bags?|pieces?|pcs|packs?|packets?|cases?|boxes?|bottles?)\b/)
  if (packageMatch) { packageTypeHint = packageTypeAliases[packageMatch[1]]; text = text.replace(packageMatch[0], ' ') }

  if (sellingPrice === undefined && unitCost !== undefined && profitMarginPercent !== undefined) {
    sellingPrice = Number((unitCost * (1 + profitMarginPercent / 100)).toFixed(2))
  }

  // Strip any stray currency symbol left behind (e.g. an amount phrase the regexes above didn't match).
  text = text.replace(/\u20b9/g, ' ')

  return { ...parseVoiceQuery(text), measurementValue, unitHint, packageTypeHint, unitCost, profitMarginPercent, sellingPrice }
}

export type ProductMatch = { product: Product; score: number }

// Ranks products by how many query words appear in their searchable text, with a boost for a matching name prefix.
export function matchProducts(products: Product[], query: string, limit = 3): ProductMatch[] {
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!queryWords.length) return []
  const scored = products
    .map((product) => {
      const haystack = [product.name, product.brand, product.category, product.unit, product.packageType]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      const matchedWords = queryWords.filter((word) => haystack.includes(word)).length
      let score = matchedWords / queryWords.length
      if (product.name.toLowerCase().startsWith(queryWords[0])) score += 0.25
      return { product, score }
    })
    .filter((entry) => entry.score > 0)
  scored.sort((first, second) => second.score - first.score)
  return scored.slice(0, limit)
}
