import { useMemo } from 'react'
import EChart from '../charts/EChart.jsx'
import { baseOption, chartTokens, escapeHtml, tooltipRow } from '../../lib/chartTheme.js'
import { BENCHMARKS, MAX_BENCHMARKS } from '../../lib/portfolio.js'

export default function EquityChart({ result, benchmarks, selected, onToggle, isDca, money, theme, group }) {
  const option = useMemo(() => {
    const t = chartTokens()
    const base = baseOption(t)
    const times = result.times.map((s) => s * 1000)
    const line = (name, values, color, extra = {}) => ({
      name, type: 'line', showSymbol: false, symbolSize: 8,
      data: values.map((v, i) => [times[i], v]),
      lineStyle: { width: 2, color, cap: 'round', join: 'round' }, itemStyle: { color },
      emphasis: { disabled: true }, ...extra,
    })

    const series = [
      line('Your portfolio', result.value, t.series(1), {
        z: 5,
        endLabel: { show: true, formatter: 'Portfolio', color: t.text, fontWeight: 600, fontFamily: t.font, distance: 6 },
      }),
      ...selected.map((id, i) => line(BENCHMARKS.find((b) => b.id === id).label, benchmarks[id].result.value, t.series(i + 2))),
    ]
    if (isDca) {
      series.push(line('Invested', result.invested, t.muted, { step: 'end', lineStyle: { width: 1.5, color: t.muted }, z: 1 }))
    }

    return {
      ...base,
      grid: { left: 8, right: 84, top: 36, bottom: 8, containLabel: true },
      legend: {
        type: 'scroll', top: 0, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 2,
        pageIconColor: t.muted, pageTextStyle: { color: t.muted },
        textStyle: { color: t.muted, fontSize: 12 }, selectedMode: false,
      },
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: t.crosshair, width: 1, type: 'solid' } },
        formatter: (items) => {
          const date = new Date(items[0].value[0]).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
          return `<div style="opacity:.7">${escapeHtml(date)}</div>`
            + items.map((it) => tooltipRow(it.color, money(it.value[1]), it.seriesName)).join('')
        },
      },
      xAxis: { type: 'time', ...base.axis, splitLine: { show: false } },
      yAxis: { type: 'value', scale: true, ...base.axis, axisLabel: { ...base.axis.axisLabel, formatter: (v) => money(v, false, true) } },
      series,
    }
  }, [result, benchmarks, selected, isDca, money, theme]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => {
    if (selected.includes(id)) onToggle(selected.filter((x) => x !== id))
    else onToggle([...selected, id].slice(-MAX_BENCHMARKS))
  }

  return (
    <section className="card chart-panel" aria-label="Portfolio value over time">
      <div className="card-head">
        <h2>Portfolio value</h2>
        <div className="chips" role="group" aria-label={`Benchmarks (up to ${MAX_BENCHMARKS})`}>
          <span className="muted small">Compare with</span>
          {BENCHMARKS.map((b) => (
            <button key={b.id} className={`chip${selected.includes(b.id) ? ' active' : ''}`} aria-pressed={selected.includes(b.id)} onClick={() => toggle(b.id)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
      <EChart option={option} height={340} group={group} ariaLabel="Line chart of portfolio value compared with benchmarks" />
    </section>
  )
}
