import { useState } from 'react'
import { formatPct } from '../../lib/format.js'
import Change from '../market/Change.jsx'

const COLUMNS = [
  { id: 'totalReturn', label: 'Return', hint: 'Price change over the selected period' },
  { id: 'volatility', label: 'Volatility', hint: 'Annualized standard deviation of daily returns' },
  { id: 'sharpe', label: 'Sharpe', hint: 'Annualized return above the risk-free rate, per unit of volatility' },
  { id: 'maxDrawdown', label: 'Max DD', hint: 'Largest peak-to-trough decline' },
  { id: 'beta', label: 'Beta', hint: 'Sensitivity to the S&P 500 (1 = moves with it)', sm: true },
  { id: 'corrSpx', label: 'Corr. S&P', hint: 'Correlation of daily returns with the S&P 500', sm: true },
]

function cell(id, v) {
  if (v == null) return '—'
  if (id === 'totalReturn') return <Change value={v} />
  if (id === 'volatility') return `${(v * 100).toFixed(1)}%`
  if (id === 'maxDrawdown') return formatPct(v, 1)
  return v.toFixed(2)
}

// Sortable table view of every statistic behind the charts
export default function StatsTable({ stats, names }) {
  const [sort, setSort] = useState({ id: 'totalReturn', dir: -1 })
  const rows = [...stats].sort((a, b) => ((a[sort.id] ?? -Infinity) - (b[sort.id] ?? -Infinity)) * sort.dir)
  const toggle = (id) => setSort((s) => ({ id, dir: s.id === id ? -s.dir : -1 }))

  return (
    <section className="card" aria-label="Asset statistics">
      <div className="card-head"><h2>Asset statistics</h2><span className="muted small">Click a column to sort</span></div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Asset</th>
              {COLUMNS.map((c) => (
                <th key={c.id} className={`num${c.sm ? ' hide-sm' : ''}`} title={c.hint} aria-sort={sort.id === c.id ? (sort.dir < 0 ? 'descending' : 'ascending') : 'none'}>
                  <button className="sort" onClick={() => toggle(c.id)}>
                    {c.label}{sort.id === c.id ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><span className="asset-id">{r.id}</span> <span className="muted hide-sm">{names[r.id]}</span></td>
                {COLUMNS.map((c) => <td key={c.id} className={`num${c.sm ? ' hide-sm' : ''}`}>{cell(c.id, r[c.id])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
