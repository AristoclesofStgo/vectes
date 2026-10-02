import { useMemo } from 'react'
import EChart from '../charts/EChart.jsx'
import { baseOption, chartTokens, escapeHtml, tooltipRow } from '../../lib/chartTheme.js'

export const WINDOWS = [
  { id: 30, label: '30D' },
  { id: 60, label: '60D' },
  { id: 90, label: '90D' },
]

const dateLabel = (ms) => new Date(ms).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

function PairSelect({ label, value, onChange, categories, assets }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {categories.map((cat) => (
          <optgroup key={cat.id} label={cat.label}>
            {assets.filter((a) => a.category === cat.id).map((a) => <option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

export default function PairExplorer({
  a, b, window, onChange, categories, assets, times, rollTimes, rolling, closesA, closesB, fullCorr, theme,
}) {
  const ms = times.map((s) => s * 1000)

  const rollingOption = useMemo(() => {
    const t = chartTokens()
    const base = baseOption(t)
    return {
      ...base,
      grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
      tooltip: {
        ...base.tooltip, trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: t.crosshair, width: 1, type: 'solid' } },
        formatter: (items) => `<div style="opacity:.7">${escapeHtml(dateLabel(items[0].value[0]))}</div>`
          + tooltipRow(t.series(3), items[0].value[1] == null ? '—' : items[0].value[1].toFixed(2), `${window}-day correlation`),
      },
      xAxis: { type: 'time', ...base.axis, splitLine: { show: false } },
      yAxis: { type: 'value', min: -1, max: 1, interval: 0.5, ...base.axis },
      series: [{
        type: 'line', showSymbol: false, connectNulls: false,
        data: rolling.map((v, i) => [rollTimes[i] * 1000, v]),
        lineStyle: { width: 2, color: t.series(3) }, itemStyle: { color: t.series(3) },
        emphasis: { disabled: true },
        markLine: {
          silent: true, symbol: 'none', lineStyle: { color: t.muted, type: 'solid', width: 1 },
          label: { show: true, position: 'insideStartTop', formatter: 'No relationship', color: t.muted, fontSize: 10 },
          data: [{ yAxis: 0 }],
        },
      }],
    }
  }, [rolling, rollTimes, window, theme]) // eslint-disable-line react-hooks/exhaustive-deps

  const perfOption = useMemo(() => {
    const t = chartTokens()
    const base = baseOption(t)
    const rebase = (c) => c.map((v, i) => [ms[i], (v / c[0]) * 100])
    return {
      ...base,
      grid: { left: 8, right: 56, top: 32, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 2, textStyle: { color: t.muted, fontSize: 12 }, selectedMode: false },
      tooltip: {
        ...base.tooltip, trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: t.crosshair, width: 1, type: 'solid' } },
        formatter: (items) => `<div style="opacity:.7">${escapeHtml(dateLabel(items[0].value[0]))}</div>`
          + items.map((it) => tooltipRow(it.color, it.value[1].toFixed(1), it.seriesName)).join(''),
      },
      xAxis: { type: 'time', ...base.axis, splitLine: { show: false } },
      yAxis: { type: 'value', scale: true, ...base.axis },
      series: [
        { name: a, type: 'line', showSymbol: false, data: rebase(closesA), lineStyle: { width: 2, color: t.series(1) }, itemStyle: { color: t.series(1) }, endLabel: { show: true, formatter: a, color: t.text, fontWeight: 600 }, emphasis: { disabled: true } },
        { name: b, type: 'line', showSymbol: false, data: rebase(closesB), lineStyle: { width: 2, color: t.series(2) }, itemStyle: { color: t.series(2) }, endLabel: { show: true, formatter: b, color: t.text, fontWeight: 600 }, emphasis: { disabled: true } },
      ],
    }
  }, [a, b, closesA, closesB, times, theme]) // eslint-disable-line react-hooks/exhaustive-deps

  const latest = rolling.filter((v) => v != null).at(-1)

  return (
    <section className="card chart-panel" aria-label="Pair explorer">
      <div className="card-head">
        <div>
          <h2>Pair explorer</h2>
          <p className="muted small">How the relationship between two assets changes over time.</p>
        </div>
      </div>
      <div className="pair-controls">
        <PairSelect label="Asset A" value={a} onChange={(v) => onChange({ a: v })} categories={categories} assets={assets} />
        <PairSelect label="Asset B" value={b} onChange={(v) => onChange({ b: v })} categories={categories} assets={assets} />
        <div className="segmented" role="radiogroup" aria-label="Rolling window">
          {WINDOWS.map((w) => (
            <button key={w.id} role="radio" aria-checked={window === w.id} className={window === w.id ? 'active' : ''} onClick={() => onChange({ w: w.id })}>
              {w.label}
            </button>
          ))}
        </div>
        <div className="pair-stats small">
          <span><span className="muted">Whole period</span> <strong>{fullCorr == null ? '—' : fullCorr.toFixed(2)}</strong></span>
          <span><span className="muted">Latest {window}D</span> <strong>{latest == null ? '—' : latest.toFixed(2)}</strong></span>
        </div>
      </div>
      <h3 className="chart-sub">Rolling {window}-day correlation</h3>
      <EChart option={rollingOption} height={200} group="pair" ariaLabel={`Line chart of the rolling correlation between ${a} and ${b}`} />
      <h3 className="chart-sub">Performance, rebased to 100</h3>
      <EChart option={perfOption} height={240} group="pair" ariaLabel={`Line chart comparing ${a} and ${b} rebased to 100`} />
    </section>
  )
}
