// Portfolio backtesting on the aligned daily calendar (prices_1d.json).
// Everything is valued in the viewer's currency; non-trading days carry the
// last close forward, so returns are measured per calendar day (365/yr).

const DAYS_PER_YEAR = 365
const THRESHOLD_BAND = 0.05

export const STRATEGIES = [
  { id: 'lump', label: 'Lump sum' },
  { id: 'dca-weekly', label: 'DCA weekly' },
  { id: 'dca-monthly', label: 'DCA monthly' },
]

export const REBALANCING = [
  { id: 'none', label: 'Never' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'threshold', label: '±5% drift' },
]

export const PERIODS = [
  { id: '3m', label: '3M', days: 91 },
  { id: '6m', label: '6M', days: 182 },
  { id: '1y', label: '1Y', days: 365 },
]

// USD value of one unit of an investable asset
function usdPrice(asset, close) {
  return asset.quote === 'units_per_usd' ? 1 / close : close
}

/** Units of `currencyId` per USD, per day (1 for USD) */
export function currencyRates(prices, assetsById, currencyId) {
  const n = prices.time.length
  if (!currencyId || currencyId === 'USD') return new Array(n).fill(1)
  const a = assetsById[currencyId]
  return prices.series[currencyId].close.map((c) => 1 / usdPrice(a, c))
}

/** Daily price of each asset in the target currency */
export function localPrices(prices, assetsById, ids, rates) {
  const out = {}
  for (const id of ids) {
    out[id] = prices.series[id].close.map((c, t) => usdPrice(assetsById[id], c) * rates[t])
  }
  return out
}

function contributionDays(times, start, strategy) {
  if (strategy === 'lump') return [start]
  const days = []
  if (strategy === 'dca-weekly') {
    for (let t = start; t < times.length; t += 7) days.push(t)
  } else {
    let lastMonth = -1
    for (let t = start; t < times.length; t++) {
      const m = new Date(times[t] * 1000).getUTCMonth()
      if (m !== lastMonth) { days.push(t); lastMonth = m }
    }
  }
  return days
}

function isRebalanceDay(times, t, rule) {
  if (rule !== 'monthly' && rule !== 'quarterly') return false
  const d = new Date(times[t] * 1000)
  const prev = new Date(times[t - 1] * 1000)
  if (d.getUTCMonth() === prev.getUTCMonth()) return false
  return rule === 'monthly' || d.getUTCMonth() % 3 === 0
}

/**
 * Simulate a portfolio.
 * weights: { assetId: fraction } — whatever is left of 1 is held as cash.
 */
export function simulate({ times, prices, weights, capital, strategy = 'lump', rebalance = 'none', start = 0 }) {
  const ids = Object.keys(weights).filter((id) => weights[id] > 0)
  const cashWeight = Math.max(0, 1 - ids.reduce((s, id) => s + weights[id], 0))
  const flows = contributionDays(times, start, strategy)
  const installment = capital / flows.length
  const flowAt = new Map(flows.map((t) => [t, installment]))

  const units = Object.fromEntries(ids.map((id) => [id, 0]))
  const pnl = Object.fromEntries(ids.map((id) => [id, 0]))
  let cash = 0
  let invested = 0
  let prevValue = 0
  let index = 1
  let rebalances = 0

  const value = []
  const investedSeries = []
  const twr = []
  const dailyReturns = []

  const holdingsValue = (t) => ids.reduce((s, id) => s + units[id] * prices[id][t], 0)
  const setToTarget = (total, t) => {
    for (const id of ids) units[id] = (total * weights[id]) / prices[id][t]
    cash = total * cashWeight
  }

  for (let t = start; t < times.length; t++) {
    // Mark-to-market P&L since yesterday, before any trade today
    if (t > start) for (const id of ids) pnl[id] += units[id] * (prices[id][t] - prices[id][t - 1])

    const flow = flowAt.get(t) ?? 0
    if (flow) {
      for (const id of ids) units[id] += (flow * weights[id]) / prices[id][t]
      cash += flow * cashWeight
      invested += flow
    }

    if (t > start) {
      let rebalanceNow = isRebalanceDay(times, t, rebalance)
      if (rebalance === 'threshold') {
        const total = holdingsValue(t) + cash
        rebalanceNow = ids.some((id) => Math.abs((units[id] * prices[id][t]) / total - weights[id]) > THRESHOLD_BAND)
      }
      if (rebalanceNow) {
        setToTarget(holdingsValue(t) + cash, t)
        rebalances++
      }
    }

    const v = holdingsValue(t) + cash
    if (t > start) {
      // Time-weighted return strips out the day's new contribution
      const r = prevValue > 0 ? (v - flow) / prevValue - 1 : 0
      index *= 1 + r
      dailyReturns.push(r)
    }
    value.push(v)
    investedSeries.push(invested)
    twr.push(index)
    prevValue = v
  }

  const final = value.at(-1)
  const finalWeights = Object.fromEntries(ids.map((id) => [id, (units[id] * prices[id][times.length - 1]) / final]))
  return {
    times: times.slice(start),
    value, invested: investedSeries, twr, dailyReturns,
    final, totalInvested: invested, profit: final - invested,
    pnl, finalWeights, cashFinal: cash, rebalances, contributions: flows.length,
  }
}

