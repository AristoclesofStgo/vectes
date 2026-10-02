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

// Average bar range just before index i: sets stop and target distances in the asset's own terms
function typicalRange(bars, i, n = 12) {
  let sum = 0
  for (let k = Math.max(0, i - n); k < i; k++) sum += bars[k][2] - bars[k][3]
  return sum / Math.min(n, i) || bars[i][2] - bars[i][3]
}

function generate(candles, seed) {
  const rand = mulberry32(seed)
  const pick = (lo, hi) => lo + rand() * (hi - lo)
  const inBar = (t) => (t + Math.floor(pick(0.05, 0.95) * 14400)) * 1000

  const totalWeight = INSTRUMENTS.reduce((s, i) => s + i.weight, 0)
  const trades = []

  for (let n = 0; n < TRADE_COUNT; n++) {
    let w = rand() * totalWeight
    const inst = INSTRUMENTS.find((i) => (w -= i.weight) < 0) ?? INSTRUMENTS[0]
    const bars = candles[inst.asset]
    const since = bars.at(-1)[0] - LOOKBACK_DAYS * 86400
    const start = Math.max(12, bars.findIndex((b) => b[0] >= since))

    const hold = 1 + Math.floor(rand() ** 2 * 6) // planned holding time: mostly intraday, a few overnight
    const i = start + Math.floor(rand() * (bars.length - start - hold - 1))
    const j = i + hold
    const [t0, , h0, l0] = bars[i]
    const entry = l0 + pick(0.2, 0.8) * (h0 - l0)

    // A modest read on direction: side agrees with the move into the planned exit bar a bit more often
    const withMove = rand() < 0.57
    const side = (bars[j][4] >= entry) === withMove ? 'buy' : 'sell'
    const dir = side === 'buy' ? 1 : -1

    // Every trade has a stop and a target (1.5-2.5R); the candles decide which is hit first
    const risk = typicalRange(bars, i) * pick(0.8, 1.4)
    const stop = entry - dir * risk
    const target = entry + dir * risk * pick(1.5, 2.5)
    let exit = null
    let exitBar = j
    for (let k = i + 1; k <= j && exit == null; k++) {
      const [, , hk, lk] = bars[k]
      const hitStop = dir > 0 ? lk <= stop : hk >= stop
      const hitTarget = dir > 0 ? hk >= target : lk <= target
      if (hitStop) exit = stop // stop first when both fit in one bar: the cautious assumption
      else if (hitTarget) exit = target
      if (exit != null) exitBar = k
    }
    if (exit == null) {
      const [, , hj, lj] = bars[j]
      exit = lj + pick(0.2, 0.8) * (hj - lj)
    }

    const lots = round(pick(...inst.lots), 2) || 0.01
    let profit = (exit - entry) * dir * inst.contract * lots
    if (inst.asset === 'JPY') profit /= exit // quote currency is JPY
    const openTime = inBar(t0)
    const closeTime = Math.max(openTime + 60000, inBar(bars[exitBar][0]))
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
      stop_loss: round(stop, d),
      take_profit: round(target, d),
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

// Candles change every day, so a fixed seed can land on a losing streak. Walk a fixed
// sequence of seeds and keep the first history that looks like a disciplined trader:
// deterministic for a given dataset, and always a believable showcase.
const ACCOUNT_SIZE = 10000

function summary(trades) {
  let equity = 0
  let peak = 0
  let drawdown = 0
  let wins = 0
  for (const t of trades) {
    const pnl = t.profit + t.swap + t.commission
    if (pnl > 0) wins++
    equity += pnl
    peak = Math.max(peak, equity)
    drawdown = Math.min(drawdown, equity - peak)
  }
  return { net: equity / ACCOUNT_SIZE, winRate: wins / trades.length, drawdown: -drawdown / ACCOUNT_SIZE }
}

const believable = ({ net, winRate, drawdown }) =>
  net >= 0.04 && net <= 0.18 && winRate >= 0.45 && winRate <= 0.62 && drawdown <= 0.15

export async function buildDemoTrades({ seed = 20261002, attempts = 200 } = {}) {
  const candles = Object.fromEntries(await Promise.all(
    INSTRUMENTS.map(async (i) => [i.asset, (await loadJson(`candles/4h/${i.asset}.json`)).data]),
  ))
  let fallback = null
  for (let k = 0; k < attempts; k++) {
    const trades = generate(candles, seed + k)
    const stats = summary(trades)
    if (believable(stats)) return trades
    if (!fallback || stats.net > fallback.net) fallback = { trades, net: stats.net }
  }
  return fallback.trades
}
