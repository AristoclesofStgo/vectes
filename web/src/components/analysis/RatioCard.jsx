import { useMemo } from 'react'
import EChart from '../charts/EChart.jsx'
import { baseOption, chartTokens, escapeHtml } from '../../lib/chartTheme.js'
import { formatNumber } from '../../lib/format.js'
import Change from '../market/Change.jsx'

function withAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// Small multiple: one ratio, its latest value, change over the period and range
export default function RatioCard({ ratio, times, values, theme }) {
  const fmt = (v) => `${ratio.prefix ?? ''}${formatNumber(v, ratio.digits)}`
  const last = values.at(-1)
  const first = values[0]
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const change = ratio.prefix ? null : last / first - 1

  const option = useMemo(() => {
    const t = chartTokens()
    const base = baseOption(t)
    return {
      ...base,
      grid: { left: 0, right: 0, top: 4, bottom: 0 },
      tooltip: {
        ...base.tooltip, trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: t.crosshair, width: 1, type: 'solid' } },
        formatter: (items) => {
          const d = new Date(items[0].value[0]).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
          return `<strong style="font-variant-numeric:tabular-nums">${escapeHtml(fmt(items[0].value[1]))}</strong> <span style="opacity:.7">${escapeHtml(d)}</span>`
        },
      },
      xAxis: { type: 'time', show: false },
      yAxis: { type: 'value', show: false, scale: true },
      series: [{
        type: 'line', showSymbol: false,
        data: values.map((v, i) => [times[i] * 1000, v]),
        lineStyle: { width: 2, color: t.series(1) }, itemStyle: { color: t.series(1) },
        areaStyle: { color: withAlpha(t.series(1), 0.1), origin: 'start' },
        emphasis: { disabled: true },
      }],
    }
  }, [times, values, theme]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="card ratio-card" aria-label={ratio.label}>
      <div className="ratio-head">
        <h3>{ratio.label}</h3>
        <span className="muted small">{ratio.legs.join(' · ')}</span>
      </div>
      <div className="ratio-value">
        <span className="ratio-number">{fmt(last)}</span>
        {change != null
          ? <Change value={change} className="small" />
          : <span className={`small ${last - first >= 0 ? 'up' : 'down'}`}>{last - first >= 0 ? '▲ +' : '▼ −'}{fmt(Math.abs(last - first))}</span>}
      </div>
      <p className="muted small">{ratio.unit}</p>
      <EChart option={option} height={90} ariaLabel={`${ratio.label} over the selected period`} />
      <div className="ratio-range small">
        <span><span className="muted">Low</span> {fmt(lo)}</span>
        <span><span className="muted">High</span> {fmt(hi)}</span>
      </div>
    </section>
  )
}
