import { useEffect, useMemo, useRef, useState } from 'react'
import { CandlestickSeries, ColorType, CrosshairMode, LineStyle, createChart, createSeriesMarkers } from 'lightweight-charts'
import { loadJson } from '../../lib/data.js'
import { rowsToBars } from '../../lib/currency.js'
import { pricePrecision } from '../../lib/format.js'
import { netPnl } from '../../lib/journalStats.js'

const BAR = 4 * 3600
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Start of the 4h bar containing t (seconds), or null when t is outside the candles
function barTime(bars, t) {
  if (!bars.length || t < bars[0].time || t >= bars.at(-1).time + BAR) return null
  let lo = 0, hi = bars.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (bars[mid].time <= t) lo = mid
    else hi = mid - 1
  }
  return bars[lo].time
}

export default function TradeChart({ trades, focus, onFocus, assets, money, theme }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const markersRef = useRef(null)
  const [bars, setBars] = useState(null)
  const [failed, setFailed] = useState(false)

  // Assets the user actually traded that have Vectes candles, most traded first
  const traded = useMemo(() => {
    const counts = new Map()
    for (const t of trades) if (t.asset_id) counts.set(t.asset_id, (counts.get(t.asset_id) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  }, [trades])
  const [picked, setPicked] = useState(null)
  const asset = focus?.asset_id ?? (traded.includes(picked) ? picked : traded[0])
  const assetTrades = useMemo(() => trades.filter((t) => t.asset_id === asset), [trades, asset])

  useEffect(() => {
    const chart = createChart(containerRef.current, {
      autoSize: true,
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { borderVisible: false, rightOffset: 4, timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderVisible: false },
      localization: { locale: 'en-US' },
    })
    chartRef.current = chart
    return () => { chart.remove(); chartRef.current = null; seriesRef.current = null; markersRef.current = null }
  }, [])

  useEffect(() => {
    if (!asset) return
    let alive = true
    setBars(null)
    setFailed(false)
    loadJson(`candles/4h/${asset}.json`).then(
      (json) => alive && setBars(rowsToBars(json.data)),
      () => alive && setFailed(true),
    )
    return () => { alive = false }
  }, [asset])

  // Candles + theme
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !bars?.length) return
    if (seriesRef.current) { chart.removeSeries(seriesRef.current); seriesRef.current = null; markersRef.current = null }
    const c = { surface: cssVar('--surface'), text: cssVar('--text-muted'), grid: cssVar('--chart-grid'), up: cssVar('--up'), down: cssVar('--down'), crosshair: cssVar('--chart-crosshair') }
    chart.applyOptions({
      layout: { background: { type: ColorType.Solid, color: c.surface }, textColor: c.text, fontFamily: cssVar('--font-ui') },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      crosshair: {
        vertLine: { color: c.crosshair, labelBackgroundColor: c.crosshair, style: LineStyle.Solid, width: 1 },
        horzLine: { color: c.crosshair, labelBackgroundColor: c.crosshair, style: LineStyle.Solid, width: 1 },
      },
    })
    const precision = pricePrecision(bars.at(-1).close)
    const series = chart.addSeries(CandlestickSeries, {
      upColor: c.up, downColor: c.down, wickUpColor: c.up, wickDownColor: c.down, borderVisible: false,
      priceFormat: {
        type: 'custom',
        minMove: 1 / 10 ** precision,
        formatter: (p) => p.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision }),
      },
    })
    series.setData(bars)
    seriesRef.current = series
    markersRef.current = createSeriesMarkers(series, [])
  }, [bars, theme])

  // Trade markers: arrow at the entry price, circle at the exit price
  const plotted = useMemo(() => {
    if (!bars?.length) return { markers: [], outside: 0 }
    const entryColor = cssVar('--series-1')
    const exitColor = cssVar('--series-4')
    const markers = []
    let outside = 0
    for (const t of assetTrades) {
      const open = barTime(bars, t.openMs / 1000)
      const close = barTime(bars, t.closeMs / 1000)
      if (open == null || close == null) { outside++; continue }
      const focused = focus?.id === t.id
      const size = focused ? 2 : 1
      markers.push({
        id: `o${t.id}`, time: open, position: 'atPriceMiddle', price: t.open_price, size, color: entryColor,
        shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown', text: focused ? (t.side === 'buy' ? 'Buy' : 'Sell') : '',
      })
      markers.push({
        id: `c${t.id}`, time: close, position: 'atPriceMiddle', price: t.close_price, size, color: exitColor,
        shape: 'circle', text: focused ? money(netPnl(t), true) : '',
      })
    }
    markers.sort((a, b) => a.time - b.time)
    return { markers, outside }
  }, [bars, assetTrades, focus, money, theme]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { markersRef.current?.setMarkers(plotted.markers) }, [plotted])

  // Frame the focused trade, otherwise the span of this asset's trades
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !bars?.length || !seriesRef.current) return
    const inRange = assetTrades.filter((t) => barTime(bars, t.openMs / 1000) != null)
    const target = focus?.asset_id === asset ? [focus] : inRange
    if (!target.length) { chart.timeScale().fitContent(); return }
    const from = Math.min(...target.map((t) => t.openMs / 1000))
    const to = Math.max(...target.map((t) => t.closeMs / 1000))
    const pad = Math.max(3 * 86400, (to - from) * 0.15)
    chart.timeScale().setVisibleRange({ from: Math.max(bars[0].time, from - pad), to: Math.min(bars.at(-1).time, to + pad) })
  }, [focus, bars, asset, assetTrades, plotted])

  const unmapped = trades.length - trades.filter((t) => t.asset_id).length

  return (
    <section className="card trade-chart" aria-label="Trades on the chart">
      <div className="card-head">
        <div>
          <h2>Trades on the chart</h2>
          <span className="muted small">
            <span className="marker-key entry" aria-hidden="true">▲</span> entry ·{' '}
            <span className="marker-key exit" aria-hidden="true">●</span> exit · 4-hour candles
          </span>
        </div>
        {traded.length > 0 && (
          <label className="field">
            <span className="field-label">Asset</span>
            <select value={asset ?? ''} onChange={(e) => { onFocus(null); setPicked(e.target.value) }}>
              {traded.map((id) => <option key={id} value={id}>{assets[id]?.name ? `${id} · ${assets[id].name}` : id}</option>)}
            </select>
          </label>
        )}
      </div>
      <div ref={containerRef} className="trade-chart-canvas" />
      {!traded.length && <p className="muted small">None of these symbols has Vectes candles yet.</p>}
      {failed && <p className="card error">Could not load the candles for {asset}.</p>}
      {(plotted.outside > 0 || unmapped > 0) && (
        <p className="muted small chart-note">
          {plotted.outside > 0 && <>{plotted.outside} {asset} trade{plotted.outside > 1 ? 's are' : ' is'} outside the candle history — candles refresh daily after the US close, so today's trades appear tomorrow. </>}
          {unmapped > 0 && <>{unmapped} trade{unmapped > 1 ? 's use symbols' : ' uses a symbol'} without Vectes candles (still counted in every statistic).</>}
        </p>
      )}
    </section>
  )
}
