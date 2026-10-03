import { useEffect, useMemo, useRef, useState } from 'react'
import { CandlestickSeries, ColorType, CrosshairMode, LineStyle, createChart, createSeriesMarkers } from 'lightweight-charts'
import { loadJson } from '../../lib/data.js'
import { rowsToBars } from '../../lib/currency.js'
import { pricePrecision } from '../../lib/format.js'
import { netPnl } from '../../lib/journalStats.js'

// Candle sets for the Journal chart. Yahoo keeps short intervals for a limited window,
// so 15m and 5m only reach back 60 and 30 days.
const INTERVALS = [
  { id: '5m', label: '5M', seconds: 300, days: 30 },
  { id: '15m', label: '15M', seconds: 900, days: 60 },
  { id: '1h', label: '1H', seconds: 3600, days: 365 },
  { id: '4h', label: '4H', seconds: 14400, days: 365 },
]
const DEFAULT_INTERVAL = '4h'
const INTERVAL_NAMES = {'5m': '5-minute', '15m': '15-minute', '1h': '1-hour', '4h': '4-hour'}
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Finest interval that shows a trade with some context and still covers its date
function intervalFor(trade) {
  const holdMin = (trade.closeMs - trade.openMs) / 60000
  const ageDays = (Date.now() - trade.openMs) / 86400000
  const wanted = holdMin < 90 ? '5m' : holdMin < 6 * 60 ? '15m' : holdMin < 3 * 1440 ? '1h' : '4h'
  const start = INTERVALS.findIndex((iv) => iv.id === wanted)
  return INTERVALS.slice(start).find((iv) => ageDays < iv.days - 1)?.id ?? DEFAULT_INTERVAL
}

// Start of the bar containing t (seconds), or null when t is outside the candles
function barTime(bars, t, barSeconds) {
  if (!bars.length || t < bars[0].time || t >= bars.at(-1).time + barSeconds) return null
  let lo = 0, hi = bars.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (bars[mid].time <= t) lo = mid
    else hi = mid - 1
  }
  return bars[lo].time
}

// Vectes metals, oil and indices are futures; brokers quote spot or CFDs a few dollars away.
// The typical gap is the median of (trade price - mid price of the bar it happened in),
// over entries and exits. Under 0.1% it is noise (spot FX, crypto) and is ignored, and
// demo trades are left out: they are generated from these very candles.
const MIN_GAP = 0.001

function brokerOffset(bars, trades, barSeconds) {
  const gaps = []
  for (const t of trades) {
    if (t.source === 'demo') continue
    for (const [ms, price] of [[t.openMs, t.open_price], [t.closeMs, t.close_price]]) {
      const time = barTime(bars, ms / 1000, barSeconds)
      if (time == null) continue
      const bar = bars[barIndex(bars, time)]
      gaps.push(price - (bar.high + bar.low) / 2)
    }
  }
  if (gaps.length < 2) return 0
  gaps.sort((a, b) => a - b)
  const mid = gaps.length >> 1
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2
  return Math.abs(median) / bars.at(-1).close >= MIN_GAP ? median : 0
}

// Index of the bar that starts at `time` (bars are sorted)
function barIndex(bars, time) {
  let lo = 0, hi = bars.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (bars[mid].time < time) lo = mid + 1
    else hi = mid
  }
  return lo
}

const shiftBars = (bars, d) => bars.map((b) => ({ ...b, open: b.open + d, high: b.high + d, low: b.low + d, close: b.close + d }))

