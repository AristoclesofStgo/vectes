import { useMemo } from 'react'
import EChart from '../charts/EChart.jsx'
import { baseOption, chartTokens, escapeHtml, tooltipRow } from '../../lib/chartTheme.js'
import { equitySeries } from '../../lib/journalStats.js'

// Single series: the card title names it, so no legend
export default function EquityCurve({ trades, cash = [], start, money, theme }) {
  const option = useMemo(() => {
    const t = chartTokens()
    const base = baseOption(t)
    const points = equitySeries(trades, start ?? 0, cash)
    const baseline = points[0]?.[1] ?? 0
    const color = t.series(1)
    return {
      ...base,
      useUTC: true, // axis times match the UTC tooltip and the rest of the Journal
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: t.crosshair, width: 1, type: 'solid' } },
        formatter: (items) => {
          const [ms, value, kind, amount] = items[0].value
          const when = new Date(ms).toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          const moved = kind === 'cash'
            ? `<div style="margin-top:4px;opacity:.8">${escapeHtml(amount > 0 ? 'Deposit' : 'Withdrawal')} ${escapeHtml(money(amount, true))}</div>`
            : ''
          return `<div style="opacity:.7">${escapeHtml(when)} UTC</div>${tooltipRow(color, money(value), start == null ? 'Cumulative P&L' : 'Equity')}${moved}`
        },
      },
      xAxis: {
        type: 'time',
        ...base.axis,
        // Every label carries its month, so a lone "5" never reads as ambiguous
        axisLabel: { ...base.axis.axisLabel, hideOverlap: true, formatter: { year: '{yyyy}', month: '{MMM}', day: '{MMM} {d}', hour: '{HH}:{mm}', minute: '{HH}:{mm}' } },
        splitLine: { show: false },
      },
      yAxis: { type: 'value', scale: true, ...base.axis, axisLabel: { ...base.axis.axisLabel, formatter: (v) => money(v, false, true) } },
      series: [{
        type: 'line',
        step: 'end',
        showSymbol: false,
        symbolSize: 8,
        data: points,
        lineStyle: { width: 2, color, join: 'round' },
        itemStyle: { color },
        areaStyle: { color, opacity: 0.08 },
        emphasis: { disabled: true },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: t.muted, width: 1, type: 'solid', opacity: 0.6 },
          data: [{ yAxis: baseline }],
        },
      }],
    }
  }, [trades, cash, start, money, theme]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="card" aria-label="Equity curve">
      <div className="card-head">
        <h2>{start == null ? 'Cumulative P&L' : 'Equity'}</h2>
        <span className="muted small">
          After each closed trade{cash.length > 0 ? ', deposit and withdrawal' : ''} · line marks the starting {start == null ? 'point' : 'balance'}
        </span>
      </div>
      <EChart option={option} height={300} ariaLabel="Step line of account equity after each closed trade" />
    </section>
  )
}
