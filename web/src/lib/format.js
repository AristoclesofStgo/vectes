const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

export function formatPrice(value) {
  if (value == null) return '—'
  const abs = Math.abs(value)
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6
  return value.toLocaleString('en-US', { minimumFractionDigits: Math.min(digits, 2), maximumFractionDigits: digits })
}

export function formatPct(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return '—'
  const text = Math.abs(value * 100).toFixed(digits)
  // A change that rounds to zero gets no sign (avoids "−0.00%")
  const sign = Number(text) === 0 ? '' : value > 0 ? '+' : '−'
  return `${sign}${text}%`
}

// Decimal places that keep ~5 significant digits for a price of this size
export function pricePrecision(value) {
  const abs = Math.abs(value ?? 0)
  if (abs >= 1000) return 2
  if (abs >= 100) return 2
  if (abs >= 10) return 3
  if (abs >= 1) return 4
  if (abs >= 0.1) return 5
  return 6
}

export function formatNumber(value, precision) {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })
}

export function formatMoney(value, currency, precision = pricePrecision(value)) {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${currency?.symbol ?? ''}${formatNumber(value, precision)}${currency?.suffix ?? ''}`
}

// Sign as a glyph so direction is never conveyed by color alone
export function trendGlyph(value) {
  if (value == null || !Number.isFinite(value) || Number(Math.abs(value * 100).toFixed(2)) === 0) return ''
  return value > 0 ? '▲' : '▼'
}

export function formatCompact(value) {
  return value == null ? '—' : compact.format(value)
}

export function formatDate(unixSeconds, opts = { year: 'numeric', month: 'short', day: 'numeric' }) {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts })
}
