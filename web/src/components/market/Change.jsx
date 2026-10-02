import { formatPct, trendGlyph } from '../../lib/format.js'

// Signed percentage with a ▲/▼ glyph so direction never relies on color alone
export default function Change({ value, className = '' }) {
  const tone = value > 0 && trendGlyph(value) ? 'up' : value < 0 && trendGlyph(value) ? 'down' : 'muted'
  return (
    <span className={`change ${tone} ${className}`}>
      {trendGlyph(value) && <span className="glyph" aria-hidden="true">{trendGlyph(value)}</span>}
      {formatPct(value)}
    </span>
  )
}
