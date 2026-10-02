import { loadJson } from './data.js'

// Synthetic MT4 history for demo accounts. Prices come from the real Vectes 4-hour
// candles, so every entry and exit sits inside a bar the visitor can see on the chart.

const INSTRUMENTS = [
  // symbol, asset, weight, contract size (units per lot), lot range, commission per lot (round turn)
  { symbol: 'xauusd', asset: 'XAU', weight: 34, contract: 100, lots: [0.02, 0.15], commission: 0 },
  { symbol: 'eurusd', asset: 'EUR', weight: 16, contract: 100000, lots: [0.1, 0.8], commission: 7 },
  { symbol: 'gbpusd', asset: 'GBP', weight: 12, contract: 100000, lots: [0.1, 0.6], commission: 7 },
  { symbol: 'usdjpy', asset: 'JPY', weight: 8, contract: 100000, lots: [0.1, 0.5], commission: 7 },
  { symbol: 'us500', asset: 'SPX', weight: 12, contract: 10, lots: [0.1, 0.5], commission: 0 },
  { symbol: 'btcusd', asset: 'BTC', weight: 10, contract: 1, lots: [0.01, 0.08], commission: 0 },
  { symbol: 'usousd', asset: 'WTI', weight: 8, contract: 100, lots: [0.5, 2], commission: 0 },
]

const TRADE_COUNT = 140
const LOOKBACK_DAYS = 90

// Small deterministic PRNG so every demo account gets the same, reproducible history
function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d
const decimals = (price) => (price >= 1000 ? 2 : price >= 10 ? 3 : 5)

export async function buildDemoTrades() {
  const rand = mulberry32(20261002)
  const pick = (lo, hi) => lo + rand() * (hi - lo)

  const candles = Object.fromEntries(await Promise.all(
    INSTRUMENTS.map(async (i) => [i.asset, (await loadJson(`candles/4h/${i.asset}.json`)).data]),
  ))

  const totalWeight = INSTRUMENTS.reduce((s, i) => s + i.weight, 0)
  const trades = []

  for (let n = 0; n < TRADE_COUNT; n++) {
    let w = rand() * totalWeight
    const inst = INSTRUMENTS.find((i) => (w -= i.weight) < 0) ?? INSTRUMENTS[0]
    const bars = candles[inst.asset]
    const since = bars.at(-1)[0] - LOOKBACK_DAYS * 86400
    const start = bars.findIndex((b) => b[0] >= since)

    const hold = 1 + Math.floor(rand() ** 2 * 6) // mostly intraday, a few overnight
    const i = start + Math.floor(rand() * (bars.length - start - hold - 1))
    const j = i + hold
    const [t0, , h0, l0] = bars[i]
    const [t1, , h1, l1] = bars[j]

    const entry = l0 + pick(0.2, 0.8) * (h0 - l0)
    const exit = l1 + pick(0.2, 0.8) * (h1 - l1)
    // A modest edge: trade with the move a little more often than against it
    const withMove = rand() < 0.56
    const side = (exit >= entry) === withMove ? 'buy' : 'sell'
    const dir = side === 'buy' ? 1 : -1

    const lots = round(pick(...inst.lots), 2) || 0.01
    let profit = (exit - entry) * dir * inst.contract * lots
    if (inst.asset === 'JPY') profit /= exit // quote currency is JPY
    const openTime = (t0 + Math.floor(pick(0.05, 0.95) * 14400)) * 1000
    const closeTime = Math.max(openTime + 60000, (t1 + Math.floor(pick(0.05, 0.95) * 14400)) * 1000)
    const nights = Math.floor(closeTime / 86400000) - Math.floor(openTime / 86400000)
    const d = decimals(entry)

    trades.push({
      symbol: inst.symbol,
      asset_id: inst.asset,
      side,
      volume: lots,
      open_time: new Date(openTime).toISOString(),
      open_price: round(entry, d),
      close_time: new Date(closeTime).toISOString(),
      close_price: round(exit, d),
      commission: round(-inst.commission * lots, 2),
      taxes: 0,
      swap: round(-nights * lots * pick(0.5, 3), 2),
      profit: round(profit, 2),
      source: 'demo',
    })
  }

  trades.sort((a, b) => a.open_time.localeCompare(b.open_time))
  return trades.map((t, k) => ({ ...t, ticket: String(50001000 + k * 7) }))
}
