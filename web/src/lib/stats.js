// Last close and changes from an aligned prices_1d series (USD / native quote)
export function quoteSummary(series) {
  const { close, traded } = series
  const tradedIdx = []
  traded.forEach((t, i) => t && tradedIdx.push(i))
  const last = close[tradedIdx.at(-1)]
  return {
    last,
    change1d: last / close[tradedIdx.at(-2)] - 1,
    change1y: last / close[tradedIdx[0]] - 1,
  }
}

// Summary statistics from daily bars

export function dailyStats(bars, tradingDaysPerYear = 252) {
  if (!bars?.length) return null
  const last = bars.at(-1)
  const prev = bars.at(-2) ?? last
  const first = bars[0]

  let high = -Infinity
  let low = Infinity
  for (const b of bars) {
    if (b.high > high) high = b.high
    if (b.low < low) low = b.low
  }

  const returns = []
  for (let i = 1; i < bars.length; i++) returns.push(Math.log(bars[i].close / bars[i - 1].close))
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1)

  return {
    last: last.close,
    change1d: last.close / prev.close - 1,
    change1y: last.close / first.close - 1,
    high52w: high,
    low52w: low,
    rangePosition: high > low ? (last.close - low) / (high - low) : 0.5,
    volatility: Math.sqrt(variance * tradingDaysPerYear),
    asOf: last.time,
  }
}
