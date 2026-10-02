import { useMemo } from 'react'
import EChart from '../charts/EChart.jsx'
import { baseOption, chartTokens, escapeHtml, inkOn } from '../../lib/chartTheme.js'

// Linear interpolation across the 5 diverging stops on [-1, 1]
function colorAt(stops, v) {
  const x = ((Math.max(-1, Math.min(1, v)) + 1) / 2) * (stops.length - 1)
  const i = Math.min(Math.floor(x), stops.length - 2)
  const f = x - i
  const rgb = (h) => [0, 2, 4].map((k) => parseInt(h.slice(1 + k, 3 + k), 16))
  const a = rgb(stops[i])
  const b = rgb(stops[i + 1])
  return `#${a.map((c, k) => Math.round(c + (b[k] - c) * f).toString(16).padStart(2, '0')).join('')}`
}

export default function CorrelationHeatmap({ ids, matrix, days, onPick, theme }) {
  const showValues = ids.length <= 12

  const option = useMemo(() => {
    const t = chartTokens()
    const base = baseOption(t)
    const data = []
    ids.forEach((row, i) => ids.forEach((col, j) => {
      const v = matrix[i][j]
      if (v == null) {
        data.push({ value: [j, i, '-'], itemStyle: { color: t.surface2 } })
        return
      }
      data.push({ value: [j, i, v], label: { color: inkOn(colorAt(t.diverging, v), t) } })
    }))

    return {
      ...base,
      grid: { left: 8, right: 8, top: 8, bottom: 56, containLabel: true },
      tooltip: {
        ...base.tooltip,
        formatter: (it) => {
          const [j, i, v] = it.value
          const corr = v === '-' ? 'n/a' : v.toFixed(2)
          return `<strong style="font-size:14px;font-variant-numeric:tabular-nums">${corr}</strong>`
            + `<div style="opacity:.75">${escapeHtml(ids[i])} × ${escapeHtml(ids[j])} · ${days} trading days</div>`
            + (i !== j ? '<div style="opacity:.6;margin-top:2px">Click to chart this pair</div>' : '')
        },
      },
      xAxis: {
        type: 'category', data: ids, position: 'top', ...base.axis,
        axisLabel: { ...base.axis.axisLabel, rotate: ids.length > 14 ? 90 : 0, interval: 0 },
        splitLine: { show: false }, axisLine: { show: false },
      },
      yAxis: {
        type: 'category', data: ids, inverse: true, ...base.axis,
        axisLabel: { ...base.axis.axisLabel, interval: 0 }, splitLine: { show: false }, axisLine: { show: false },
      },
      visualMap: {
        type: 'continuous', min: -1, max: 1, dimension: 2, seriesIndex: 0,
        orient: 'horizontal', left: 'center', bottom: 6, itemWidth: 10, itemHeight: 180,
        inRange: { color: t.diverging }, calculable: false,
        text: ['+1', '−1'], textGap: 8,
        textStyle: { color: t.muted, fontSize: 11 },
      },
      series: [{
        type: 'heatmap',
        data,
        itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 2 },
        label: { show: showValues, fontSize: 11, formatter: (it) => (it.value[2] === '-' ? '' : it.value[2].toFixed(2)) },
        emphasis: { itemStyle: { borderColor: t.text, borderWidth: 1.5 } },
      }],
    }
  }, [ids, matrix, days, showValues, theme])

  const onEvents = useMemo(() => ({
    click: (it) => {
      const [j, i] = it.value
      if (i !== j) onPick(ids[i], ids[j])
    },
  }), [ids, onPick])

  const size = Math.max(320, Math.min(620, ids.length * 26 + 110))
  return (
    <section className="card chart-panel" aria-label="Correlation heatmap">
      <div className="card-head">
        <div>
          <h2>Correlation of daily returns</h2>
          <p className="muted small">Blue: the pair tends to move together. Red: they move in opposite directions. Click a cell to chart that pair below.</p>
        </div>
      </div>
      <EChart option={option} height={size} onEvents={onEvents} ariaLabel="Heatmap of pairwise correlations between asset returns" />
    </section>
  )
}
