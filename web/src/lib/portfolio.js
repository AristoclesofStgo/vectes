// Portfolio configuration: presets, benchmarks and URL (de)serialization

export const DEFAULT_WEIGHTS = { SPX: 30, AGG: 20, XAU: 20, BTC: 20, ETH: 10 }

export const PRESETS = [
  { id: 'diversified', label: 'Diversified', weights: { SPX: 30, AGG: 20, XAU: 20, BTC: 20, ETH: 10 } },
  { id: '6040', label: '60/40', weights: { SPX: 60, AGG: 40 } },
  { id: 'crypto', label: 'Crypto basket', weights: { BTC: 50, ETH: 25, SOL: 10, XRP: 10, ADA: 5 } },
  { id: 'hard-assets', label: 'Hard assets', weights: { XAU: 40, XAG: 15, XPT: 10, BTC: 20, WTI: 15 } },
  { id: 'equal', label: 'Equal weight', weights: null },  // filled from the catalog
]

// Benchmarks run with the same capital, currency, period and contribution plan
export const BENCHMARKS = [
  { id: '6040', label: '60/40 S&P 500 / Bonds', weights: { SPX: 0.6, AGG: 0.4 }, rebalance: 'monthly' },
  { id: 'SPX',  label: 'S&P 500',               weights: { SPX: 1 }, rebalance: 'none' },
  { id: 'BTC',  label: 'Bitcoin',               weights: { BTC: 1 }, rebalance: 'none' },
  { id: 'XAU',  label: 'Gold',                  weights: { XAU: 1 }, rebalance: 'none' },
  { id: 'EW',   label: 'Equal weight (all)',    weights: null, rebalance: 'monthly' },
]
export const MAX_BENCHMARKS = 2

const round2 = (x) => Math.round(x * 100) / 100

export function equalWeights(ids) {
  const w = round2(100 / ids.length)
  return Object.fromEntries(ids.map((id) => [id, w]))
}

// w=BTC20.ETH10.SPX30 — compact and readable in a shared link.
// Assets at 0% are kept so a slider dragged to zero does not drop its row.
export function encodeWeights(weights) {
  return Object.entries(weights)
    .filter(([, v]) => v != null && v >= 0)
    .map(([id, v]) => `${id}${round2(v)}`)
    .join('.')
}

export function decodeWeights(text, validIds) {
  if (!text) return null
  const out = {}
  for (const [, id, value] of text.matchAll(/([A-Z]+)(\d+(?:\.\d+)?)/g)) {
    if (validIds.has(id)) out[id] = Math.min(100, Number(value))
  }
  return Object.keys(out).length ? out : null
}

export function totalWeight(weights) {
  return Object.values(weights).reduce((a, b) => a + b, 0)
}

/** Percent weights -> fractions; scales down proportionally when over 100% */
export function toFractions(weights) {
  const total = totalWeight(weights)
  const scale = total > 100 ? 100 / total : 1
  return Object.fromEntries(Object.entries(weights).map(([id, v]) => [id, (v * scale) / 100]))
}
