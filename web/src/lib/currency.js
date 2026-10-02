// Cross-currency pricing. Every convertible asset is quoted in USD; to price it
// in another unit we multiply by that unit's "units per USD" at the same bar.

export const CURRENCIES = [
  { id: 'USD', label: 'US Dollar',     symbol: '$' },
  { id: 'EUR', label: 'Euro',          symbol: '€' },
  { id: 'GBP', label: 'British Pound', symbol: '£' },
  { id: 'JPY', label: 'Japanese Yen',  symbol: '¥' },
  { id: 'CHF', label: 'Swiss Franc',   symbol: 'CHF ' },
  { id: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { id: 'MXN', label: 'Mexican Peso',  symbol: 'MX$' },
  { id: 'BRL', label: 'Brazilian Real', symbol: 'R$' },
  { id: 'XAU', label: 'Gold (troy oz)', symbol: '', suffix: ' oz' },
  { id: 'BTC', label: 'Bitcoin',       symbol: '₿' },
]

// Currencies, yields and indices of indices make no sense re-denominated
export function isConvertible(asset, currencyId) {
  return asset.quote === 'usd_per_unit' && asset.category !== 'fx' && asset.id !== currencyId
}

export function rowsToBars(rows) {
  return rows.map(([time, open, high, low, close, volume]) => ({ time, open, high, low, close, volume }))
}

// Rate lookup: for each time, the latest known units-per-USD (as-of join)
function rateAt(rateBars, quote) {
  const times = rateBars.map((b) => b.time)
  const rates = rateBars.map((b) => (quote === 'units_per_usd' ? b.close : 1 / b.close))
  return (t) => {
    let lo = 0
    let hi = times.length - 1
    if (t < times[0]) return rates[0]
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (times[mid] <= t) lo = mid
      else hi = mid - 1
    }
    return rates[lo]
  }
}

export function convertBars(bars, rateBars, rateQuote) {
  if (!rateBars) return bars
  const rate = rateAt(rateBars, rateQuote)
  return bars.map((b) => {
    const k = rate(b.time)
    return { ...b, open: b.open * k, high: b.high * k, low: b.low * k, close: b.close * k }
  })
}

export function currencyById(id) {
  return CURRENCIES.find((c) => c.id === id) ?? CURRENCIES[0]
}