export default function TradeChart({ trades, focus, onFocus, assets, money, theme }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const markersRef = useRef(null)
  const [bars, setBars] = useState(null)
  const [failed, setFailed] = useState(false)
  const [intervalId, setIntervalId] = useState(DEFAULT_INTERVAL)
  const [aligned, setAligned] = useState(true)
  const iv = INTERVALS.find((x) => x.id === intervalId)

  // "Show on chart" opens the trade on an interval that suits its length
  useEffect(() => { if (focus) setIntervalId(intervalFor(focus)) }, [focus])

  // Assets the user actually traded that have Vectes candles, most traded first
  const traded = useMemo(() => {
    const counts = new Map()
    for (const t of trades) if (t.asset_id) counts.set(t.asset_id, (counts.get(t.asset_id) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  }, [trades])
  const [picked, setPicked] = useState(null)
  const asset = focus?.asset_id ?? (traded.includes(picked) ? picked : traded[0])
  const assetTrades = useMemo(() => trades.filter((t) => t.asset_id === asset), [trades, asset])

  // Gap between the broker's prices and the Vectes candles, and the candles to draw
  const offset = useMemo(() => (bars?.length ? brokerOffset(bars, assetTrades, iv.seconds) : 0), [bars, assetTrades, iv])
  const shown = useMemo(() => (bars && offset && aligned ? shiftBars(bars, offset) : bars), [bars, offset, aligned])

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
    loadJson(`candles/${intervalId}/${asset}.json`).then(
      (json) => alive && setBars(rowsToBars(json.data)),
      () => alive && setFailed(true),
    )
    return () => { alive = false }
  }, [asset, intervalId])

  // Candles + theme
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !shown?.length) return
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
    const precision = pricePrecision(shown.at(-1).close)
    const series = chart.addSeries(CandlestickSeries, {
      upColor: c.up, downColor: c.down, wickUpColor: c.up, wickDownColor: c.down, borderVisible: false,
      priceFormat: {
        type: 'custom',
        minMove: 1 / 10 ** precision,
        formatter: (p) => p.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision }),
      },
    })
    series.setData(shown)
    seriesRef.current = series
    markersRef.current = createSeriesMarkers(series, [])
    // A redraw drops the markers; put them back
    if (plottedRef.current) markersRef.current.setMarkers(plottedRef.current.markers)
  }, [shown, theme])

  // Trade markers: arrow at the entry price, circle at the exit price
  const plotted = useMemo(() => {
    if (!bars?.length) return { markers: [] }
    const entryColor = cssVar('--series-1')
    const exitColor = cssVar('--series-4')
    const markers = []
    for (const t of assetTrades) {
      const open = barTime(bars, t.openMs / 1000, iv.seconds)
      const close = barTime(bars, t.closeMs / 1000, iv.seconds)
      if (open == null || close == null) continue
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
    return { markers }
  }, [bars, assetTrades, focus, money, theme, iv]) // eslint-disable-line react-hooks/exhaustive-deps

  const plottedRef = useRef(null)
  plottedRef.current = plotted
  useEffect(() => { markersRef.current?.setMarkers(plotted.markers) }, [plotted])

  // Frame the focused trade, otherwise the span of this asset's trades
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !bars?.length || !seriesRef.current) return
    const inRange = assetTrades.filter((t) => barTime(bars, t.openMs / 1000, iv.seconds) != null)
    const target = focus?.asset_id === asset ? [focus] : inRange
    if (!target.length) { chart.timeScale().fitContent(); return }
    const from = Math.min(...target.map((t) => t.openMs / 1000))
    const to = Math.max(...target.map((t) => t.closeMs / 1000))
    // Context around the trades: about 30 bars of the current interval, or 15% of the span
    const pad = Math.max(iv.seconds * 30, (to - from) * 0.15)
    chart.timeScale().setVisibleRange({ from: Math.max(bars[0].time, from - pad), to: Math.min(bars.at(-1).time, to + pad) })
  }, [focus, bars, asset, assetTrades, plotted, iv])

  return (
    <section className="card trade-chart" aria-label="Trades on the chart">
      <div className="card-head">
        <div>
          <h2>Trades on the chart</h2>
          <span className="muted small">
            <span className="marker-key entry" aria-hidden="true">▲</span> entry ·{' '}
            <span className="marker-key exit" aria-hidden="true">●</span> exit · {INTERVAL_NAMES[iv.id]} candles
          </span>
        </div>
        {traded.length > 0 && (
          <div className="trade-chart-controls">
            <div className="segmented" role="radiogroup" aria-label="Candle interval">
              {INTERVALS.map((x) => (
                <button key={x.id} role="radio" aria-checked={intervalId === x.id} className={intervalId === x.id ? 'active' : ''} onClick={() => setIntervalId(x.id)}>
                  {x.label}
                </button>
              ))}
            </div>
            <label className="field">
              <span className="field-label">Asset</span>
              <select value={asset ?? ''} onChange={(e) => { onFocus(null); setPicked(e.target.value) }}>
                {traded.map((id) => <option key={id} value={id}>{assets[id]?.name ? `${id} · ${assets[id].name}` : id}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>
      <div ref={containerRef} className="trade-chart-canvas" />
      {offset !== 0 && (
        <label className="align-toggle small">
          <input type="checkbox" checked={aligned} onChange={(e) => setAligned(e.target.checked)} />
          <span>
            Match your broker's prices: candles {aligned ? 'shifted' : 'can be shifted'}{' '}
            <strong>{offset > 0 ? '+' : '−'}{Math.abs(offset).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: pricePrecision(bars.at(-1).close) })}</strong>
            <span className="muted"> · Vectes {assets[asset]?.name ?? asset} uses futures prices, your broker quotes spot or CFD</span>
          </span>
        </label>
      )}
      {!traded.length && <p className="muted small">None of these symbols has Vectes candles yet.</p>}
      {failed && <p className="card error">Could not load the candles for {asset}.</p>}
    </section>
  )
}
