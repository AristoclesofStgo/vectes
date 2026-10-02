// Cross-asset statistics on a common US-trading-day calendar.
// Crypto trades 24/7 and futures/FX skip weekends, so returns are sampled on
// the days the S&P 500 traded; weekend crypto moves fold into Monday's return.

import { isConvertible } from './currency.js'

export const TRADING_DAYS = 252
const REFERENCE = 'SPX'

/** Closes per asset on reference days, in `currencyId` where the asset is convertible */
export function sampleCloses(prices, assets, currencyId, start) {
  const rates = currencyId === 'USD' ? null : unitsPerUsd(prices, assets, currencyId)
  const traded = prices.series[REFERENCE].traded
  const days = []
  for (let t = start; t < prices.time.length; t++) if (traded[t]) days.push(t)

  const closes = {}
  for (const a of assets) {
    const c = prices.series[a.id].close
    const convert = rates && isConvertible(a, currencyId)
    closes[a.id] = days.map((t) => (convert ? c[t] * rates[t] : c[t]))
  }
  return { times: days.map((t) => prices.time[t]), closes }
}

function unitsPerUsd(prices, assets, currencyId) {
  const a = assets.find((x) => x.id === currencyId)
  const c = prices.series[currencyId].close
  return c.map((v) => (a.quote === 'units_per_usd' ? v : 1 / v))
}

export function returnsOf(closes) {
  const out = {}
  for (const [id, c] of Object.entries(closes)) {
    out[id] = c.slice(1).map((v, i) => v / c[i] - 1)
  }
  return out
}

function mean(x) {
  return x.reduce((a, b) => a + b, 0) / x.length
}

export function correlation(x, y) {
  const mx = mean(x)
  const my = mean(y)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  // A flat series (e.g. gold priced in gold) has no meaningful correlation
  const flat = 1e-18 * x.length
  return sxx > flat && syy > flat ? sxy / Math.sqrt(sxx * syy) : null
}

export function correlationMatrix(returns, ids) {
  return ids.map((a) => ids.map((b) => (a === b ? 1 : correlation(returns[a], returns[b]))))
}

export function rollingCorrelation(x, y, window) {
  const out = new Array(x.length).fill(null)
  for (let i = window - 1; i < x.length; i++) {
    out[i] = correlation(x.slice(i - window + 1, i + 1), y.slice(i - window + 1, i + 1))
  }
  return out
}

/** Per-asset risk/return summary; beta and correlation are measured against the S&P 500 */
export function assetStats(closes, returns, ids, riskFree = 0) {
  const ref = returns[REFERENCE]
  const refVar = variance(ref)
  return ids.map((id) => {
    const c = closes[id]
    const r = returns[id]
    const totalReturn = c.at(-1) / c[0] - 1
    const annualized = (1 + totalReturn) ** (TRADING_DAYS / r.length) - 1
    const vol = Math.sqrt(variance(r) * TRADING_DAYS)
    let peak = -Infinity
    let maxDrawdown = 0
    for (const v of c) {
      peak = Math.max(peak, v)
      maxDrawdown = Math.min(maxDrawdown, v / peak - 1)
    }
    return {
      id,
      totalReturn,
      annualized,
      volatility: vol,
      sharpe: vol > 1e-9 ? (annualized - riskFree) / vol : null,
      maxDrawdown,
      beta: refVar > 0 ? covariance(r, ref) / refVar : null,
      corrSpx: correlation(r, ref),
    }
  })
}

function variance(x) {
  const m = mean(x)
  return x.reduce((a, v) => a + (v - m) ** 2, 0) / (x.length - 1)
}

function covariance(x, y) {
  const mx = mean(x)
  const my = mean(y)
  let s = 0
  for (let i = 0; i < x.length; i++) s += (x[i] - mx) * (y[i] - my)
  return s / (x.length - 1)
}

// ── Market ratios (USD closes; a day counts only if every leg traded) ──────

export const RATIOS = [
  { id: 'gold-silver', label: 'Gold / Silver', legs: ['XAU', 'XAG'], unit: 'oz of silver per oz of gold', fn: (a, b) => a / b, digits: 1 },
  { id: 'brent-wti', label: 'Brent – WTI spread', legs: ['BRENT', 'WTI'], unit: 'USD per barrel', fn: (a, b) => a - b, digits: 2, prefix: '$' },
  { id: 'btc-eth', label: 'BTC / ETH', legs: ['BTC', 'ETH'], unit: 'ETH per bitcoin', fn: (a, b) => a / b, digits: 1 },
  { id: 'btc-gold', label: 'Bitcoin in gold', legs: ['BTC', 'XAU'], unit: 'troy oz per bitcoin', fn: (a, b) => a / b, digits: 2 },
  { id: 'spx-gold', label: 'S&P 500 in gold', legs: ['SPX', 'XAU'], unit: 'troy oz per index unit', fn: (a, b) => a / b, digits: 3 },
  { id: 'platinum-gold', label: 'Platinum / Gold', legs: ['XPT', 'XAU'], unit: 'ratio', fn: (a, b) => a / b, digits: 3 },
]

export function ratioSeries(prices, ratio, start) {
  const [a, b] = ratio.legs.map((id) => prices.series[id])
  const times = []
  const values = []
  for (let t = start; t < prices.time.length; t++) {
    if (!a.traded[t] || !b.traded[t]) continue
    times.push(prices.time[t])
    values.push(ratio.fn(a.close[t], b.close[t]))
  }
  return { times, values }
}
