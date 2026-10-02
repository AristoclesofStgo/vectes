import { formatPct } from '../../lib/format.js'
import { BENCHMARKS } from '../../lib/portfolio.js'
import Change from '../market/Change.jsx'

export function BreakdownTable({ result, targets, assetsById, money }) {
  const rows = Object.keys(result.pnl)
    .map((id) => ({
      id,
      name: assetsById[id]?.name ?? id,
      target: targets[id] ?? 0,
      final: result.finalWeights[id],
      pnl: result.pnl[id],
    }))
    .sort((a, b) => b.pnl - a.pnl)
  const cashTarget = Math.max(0, 1 - Object.values(targets).reduce((a, b) => a + b, 0))

  return (
    <section className="card" aria-label="Holdings breakdown">
      <div className="card-head"><h2>Holdings</h2><span className="muted small">Profit and loss by asset</span></div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Asset</th>
              <th className="num">Target</th>
              <th className="num">Final</th>
              <th className="num">P&amp;L</th>
              <th className="num">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><span className="asset-id">{r.id}</span> <span className="muted hide-sm">{r.name}</span></td>
                <td className="num">{formatPct(r.target, 1).replace('+', '')}</td>
                <td className="num">{formatPct(r.final, 1).replace('+', '')}</td>
                <td className="num">{money(r.pnl, true)}</td>
                <td className="num"><Change value={r.pnl / result.totalInvested} /></td>
              </tr>
            ))}
            {cashTarget > 0.0001 && (
              <tr>
                <td><span className="asset-id">Cash</span></td>
                <td className="num">{formatPct(cashTarget, 1).replace('+', '')}</td>
                <td className="num">{formatPct(result.cashFinal / result.final, 1).replace('+', '')}</td>
                <td className="num">{money(0, true)}</td>
                <td className="num muted">0.00%</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function BenchmarkTable({ portfolio, benchmarks, money }) {
  const rows = [
    { id: 'portfolio', label: 'Your portfolio', ...portfolio },
    ...BENCHMARKS.map((b) => ({ id: b.id, label: b.label, ...benchmarks[b.id] })),
  ]
  return (
    <section className="card" aria-label="Comparison with benchmarks">
      <div className="card-head"><h2>Versus benchmarks</h2><span className="muted small">Same capital, period and strategy</span></div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Strategy</th>
              <th className="num">Final value</th>
              <th className="num" title="Profit as a share of the capital invested">Gain</th>
              <th className="num hide-sm" title="Time-weighted return: excludes the timing of contributions">TWR</th>
              <th className="num hide-sm">Volatility</th>
              <th className="num">Sharpe</th>
              <th className="num hide-sm">Max DD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.id === 'portfolio' ? 'highlight' : ''}>
                <td>{r.label}</td>
                <td className="num">{money(r.result.final)}</td>
                <td className="num"><Change value={r.stats.moneyReturn} /></td>
                <td className="num hide-sm">{formatPct(r.stats.totalReturn, 1)}</td>
                <td className="num hide-sm">{(r.stats.volatility * 100).toFixed(1)}%</td>
                <td className="num">{r.stats.sharpe == null ? '—' : r.stats.sharpe.toFixed(2)}</td>
                <td className="num hide-sm">{formatPct(r.stats.maxDrawdown, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
