import { useMemo } from 'react'
import EChart from '../charts/EChart.jsx'
import { baseOption, chartTokens, escapeHtml, tooltipRow } from '../../lib/chartTheme.js'
import { formatPct } from '../../lib/format.js'

function withAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export default function DrawdownChart({ times, drawdown, maxDrawdown, theme, group }) {
  const option = useMemo(() => {
    const t = chartTokens()
    const base = baseOption(t)
    return {
      ...base,
      grid: { left: 8, right: 84, top: 12, bottom: 8, containLabel: true },
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: t.crosshair, width: 1, type: 'solid' } },
        formatter: (items) => {
          const date = new Date(items[0].value[0]).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
          return `<div style="opacity:.7">${escapeHtml(date)}</div>` + tooltipRow(t.down, formatPct(items[0].value[1]), 'Below previous peak')
        },
      },
      xAxis: { type: 'time', ...base.axis, splitLine: { show: false } },
      yAxis: {
        type: 'value', max: 0, ...base.axis,
        axisLabel: { ...base.axis.axisLabel, formatter: (v) => `${Math.round(v * 100)}%` },
      },
      series: [{
        name: 'Drawdown', type: 'line', showSymbol: false,
        data: drawdown.map((v, i) => [times[i] * 1000, v]),
        lineStyle: { width: 2, color: t.down }, itemStyle: { color: t.down },
        areaStyle: { color: withAlpha(t.down, 0.1) },
        emphasis: { disabled: true },
      }],
    }
  }, [times, drawdown, theme]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="card chart-panel" aria-label="Drawdown">
      <div className="card-head">
        <h2>Drawdown</h2>
        <span className="muted small">Worst: {formatPct(maxDrawdown)} from the previous peak</span>
      </div>
      <EChart option={option} height={170} group={group} ariaLabel="Area chart of the portfolio's decline from its previous peak" />
    </section>
  )
}
