import { useMemo } from 'react'
import EChart from '../charts/EChart.jsx'
import { baseOption, chartTokens, escapeHtml } from '../../lib/chartTheme.js'

const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`

// One point per asset; a single hue with direct id labels (identity is the label, not the color)
export default function RiskReturnChart({ stats, names, theme }) {
  const option = useMemo(() => {
    const t = chartTokens()
    const base = baseOption(t)
    return {
      ...base,
      grid: { left: 8, right: 24, top: 36, bottom: 30, containLabel: true },
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (it) => {
          const s = stats[it.dataIndex]
          return `<strong>${escapeHtml(s.id)}</strong> <span style="opacity:.7">${escapeHtml(names[s.id])}</span>`
            + `<div style="margin-top:4px;font-variant-numeric:tabular-nums">Return <strong>${pct(s.totalReturn)}</strong> · Volatility <strong>${pct(s.volatility)}</strong></div>`
            + `<div style="opacity:.75">Sharpe ${s.sharpe == null ? '—' : s.sharpe.toFixed(2)} · Max drawdown ${pct(s.maxDrawdown)}</div>`
        },
      },
      xAxis: {
        type: 'value', name: 'Volatility (annualized)', nameLocation: 'middle', nameGap: 26, min: 0,
        nameTextStyle: { color: t.muted, fontSize: 11 }, ...base.axis,
        axisLabel: { ...base.axis.axisLabel, formatter: (v) => pct(v, 0) },
      },
      yAxis: {
        type: 'value', name: 'Return over period', nameTextStyle: { color: t.muted, fontSize: 11 }, ...base.axis,
        axisLabel: { ...base.axis.axisLabel, formatter: (v) => pct(v, 0) },
      },
      series: [{
        type: 'scatter',
        symbolSize: 10,
        data: stats.map((s) => [s.volatility, s.totalReturn]),
        itemStyle: { color: t.series(1), borderColor: t.surface, borderWidth: 2 },
        label: {
          show: true, position: 'right', distance: 4, color: t.muted, fontSize: 11,
          formatter: (it) => stats[it.dataIndex].id,
        },
        labelLayout: { hideOverlap: true },
        emphasis: { scale: 1.5, label: { color: t.text, fontWeight: 600 } },
        markLine: {
          silent: true, symbol: 'none', label: { show: false },
          lineStyle: { color: t.border, type: 'solid', width: 1 },
          data: [{ yAxis: 0 }],
        },
      }],
    }
  }, [stats, names, theme])

  return (
    <section className="card chart-panel" aria-label="Risk versus return">
      <div className="card-head">
        <div>
          <h2>Risk vs. return</h2>
          <p className="muted small">Up and to the left is better: more return for less volatility.</p>
        </div>
      </div>
      <EChart option={option} height={420} ariaLabel="Scatter plot of each asset's volatility against its return" />
    </section>
  )
}
