import { useEffect, useImperativeHandle, useRef } from 'react'
import {
  CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries, LineStyle, PriceScaleMode, createChart,
} from 'lightweight-charts'

const DAY = 86400

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function withAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

const toLine = (bars, values) => bars.map((b, i) => (values[i] == null ? { time: b.time } : { time: b.time, value: values[i] }))

/**
 * TradingView-style candlestick chart (lightweight-charts).
 * `cursor` limits how many bars are visible, which drives market replay.
 */
export default function PriceChart({
  ref, dataKey, bars, cursor, indicators, enabled, compareBars, compareLabel,
  showVolume, precision, theme, onHover,
}) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef({})
  const shownRef = useRef({ key: null, count: 0 })
  const rangeKeyRef = useRef(null)
  const volumeColorsRef = useRef(null)
  const onHoverRef = useRef(onHover)
  onHoverRef.current = onHover

  useImperativeHandle(ref, () => ({
    setRangeDays(days) {
      const chart = chartRef.current
      const visible = bars.slice(0, cursor ?? bars.length)
      if (!chart || !visible.length) return
      const to = visible.at(-1).time
      if (days == null) chart.timeScale().fitContent()
      else chart.timeScale().setVisibleRange({ from: to - days * DAY, to })
    },
  }), [bars, cursor])

  // Create the chart once
  useEffect(() => {
    const chart = createChart(containerRef.current, {
      autoSize: true,
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { borderVisible: false, rightOffset: 4, timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderVisible: false },
      localization: { locale: 'en-US' },
    })
    chartRef.current = chart

    chart.subscribeCrosshairMove((param) => {
      const idx = param.point && param.logical != null ? Math.round(param.logical) : null
      onHoverRef.current?.(idx)
    })
    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = {}
    }
  }, [])

  // (Re)build the series whenever the chart's structure changes
  const structureKey = [
    dataKey, theme, precision, showVolume, compareBars ? compareLabel : '',
    ...Object.entries(enabled).filter(([, on]) => on).map(([id]) => id),
  ].join('|')

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !bars?.length) return

    for (const s of Object.values(seriesRef.current).flat()) chart.removeSeries(s)
    while (chart.panes().length > 1) chart.removePane(chart.panes().length - 1)
    seriesRef.current = {}

    const c = {
      surface: cssVar('--surface'), text: cssVar('--text-muted'), grid: cssVar('--chart-grid'),
      up: cssVar('--up'), down: cssVar('--down'), crosshair: cssVar('--chart-crosshair'),
      series: (n) => cssVar(`--series-${n}`),
    }
    const intraday = bars[1] && bars[1].time - bars[0].time < DAY
    chart.applyOptions({
      timeScale: { timeVisible: Boolean(intraday) },
      layout: {
        background: { type: ColorType.Solid, color: c.surface },
        textColor: c.text,
        fontFamily: cssVar('--font-ui'),
        panes: { separatorColor: c.grid, separatorHoverColor: c.grid },
      },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      crosshair: {
        vertLine: { color: c.crosshair, labelBackgroundColor: c.crosshair, style: LineStyle.Solid, width: 1 },
        horzLine: { color: c.crosshair, labelBackgroundColor: c.crosshair, style: LineStyle.Solid, width: 1 },
      },
      rightPriceScale: { mode: compareBars ? PriceScaleMode.Percentage : PriceScaleMode.Normal },
    })

    // Per-series formatter (thousands separators) so the RSI pane keeps its own precision
    const priceFormat = {
      type: 'custom',
      minMove: 1 / 10 ** precision,
      formatter: (p) => p.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision }),
    }
    const line = (slot, extra = {}, pane = 0) => chart.addSeries(LineSeries, {
      color: c.series(slot), lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
      crosshairMarkerVisible: false, priceFormat, ...extra,
    }, pane)

    const s = seriesRef.current
    s.candles = chart.addSeries(CandlestickSeries, {
      upColor: c.up, downColor: c.down, wickUpColor: c.up, wickDownColor: c.down,
      borderVisible: false, priceFormat,
    })

    if (showVolume) {
      s.volume = chart.addSeries(HistogramSeries, {
        priceScaleId: 'volume', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false,
      })
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
      volumeColorsRef.current = { up: withAlpha(c.up, 0.35), down: withAlpha(c.down, 0.35) }
    }

    if (enabled.sma20) s.sma20 = line(1)
    if (enabled.sma50) s.sma50 = line(2)
    if (enabled.ema20) s.ema20 = line(3)
    if (enabled.bb) s.bb = [line(7, { lineWidth: 1 }), line(7, { lineWidth: 1 })]
    if (compareBars) s.compare = line(4, { lastValueVisible: true })
    if (enabled.rsi) {
      s.rsi = line(5, { priceFormat: { type: 'price', precision: 1, minMove: 0.1 }, lastValueVisible: true }, 1)
      for (const level of [70, 30]) {
        s.rsi.createPriceLine({ price: level, color: c.crosshair, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: false, title: '' })
      }
      const panes = chart.panes()
      panes[0].setStretchFactor(3)
      panes[1].setStretchFactor(1)
    }

    shownRef.current = { key: null, count: 0 }
  }, [structureKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Push data: full setData on changes, a single update() per replay tick
  useEffect(() => {
    const s = seriesRef.current
    if (!s.candles || !bars?.length) return
    const count = Math.min(cursor ?? bars.length, bars.length)
    const shown = shownRef.current
    const volumeBar = (b, prev) => ({
      time: b.time, value: b.volume ?? 0,
      color: b.close >= (prev?.close ?? b.open) ? volumeColorsRef.current.up : volumeColorsRef.current.down,
    })

    if (shown.key === structureKey && count === shown.count + 1) {
      const i = count - 1
      const b = bars[i]
      s.candles.update(b)
      s.volume?.update(volumeBar(b, bars[i - 1]))
      for (const id of ['sma20', 'sma50', 'ema20']) {
        if (s[id]) s[id].update(indicators[id][i] == null ? { time: b.time } : { time: b.time, value: indicators[id][i] })
      }
      if (s.bb) {
        s.bb[0].update(indicators.bb.upper[i] == null ? { time: b.time } : { time: b.time, value: indicators.bb.upper[i] })
        s.bb[1].update(indicators.bb.lower[i] == null ? { time: b.time } : { time: b.time, value: indicators.bb.lower[i] })
      }
      if (s.rsi) s.rsi.update(indicators.rsi[i] == null ? { time: b.time } : { time: b.time, value: indicators.rsi[i] })
      if (s.compare && compareBars) {
        const next = compareBars.filter((cb) => cb.time > bars[i - 1].time && cb.time <= b.time)
        for (const cb of next) s.compare.update({ time: cb.time, value: cb.close })
      }
    } else {
      const visible = bars.slice(0, count)
      s.candles.setData(visible)
      s.volume?.setData(visible.map((b, i) => volumeBar(b, visible[i - 1])))
      for (const id of ['sma20', 'sma50', 'ema20']) if (s[id]) s[id].setData(toLine(visible, indicators[id]))
      if (s.bb) {
        s.bb[0].setData(toLine(visible, indicators.bb.upper))
        s.bb[1].setData(toLine(visible, indicators.bb.lower))
      }
      if (s.rsi) s.rsi.setData(toLine(visible, indicators.rsi))
      if (s.compare && compareBars) {
        const end = visible.at(-1).time
        const start = visible[0].time
        s.compare.setData(compareBars.filter((cb) => cb.time >= start && cb.time <= end).map((cb) => ({ time: cb.time, value: cb.close })))
      }

      const chart = chartRef.current
      if (rangeKeyRef.current !== dataKey) {
        // New asset/interval/currency: open on a sensible window
        rangeKeyRef.current = dataKey
        const days = bars[1]?.time - bars[0].time < DAY ? 30 : 180
        const to = visible.at(-1).time
        chart.timeScale().setVisibleRange({ from: to - days * DAY, to })
      } else if (cursor != null) {
        chart.timeScale().scrollToRealTime()
      }
    }
    shownRef.current = { key: structureKey, count }
  }, [structureKey, bars, cursor, indicators, compareBars, dataKey])

  return <div ref={containerRef} className="price-chart" />
}
