// Trading-journal statistics. Pure functions over trades from lib/journal.js
// (sorted by close time); every figure uses net P&L = profit + swap + commission + taxes.

export const netPnl = (t) => t.profit + t.swap + t.commission + t.taxes

// Sessions by UTC opening hour; the UI prints the hours so nothing is implied
export const SESSIONS = [
  { id: 'asia', label: 'Asia', hours: '00–07 UTC', from: 0, to: 7 },
  { id: 'london', label: 'London', hours: '07–12 UTC', from: 7, to: 12 },
  { id: 'overlap', label: 'London + New York', hours: '12–16 UTC', from: 12, to: 16 },
  { id: 'newyork', label: 'New York', hours: '16–21 UTC', from: 16, to: 21 },
  { id: 'late', label: 'After hours', hours: '21–24 UTC', from: 21, to: 24 },
]
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const sessionOf = (ms) => {
  const h = new Date(ms).getUTCHours()
  return SESSIONS.find((s) => h >= s.from && h < s.to).id
}
export const weekdayOf = (ms) => WEEKDAYS[(new Date(ms).getUTCDay() + 6) % 7]
export const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10)

// Balance before the first event. With a reported balance it is solved backwards
// (balance = start + deposits − withdrawals + trading P&L); without one, an account that
// has its deposits on record starts from zero, and anything else has no known base.
export function startingBalance(account, trades, cash = []) {
  const pnl = trades.reduce((s, t) => s + netPnl(t), 0)
  const moved = cash.reduce((s, c) => s + c.amount, 0)
  if (account?.balance != null) {
    const start = Number(account.balance) - pnl - moved
    return Math.abs(start) < 0.005 ? 0 : start
  }
  return cash.length ? 0 : null
}

// Trades and cash flows on one timeline (cash first when they share a timestamp)
function timeline(trades, cash) {
  const events = [
    ...cash.map((c) => ({ ms: c.ms, cash: c.amount })),
    ...trades.map((t) => ({ ms: t.closeMs, pnl: netPnl(t) })),
  ]
  return events.sort((a, b) => a.ms - b.ms || (a.cash != null ? -1 : 1))
}

export function journalStats(trades, start = null, cash = []) {
  const n = trades.length
  let wins = 0, losses = 0, grossProfit = 0, grossLoss = 0, costs = 0, holdMs = 0
  let best = null, worst = null
  let longs = 0, longWins = 0, shorts = 0, shortWins = 0
  let streak = 0, maxWinStreak = 0, maxLossStreak = 0

  for (const t of trades) {
    const pnl = netPnl(t)
    costs += t.swap + t.commission + t.taxes
    holdMs += t.closeMs - t.openMs
    if (pnl > 0) { wins++; grossProfit += pnl } else if (pnl < 0) { losses++; grossLoss -= pnl }
    if (!best || pnl > netPnl(best)) best = t
    if (!worst || pnl < netPnl(worst)) worst = t
    if (t.side === 'buy') { longs++; if (pnl > 0) longWins++ } else { shorts++; if (pnl > 0) shortWins++ }

    if (pnl > 0) streak = streak > 0 ? streak + 1 : 1
    else if (pnl < 0) streak = streak < 0 ? streak - 1 : -1
    else streak = 0
    maxWinStreak = Math.max(maxWinStreak, streak)
    maxLossStreak = Math.max(maxLossStreak, -streak)
  }

  // Drawdown on equity; deposits and withdrawals move the peak with them, so money
  // moved in or out is never mistaken for a gain or a drawdown
  const known = start != null
  let equity = start ?? 0, peak = equity, maxDd = 0, maxDdPct = 0, deposits = 0, withdrawals = 0
  for (const e of timeline(trades, cash)) {
    if (e.cash != null) {
      equity += e.cash
      peak += e.cash
      if (e.cash > 0) deposits += e.cash
      else withdrawals -= e.cash
    } else {
      equity += e.pnl
    }
    peak = Math.max(peak, equity)
    const dd = peak - equity
    if (dd > maxDd) maxDd = dd
    if (known && peak > 0) maxDdPct = Math.max(maxDdPct, dd / peak)
  }
  const capital = (start ?? 0) + deposits

  const net = grossProfit - grossLoss
  return {
    count: n,
    wins,
    losses,
    net,
    grossProfit,
    grossLoss,
    costs,
    winRate: n ? wins / n : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    expectancy: n ? net / n : null,
    avgWin: wins ? grossProfit / wins : null,
    avgLoss: losses ? -grossLoss / losses : null,
    best,
    worst,
    maxDrawdown: maxDd,
    maxDrawdownPct: known ? maxDdPct : null,
    returnPct: known && capital > 0 ? net / capital : null,
    capital: known ? capital : null,
    deposits,
    withdrawals,
    avgHoldMs: n ? holdMs / n : null,
    longs, longWinRate: longs ? longWins / longs : null,
    shorts, shortWinRate: shorts ? shortWins / shorts : null,
    maxWinStreak,
    maxLossStreak,
    start,
    end: known ? (start ?? 0) + deposits - withdrawals + net : null,
  }
}

// Equity after each closed trade and each deposit or withdrawal: [ms, equity, kind, amount].
// An account funded from zero starts at its first deposit rather than at 0.
export function equitySeries(trades, start = 0, cash = []) {
  const events = timeline(trades, cash)
  if (!events.length) return []
  let equity = start
  let i = 0
  const points = []
  if (start === 0 && events[0].cash > 0) {
    equity = events[0].cash
    points.push([events[0].ms, equity, 'cash', events[0].cash])
    i = 1
  } else {
    points.push([Math.min(trades[0]?.openMs ?? Infinity, events[0].ms), equity, 'start', 0])
  }
  for (; i < events.length; i++) {
    const e = events[i]
    equity += e.cash ?? e.pnl
    points.push([e.ms, equity, e.cash != null ? 'cash' : 'trade', e.cash ?? e.pnl])
  }
  return points
}

// Net P&L per UTC calendar day of the close
export function dailyPnl(trades) {
  const days = new Map()
  for (const t of trades) {
    const key = dayKey(t.closeMs)
    const d = days.get(key) ?? { net: 0, count: 0 }
    d.net += netPnl(t)
    d.count++
    days.set(key, d)
  }
  return days
}

// Group trades by a key and summarise each group; `order` fixes the row order when given
export function breakdown(trades, keyOf, order = null) {
  const groups = new Map()
  for (const t of trades) {
    const key = keyOf(t)
    const g = groups.get(key) ?? { key, count: 0, net: 0, wins: 0 }
    const pnl = netPnl(t)
    g.count++
    g.net += pnl
    if (pnl > 0) g.wins++
    groups.set(key, g)
  }
  const rows = [...groups.values()].map((g) => ({ ...g, winRate: g.wins / g.count }))
  if (order) return order.filter((k) => groups.has(k)).map((k) => rows.find((r) => r.key === k))
  return rows.sort((a, b) => b.net - a.net)
}

export function formatDuration(ms) {
  if (ms == null) return '—'
  const min = ms / 60000
  if (min < 1) return `${Math.round(ms / 1000)}s`
  if (min < 60) return `${Math.round(min)}m`
  const h = min / 60
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}
