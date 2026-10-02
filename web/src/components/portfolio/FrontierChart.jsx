import { useMemo } from 'react'
import EChart from '../charts/EChart.jsx'
import { baseOption, chartTokens, escapeHtml } from '../../lib/chartTheme.js'

const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`

function topWeights(ids, w, n = 4) {
  return ids.map((id, i) => [id, w[i]]).filter(([, x]) => x >= 0.005).sort((a, b) => b[1] - a[1]).slice(0, n)
}

export default function FrontierChart({ data, current, onApply, theme }) {
  const option = useMemo(() => {
    if (!data) return null
    const t = chartTokens()
    const base = baseOption(t)
    const { ids, points, maxSharpe, minVol } = data
    const sharpes = points.map((p) => p.sharpe)
    const k = ids.length

    const marker = (name, p, symbol, color, size) => ({
      name, type: 'scatter', symbol, symbolSize: size, z: 10,
      data: [[p.vol, p.ret, p.sharpe]],
      itemStyle: { color, borderColor: t.surface, borderWidth: 2 },
      label: {
        show: true, formatter: name, position: 'right', color: t.text, fontWeight: 600, fontSize: 12, distance: 8,
        backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 4, padding: [3, 6],
      },
      tooltip: { formatter: () => detail(name, p) },
    })
    const detail = (title, p) => `<strong>${escapeHtml(title)}</strong>`
      + `<div style="margin-top:4px;font-variant-numeric:tabular-nums">Return <strong>${pct(p.ret)}</strong> · Volatility <strong>${pct(p.vol)}</strong> · Sharpe <strong>${p.sharpe.toFixed(2)}</strong></div>`
      + (p.w ? `<div style="opacity:.75;margin-top:2px">${topWeights(ids, p.w).map(([id, x]) => `${escapeHtml(id)} ${Math.round(x * 100)}%`).join(' · ')}</div>` : '')

    return {
      ...base,
      grid: { left: 8, right: 110, top: 36, bottom: 28, containLabel: true },
      tooltip: { ...base.tooltip, trigger: 'item' },
      visualMap: {
        type: 'continuous', dimension: 2, seriesIndex: 0,
        min: Math.min(...sharpes), max: Math.max(...sharpes),
        inRange: { color: [t.seqLow, t.seqHigh] },
        right: 0, top: 'middle', itemWidth: 10, itemHeight: 140,
        text: ['Higher Sharpe', 'Lower'], textStyle: { color: t.muted, fontSize: 11 }, calculable: false,
      },
      xAxis: {
        type: 'value', name: 'Volatility (annualized)', nameLocation: 'middle', nameGap: 26, scale: true,
        nameTextStyle: { color: t.muted, fontSize: 11 }, ...base.axis,
        axisLabel: { ...base.axis.axisLabel, formatter: (v) => pct(v, 0) },
      },
      yAxis: {
        type: 'value', name: 'Return', scale: true, nameTextStyle: { color: t.muted, fontSize: 11 }, ...base.axis,
        axisLabel: { ...base.axis.axisLabel, formatter: (v) => pct(v, 0) },
      },
      series: [
        {
          name: 'Random portfolios', type: 'scatter', symbolSize: 5, large: true,
          data: points.slice(0, points.length - k).map((p) => [p.vol, p.ret, p.sharpe]),
          tooltip: { formatter: (it) => detail('Random portfolio', points[it.dataIndex]) },
          emphasis: { scale: 1.6 },
        },
        {
          name: 'Single assets', type: 'scatter', symbol: 'circle', symbolSize: 9, z: 6,
          data: points.slice(-k).map((p, i) => ({ value: [p.vol, p.ret, p.sharpe], name: ids[i] })),
          itemStyle: { color: t.surface, borderColor: t.muted, borderWidth: 1.5 },
          label: { show: true, formatter: '{b}', position: 'top', color: t.muted, fontSize: 11 },
          tooltip: { formatter: (it) => detail(`100% ${it.name}`, points[points.length - k + it.dataIndex]) },
        },
        marker('Min volatility', minVol, 'triangle', t.text, 13),
        marker('Max Sharpe', maxSharpe, 'diamond', t.text, 15),
        ...(current ? [marker('Your portfolio', current, 'circle', t.series(2), 16)] : []),
      ],
    }
  }, [data, current, theme]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="card chart-panel" aria-label="Efficient frontier">
      <div className="card-head">
        <div>
          <h2>Efficient frontier</h2>
          <p className="muted small">2,500 random long-only mixes of your assets, plotted by risk and return.</p>
        </div>
        {data && (
          <div className="chips">
            <button className="chip" onClick={() => onApply(data.maxSharpe)}>Use max-Sharpe weights</button>
            <button className="chip" onClick={() => onApply(data.minVol)}>Use min-volatility weights</button>
          </div>
        )}
      </div>
      {data ? (
        <EChart option={option} height={380} ariaLabel="Scatter plot of random portfolios by volatility and return, colored by Sharpe ratio" />
      ) : (
        <p className="muted empty-state">Add at least two assets to your allocation to explore the frontier.</p>
      )}
      <p className="muted small chart-foot">
        Annualized from daily returns over the selected period, assuming weights are held constant. Past performance does not predict future results.
      </p>
    </section>
  )
}
