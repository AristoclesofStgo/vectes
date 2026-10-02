const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

export function formatPrice(value) {
  if (value == null) return '—'
  const abs = Math.abs(value)
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6
  return value.toLocaleString('en-US', { minimumFractionDigits: Math.min(digits, 2), maximumFractionDigits: digits })
}

export function formatPct(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value * 100).toFixed(digits)}%`
}

export function formatCompact(value) {
  return value == null ? '—' : compact.format(value)
}

export function formatDate(unixSeconds, opts = { year: 'numeric', month: 'short', day: 'numeric' }) {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts })
}
