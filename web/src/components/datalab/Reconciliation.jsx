import { useMemo } from 'react'
import EChart from '../charts/EChart.jsx'
import { baseOption, chartTokens, escapeHtml, tooltipRow } from '../../lib/chartTheme.js'

// How far the AWS pipeline's captures were from a reference source (Yahoo hourly closes)
export default function Reconciliation({ pipeline, names, selected, onSelect, theme }) {
  const rows = useMemo(
    () => Object.entries(pipeline.reconciliation)
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => a.mean_abs_bps - b.mean_abs_bps),
    [pipeline],
  )

  const barOption = useMemo(() => {
    const t = chartTokens()
    const base = baseOption(t)
    return {
      ...base,
      grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
      tooltip: {
        ...base.tooltip, trigger: 'item',
        formatter: (it) => {
          const r = rows[it.dataIndex]
          return `<strong>${escapeHtml(r.id)}</strong> <span style="opacity:.7">${escapeHtml(names[r.id] ?? '')}</span>`
            + tooltipRow(t.series(1), `${r.mean_abs_bps.toFixed(1)} bps`, 'mean absolute difference')
            + tooltipRow(t.muted, `${r.max_abs_bps.toFixed(1)} bps`, 'largest difference')
            + `<div style="opacity:.6;margin-top:2px">${r.compared_points} fresh snapshots · click to inspect</div>`
        },
      },
      xAxis: { type: 'value', ...base.axis, axisLabel: { ...base.axis.axisLabel, formatter: '{value} bps' } },
      yAxis: { type: 'category', data: rows.map((r) => r.id), ...base.axis, splitLine: { show: false } },
      series: [{
        type: 'bar', barMaxWidth: 14,
        data: rows.map((r) => ({
          value: r.mean_abs_bps,
          itemStyle: { color: r.id === selected ? t.series(2) : t.series(1), borderRadius: [0, 4, 4, 0] },
        })),
        label: { show: true, position: 'right', color: t.muted, fontSize: 11, formatter: (it) => it.value.toFixed(1) },
        emphasis: { itemStyle: { opacity: 0.85 } },
      }],
    }
  }, [rows, names, selected, theme]) // eslint-disable-line react-hooks/exhaustive-deps

  const lineOption = useMemo(() => {
    const t = chartTokens()
    const base = baseOption(t)
    const diff = pipeline.reconciliation[selected]?.diff_bps ?? []
    const stale = pipeline.series[selected]?.stale ?? []
    const data = pipeline.time.map((s, i) => [s * 1000, stale[i] ? null : diff[i]])
    return {
      ...base,
      grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
      tooltip: {
        ...base.tooltip, trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: t.crosshair, width: 1, type: 'solid' } },
        formatter: (items) => {
          const d = new Date(items[0].value[0]).toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
          const v = items[0].value[1]
          return `<div style="opacity:.7">${escapeHtml(d)} UTC</div>` + tooltipRow(t.series(2), v == null ? 'stale' : `${v.toFixed(1)} bps`, 'pipeline vs Yahoo')
        },
      },
      xAxis: { type: 'time', ...base.axis, splitLine: { show: false } },
      yAxis: { type: 'value', ...base.axis, axisLabel: { ...base.axis.axisLabel, formatter: '{value}' } },
      series: [{
        type: 'line', data, connectNulls: false, showSymbol: true, symbolSize: 5,
        lineStyle: { width: 2, color: t.series(2) }, itemStyle: { color: t.series(2) },
        emphasis: { disabled: true },
        markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: t.muted, type: 'solid', width: 1 }, data: [{ yAxis: 0 }] },
      }],
    }
  }, [pipeline, selected, theme]) // eslint-disable-line react-hooks/exhaustive-deps

  const onEvents = useMemo(() => ({ click: (it) => onSelect(rows[it.dataIndex].id) }), [rows, onSelect])

  return (
    <section className="card chart-panel" aria-label="Reconciliation against a reference source">
      <div className="card-head">
        <div>
          <h2>Reconciliation</h2>
          <p className="muted small">
            Each price the pipeline captured, compared with Yahoo Finance’s hourly close at the same moment. 1 bp = 0.01%.
          </p>
        </div>
      </div>
      <div className="recon-grid">
        <div>
          <h3 className="chart-sub">Mean absolute difference by asset</h3>
          <EChart option={barOption} height={430} onEvents={onEvents} ariaLabel="Bar chart of the average difference between pipeline captures and the reference, per asset" />
        </div>
        <div>
          <h3 className="chart-sub">{selected} · difference per snapshot (bps)</h3>
          <EChart option={lineOption} height={260} ariaLabel={`Line chart of ${selected} capture differences over time`} />
          <p className="muted small chart-foot">
            Gaps are stale snapshots (markets closed, or FX between the API’s daily updates), which are excluded from the comparison.
          </p>
        </div>
      </div>
    </section>
  )
}
