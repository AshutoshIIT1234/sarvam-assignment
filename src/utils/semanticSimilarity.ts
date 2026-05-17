const SIMILARITY_MAP: Record<string, Record<string, number>> = {
  car: { vehicle: 0.92, automobile: 0.95, truck: 0.71 },
  vehicle: { car: 0.92, automobile: 0.91, transport: 0.74 },
  fast: { quick: 0.94, rapid: 0.91, swift: 0.89, slow: 0.02 },
  quick: { fast: 0.94, rapid: 0.88, swift: 0.85 },
  large: { big: 0.95, huge: 0.82, enormous: 0.78, small: 0.03 },
  big: { large: 0.95, huge: 0.84, massive: 0.79 },
  good: { great: 0.88, excellent: 0.81, fine: 0.76, bad: 0.02 },
  great: { good: 0.88, excellent: 0.90, wonderful: 0.83 },
  said: { stated: 0.91, mentioned: 0.87, noted: 0.84, exclaimed: 0.72 },
  stated: { said: 0.91, mentioned: 0.89, noted: 0.86 },
  important: { crucial: 0.91, significant: 0.88, critical: 0.86, vital: 0.84 },
  crucial: { important: 0.91, critical: 0.93, vital: 0.88 },
  small: { tiny: 0.87, little: 0.85 },
  tiny: { small: 0.87, little: 0.83 },
  happy: { glad: 0.89, pleased: 0.86, joyful: 0.84, sad: 0.02 },
  glad: { happy: 0.89, pleased: 0.87 },
  sad: { unhappy: 0.91, disappointed: 0.85, happy: 0.02 },
  unhappy: { sad: 0.91, disappointed: 0.83 },
  think: { believe: 0.88, suppose: 0.85, know: 0.03 },
  believe: { think: 0.88, suppose: 0.86, know: 0.72 },
  want: { desire: 0.87, need: 0.85, wish: 0.82 },
  desire: { want: 0.87, need: 0.80, wish: 0.78 },
  need: { want: 0.85, require: 0.89 },
  require: { need: 0.89, demand: 0.86 },
  help: { assist: 0.92, support: 0.88, aid: 0.90 },
  assist: { help: 0.92, support: 0.85, aid: 0.88 },
  support: { help: 0.88, assist: 0.85, back: 0.72 },
  use: { utilize: 0.91, employ: 0.89, apply: 0.87 },
  utilize: { use: 0.91, employ: 0.88, apply: 0.86 },
  employ: { use: 0.89, utilize: 0.88, apply: 0.82 },
  make: { create: 0.88, build: 0.86, do: 0.72 },
  create: { make: 0.88, build: 0.85, produce: 0.89 },
  build: { make: 0.86, create: 0.85, construct: 0.91 },
  see: { view: 0.87, observe: 0.90, look: 0.82 },
  view: { see: 0.87, observe: 0.88, look: 0.79 },
  observe: { see: 0.90, view: 0.88, watch: 0.87 },
  give: { provide: 0.89, offer: 0.87, grant: 0.85 },
  provide: { give: 0.89, offer: 0.86, supply: 0.88 },
  offer: { give: 0.87, provide: 0.86, present: 0.85 },
  tell: { inform: 0.90, explain: 0.88, say: 0.82 },
  inform: { tell: 0.90, explain: 0.87, notify: 0.89 },
  explain: { tell: 0.88, inform: 0.87, describe: 0.86 },
  ask: { question: 0.85, query: 0.87, request: 0.83 },
  question: { ask: 0.85, query: 0.88, inquire: 0.90 },
  query: { ask: 0.87, question: 0.88 },
  answer: { reply: 0.91, respond: 0.89 },
  reply: { answer: 0.91, respond: 0.88 },
  respond: { answer: 0.89, reply: 0.88 },
}

export const PARAPHRASE_THRESHOLD = 0.80

export function semanticSimilarity(a: string, b: string): number {
  const la = a.toLowerCase()
  const lb = b.toLowerCase()

  if (la === lb) return 1.0

  if (SIMILARITY_MAP[la]?.[lb] !== undefined) {
    return SIMILARITY_MAP[la][lb]
  }
  if (SIMILARITY_MAP[lb]?.[la] !== undefined) {
    return SIMILARITY_MAP[lb][la]
  }

  return jaccardSimilarity(la, lb)
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(''))
  const setB = new Set(b.split(''))
  const intersection = new Set([...setA].filter(c => setB.has(c)))
  const union = new Set([...setA, ...setB])
  return union.size === 0 ? 0 : intersection.size / union.size
}