import { formatCompact, formatNumber } from '../../lib/format.js'
import { INDICATORS } from '../../lib/indicators.js'
import Change from './Change.jsx'
import AssetLogo from '../AssetLogo.jsx'

function Key({ slot }) {
  return <span className="line-key" style={{ background: `var(--series-${slot})` }} aria-hidden="true" />
}

// OHLC + indicator readout for the hovered (or latest) bar, TradingView-style
export default function ChartLegend({ asset, interval, currencyId, bar, prevBar, values, compare, precision, showVolume }) {
  if (!asset || !bar) return null
  const fmt = (v) => formatNumber(v, precision)
  const change = prevBar ? bar.close / prevBar.close - 1 : bar.close / bar.open - 1

  return (
    <div className="chart-legend">
      <div className="legend-title">
        <AssetLogo id={asset.id} size={18} />
        <strong>{currencyId ? `${asset.id}/${currencyId}` : asset.pair}</strong>
        <span className="muted"> · {asset.name} · {interval.toUpperCase()}</span>
      </div>
      <div className="legend-ohlc">
        <span><span className="muted">O</span> {fmt(bar.open)}</span>
        <span><span className="muted">H</span> {fmt(bar.high)}</span>
        <span><span className="muted">L</span> {fmt(bar.low)}</span>
        <span><span className="muted">C</span> {fmt(bar.close)}</span>
        <Change value={change} />
        {showVolume && bar.volume ? <span><span className="muted">Vol</span> {formatCompact(bar.volume)}</span> : null}
      </div>
      <div className="legend-indicators">
        {INDICATORS.filter((ind) => values[ind.id] !== undefined).map((ind) => (
          <span key={ind.id}>
            <Key slot={ind.slot} />
            <span className="muted">{ind.label}</span>{' '}
            {ind.id === 'bb'
              ? `${fmt(values.bb?.upper)} / ${fmt(values.bb?.lower)}`
              : ind.id === 'rsi' ? formatNumber(values.rsi, 1) : fmt(values[ind.id])}
          </span>
        ))}
        {compare && (
          <span><Key slot={4} /><span className="muted">{compare.label}</span> {fmt(compare.value)}</span>
        )}
      </div>
    </div>
  )
}
