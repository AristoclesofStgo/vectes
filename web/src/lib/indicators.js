// Technical indicators over an array of closes. Each returns an array aligned
// with the input, with null until enough history exists. All are causal (no
// look-ahead), so slicing the output for market replay stays exact.

export function sma(values, period) {
  const out = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

export function ema(values, period) {
  const out = new Array(values.length).fill(null)
  const k = 2 / (period + 1)
  let prev = null
  for (let i = 0; i < values.length; i++) {
    if (i === period - 1) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period
    } else if (i >= period) {
      prev = values[i] * k + prev * (1 - k)
    }
    if (prev != null) out[i] = prev
  }
  return out
}

export function bollinger(values, period = 20, mult = 2) {
  const mid = sma(values, period)
  const upper = new Array(values.length).fill(null)
  const lower = new Array(values.length).fill(null)
  for (let i = period - 1; i < values.length; i++) {
    let variance = 0
    for (let j = i - period + 1; j <= i; j++) variance += (values[j] - mid[i]) ** 2
    const sd = Math.sqrt(variance / period)
    upper[i] = mid[i] + mult * sd
    lower[i] = mid[i] - mult * sd
  }
  return { upper, mid, lower }
}

// Wilder's RSI
export function rsi(values, period = 14) {
  const out = new Array(values.length).fill(null)
  let gain = 0
  let loss = 0
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1]
    const g = Math.max(change, 0)
    const l = Math.max(-change, 0)
    if (i <= period) {
      gain += g / period
      loss += l / period
    } else {
      gain = (gain * (period - 1) + g) / period
      loss = (loss * (period - 1) + l) / period
    }
    if (i >= period) out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  }
  return out
}

// Indicator catalog: id, label, and the categorical slot that colors it
export const INDICATORS = [
  { id: 'sma20', label: 'SMA 20', slot: 1 },
  { id: 'sma50', label: 'SMA 50', slot: 2 },
  { id: 'ema20', label: 'EMA 20', slot: 3 },
  { id: 'bb',    label: 'Bollinger 20, 2', slot: 7 },
  { id: 'rsi',   label: 'RSI 14', slot: 5 },
]

export function computeIndicators(bars, enabled) {
  const closes = bars.map((b) => b.close)
  const out = {}
  if (enabled.sma20) out.sma20 = sma(closes, 20)
  if (enabled.sma50) out.sma50 = sma(closes, 50)
  if (enabled.ema20) out.ema20 = ema(closes, 20)
  if (enabled.bb) out.bb = bollinger(closes, 20, 2)
  if (enabled.rsi) out.rsi = rsi(closes, 14)
  return out
}
