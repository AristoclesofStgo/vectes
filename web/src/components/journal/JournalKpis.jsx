import { formatPct } from '../../lib/format.js'
import { formatDuration } from '../../lib/journalStats.js'

function Tile({ label, value, hint, tone, children }) {
  return (
    <div className="kpi" title={hint}>
      <span className="kpi-label">{label}</span>
      <span className={`kpi-value${tone ? ` ${tone}` : ''}`}>{value}</span>
      {children && <span className="kpi-sub small muted">{children}</span>}
    </div>
  )
}

const tone = (v) => (v > 0 ? 'up' : v < 0 ? 'down' : undefined)
const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)

export default function JournalKpis({ stats, money }) {
  const s = stats
  return (
    <div className="kpi-row journal-kpis">
      <Tile label="Net P&L" value={money(s.net, true)} tone={tone(s.net)} hint="Profit plus swap, commission and taxes">
        {s.returnPct != null ? `${formatPct(s.returnPct)} on the starting balance` : `${s.count} trades`}
      </Tile>
      <Tile label="Win rate" value={pct(s.winRate)} hint="Share of trades that closed with a net gain">
        {s.wins} won · {s.losses} lost
      </Tile>
      <Tile label="Profit factor" value={s.profitFactor == null ? '—' : s.profitFactor.toFixed(2)} hint="Gross profit divided by gross loss; above 1 is profitable">
        {money(s.grossProfit)} / {money(s.grossLoss)}
      </Tile>
      <Tile label="Expectancy" value={s.expectancy == null ? '—' : money(s.expectancy, true)} tone={tone(s.expectancy)} hint="Average net result per trade">
        avg win {s.avgWin == null ? '—' : money(s.avgWin)} · avg loss {s.avgLoss == null ? '—' : money(Math.abs(s.avgLoss))}
      </Tile>
      <Tile label="Max drawdown" value={money(s.maxDrawdown)} hint="Largest fall in equity from a previous high">
        {s.maxDrawdownPct != null ? `${pct(s.maxDrawdownPct)} from the peak` : 'balance not reported yet'}
      </Tile>
      <Tile label="Trades" value={s.count} hint="Closed trades in this account">
        avg hold {formatDuration(s.avgHoldMs)} · {s.longs} long / {s.shorts} short
      </Tile>
    </div>
  )
}
