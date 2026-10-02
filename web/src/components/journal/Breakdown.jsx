import { useMemo, useState } from 'react'
import { breakdown, sessionOf, weekdayOf, SESSIONS, WEEKDAYS } from '../../lib/journalStats.js'

const VIEWS = [
  { id: 'symbol', label: 'Symbol', keyOf: (t) => t.symbol.toUpperCase() },
  { id: 'session', label: 'Session', keyOf: (t) => sessionOf(t.openMs), order: SESSIONS.map((s) => s.id) },
  { id: 'weekday', label: 'Weekday', keyOf: (t) => weekdayOf(t.openMs), order: WEEKDAYS },
  { id: 'side', label: 'Side', keyOf: (t) => (t.side === 'buy' ? 'Long' : 'Short'), order: ['Long', 'Short'] },
]

const sessionLabel = (id) => {
  const s = SESSIONS.find((x) => x.id === id)
  return s ? <>{s.label} <span className="muted small">{s.hours}</span></> : id
}

export default function Breakdown({ trades, money }) {
  const [view, setView] = useState('symbol')
  const v = VIEWS.find((x) => x.id === view)
  const rows = useMemo(() => breakdown(trades, v.keyOf, v.order), [trades, v])
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.net)), 1)

  return (
    <section className="card" aria-label="Results breakdown">
      <div className="card-head">
        <div>
          <h2>Where the P&L comes from</h2>
          <span className="muted small">Net result by group · sessions and weekdays use the opening time</span>
        </div>
        <div className="segmented" role="tablist" aria-label="Group by">
          {VIEWS.map((x) => (
            <button key={x.id} role="tab" aria-selected={view === x.id} className={view === x.id ? 'active' : ''} onClick={() => setView(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
      </div>
      <div className="table-wrap">
        <table className="table breakdown-table">
          <thead>
            <tr>
              <th>{v.label}</th>
              <th className="num">Trades</th>
              <th className="num">Win rate</th>
              <th className="num">Net P&L</th>
              <th className="bar-col" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="asset-id">{view === 'session' ? sessionLabel(r.key) : r.key}</td>
                <td className="num">{r.count}</td>
                <td className="num">{(r.winRate * 100).toFixed(0)}%</td>
                <td className={`num ${r.net > 0 ? 'up' : r.net < 0 ? 'down' : ''}`}>{money(r.net, true)}</td>
                <td className="bar-col" aria-hidden="true">
                  <span className="pnl-bar">
                    <span
                      className={r.net >= 0 ? 'pos' : 'neg'}
                      style={{ width: `${(Math.abs(r.net) / maxAbs) * 50}%` }}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
