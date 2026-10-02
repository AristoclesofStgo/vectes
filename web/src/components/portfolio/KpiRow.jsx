import { formatPct } from '../../lib/format.js'
import Change from '../market/Change.jsx'

function Tile({ label, value, children, hint }) {
  return (
    <div className="kpi" title={hint}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {children && <span className="kpi-sub small">{children}</span>}
    </div>
  )
}

export default function KpiRow({ result, stats, money, isDca }) {
  return (
    <div className="kpi-row">
      <Tile label="Final value" value={money(result.final)} hint="Gain or loss on the capital invested">
        <Change value={result.profit / result.totalInvested} /> <span className="muted">{money(result.profit, true)}</span>
      </Tile>
      {isDca && (
        <Tile label="Total invested" value={money(result.totalInvested)}>
          <span className="muted">{result.contributions} contributions</span>
        </Tile>
      )}
      <Tile label="Time-weighted return" value={formatPct(stats.totalReturn)} hint="Return excluding the timing of contributions">
        <span className="muted">{formatPct(stats.annualized)} annualized</span>
      </Tile>
      <Tile label="Volatility" value={`${(stats.volatility * 100).toFixed(1)}%`} hint="Annualized standard deviation of daily returns">
        <span className="muted">annualized</span>
      </Tile>
      <Tile label="Sharpe ratio" value={stats.sharpe == null ? '—' : stats.sharpe.toFixed(2)} hint="Annualized excess return per unit of volatility">
        <span className="muted">risk-adjusted</span>
      </Tile>
      <Tile label="Max drawdown" value={formatPct(stats.maxDrawdown)} hint="Largest peak-to-trough decline">
        <span className="muted">{result.rebalances} rebalances</span>
      </Tile>
    </div>
  )
}