export function metrics(result, riskFree = 0) {
  const r = result.dailyReturns
  const days = r.length
  const mean = r.reduce((a, b) => a + b, 0) / days
  const variance = r.reduce((a, x) => a + (x - mean) ** 2, 0) / (days - 1)
  // Treat floating-point noise (e.g. gold measured in gold) as zero volatility
  const rawVol = Math.sqrt(variance * DAYS_PER_YEAR)
  const volatility = rawVol < 1e-9 ? 0 : rawVol
  const totalReturn = result.twr.at(-1) - 1
  const annualized = (1 + totalReturn) ** (DAYS_PER_YEAR / days) - 1

  let peak = -Infinity
  let maxDrawdown = 0
  const drawdown = result.twr.map((x) => {
    peak = Math.max(peak, x)
    const dd = x / peak - 1
    maxDrawdown = Math.min(maxDrawdown, dd)
    return dd
  })

  return {
    totalReturn,
    annualized,
    volatility,
    sharpe: volatility > 0 ? (annualized - riskFree) / volatility : null,
    maxDrawdown,
    drawdown,
    moneyReturn: result.profit / result.totalInvested,
    bestDay: Math.max(...r),
    worstDay: Math.min(...r),
  }
}

// ── Efficient frontier (constant-weight approximation) ─────────────────

function dailyLogReturns(series, start) {
  const out = []
  for (let t = start + 1; t < series.length; t++) out.push(series[t] / series[t - 1] - 1)
  return out
}

/**
 * Random long-only portfolios over `ids`, using the annualized mean and
 * covariance of daily returns. Assumes weights are held constant (daily rebalanced).
 */
export function frontier({ prices, ids, start, samples = 2500, riskFree = 0, seed = 7 }) {
  const rets = ids.map((id) => dailyLogReturns(prices[id], start))
  const k = ids.length
  const n = rets[0].length
  const mu = rets.map((r) => (r.reduce((a, b) => a + b, 0) / n) * DAYS_PER_YEAR)
  const cov = ids.map((_, i) => ids.map((_, j) => {
    let s = 0
    for (let t = 0; t < n; t++) s += (rets[i][t] - mu[i] / DAYS_PER_YEAR) * (rets[j][t] - mu[j] / DAYS_PER_YEAR)
    return (s / (n - 1)) * DAYS_PER_YEAR
  }))

  // Deterministic PRNG so the cloud does not reshuffle on every render
  let state = seed
  const rand = () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return (state + 0.5) / 4294967296
  }

  const evaluate = (w) => {
    let ret = 0
    let variance = 0
    for (let i = 0; i < k; i++) {
      ret += w[i] * mu[i]
      for (let j = 0; j < k; j++) variance += w[i] * w[j] * cov[i][j]
    }
    const vol = Math.sqrt(Math.max(variance, 0))
    return { ret, vol, sharpe: vol > 0 ? (ret - riskFree) / vol : 0 }
  }

  const points = []
  for (let s = 0; s < samples; s++) {
    // Uniform weights (normalized exponentials) for half the samples; the other
    // half is skewed toward concentrated portfolios so the cloud reaches the edges
    const alpha = s % 2 ? 1 : 0.35
    const raw = ids.map(() => (-Math.log(rand())) ** (1 / alpha))
    const sum = raw.reduce((a, b) => a + b, 0)
    const w = raw.map((x) => x / sum)
    points.push({ w, ...evaluate(w) })
  }
  // Single-asset corners
  ids.forEach((_, i) => {
    const w = ids.map((__, j) => (i === j ? 1 : 0))
    points.push({ w, ...evaluate(w) })
  })

  const maxSharpe = points.reduce((a, b) => (b.sharpe > a.sharpe ? b : a))
  const minVol = points.reduce((a, b) => (b.vol < a.vol ? b : a))
  return { ids, points, maxSharpe, minVol, evaluate }
}
