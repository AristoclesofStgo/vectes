import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import AssetDetail from '../components/market/AssetDetail.jsx'
import ChartLegend from '../components/market/ChartLegend.jsx'
import PriceChart from '../components/market/PriceChart.jsx'
import ReplayControls from '../components/market/ReplayControls.jsx'
import TickerTape from '../components/market/TickerTape.jsx'
import Toolbar from '../components/market/Toolbar.jsx'
import Watchlist from '../components/market/Watchlist.jsx'
import EconomicCalendar from '../components/market/EconomicCalendar.jsx'
import MarketNews from '../components/market/MarketNews.jsx'
import { useMarketData } from '../hooks/useMarketData.js'
import { useReplay } from '../hooks/useReplay.js'
import { currencyById, isConvertible } from '../lib/currency.js'
import { useJson } from '../lib/data.js'
import { pricePrecision } from '../lib/format.js'
import { computeIndicators } from '../lib/indicators.js'
import { dailyStats, quoteSummary } from '../lib/stats.js'
import { useStore } from '../store.js'

const DEFAULT_ASSET = 'BTC'

export default function Market() {
  const assetsJson = useJson('assets.json')
  const pricesJson = useJson('prices_1d.json')
  const calendarJson = useJson('calendar.json')
  const newsJson = useJson('news.json')
  const [params, setParams] = useSearchParams()
  const chartRef = useRef(null)
  const [hoverIdx, setHoverIdx] = useState(null)

  const theme = useStore((s) => s.theme)
  const currencyId = useStore((s) => s.currency)
  const setCurrency = useStore((s) => s.setCurrency)
  const enabled = useStore((s) => s.indicators)
  const toggleIndicator = useStore((s) => s.toggleIndicator)
  const showVolume = useStore((s) => s.showVolume)
  const toggleVolume = useStore((s) => s.toggleVolume)

  const byId = useMemo(
    () => Object.fromEntries((assetsJson.data?.assets ?? []).map((a) => [a.id, a])),
    [assetsJson.data],
  )
  const asset = byId[params.get('asset')] ?? byId[DEFAULT_ASSET]
  const compareAsset = byId[params.get('compare')] && params.get('compare') !== asset?.id ? byId[params.get('compare')] : null
  const interval = params.get('tf') === '4h' ? '4h' : '1d'
  const currencyAsset = asset && currencyId !== 'USD' && isConvertible(asset, currencyId) ? byId[currencyId] : null
  const currency = currencyById(currencyAsset ? currencyId : 'USD')

  const setParam = useCallback((key, value) => {
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }, [setParams])

  const { data, loading, error } = useMarketData({ asset, compareAsset, interval, currencyAsset })
  const bars = data?.bars ?? []
  const times = useMemo(() => bars.map((b) => b.time), [bars])
  const replay = useReplay(times, data?.key)
  const visibleCount = replay.active ? replay.cursor : bars.length

  // Frame the chosen replay period: the window spans it, so new bars scroll into view
  useEffect(() => {
    if (replay.from == null || !times.length) return
    const days = (times[times.length - 1] - times[replay.from]) / 86400
    chartRef.current?.setRangeDays(Math.max(days, 2))
  }, [replay.from, times])

  const indicators = useMemo(() => computeIndicators(bars, enabled), [bars, enabled])
  const precision = pricePrecision(bars.at(-1)?.close)
  const hasVolume = Boolean(asset?.has_volume)

  const quotes = useMemo(() => {
    if (!assetsJson.data || !pricesJson.data) return []
    return assetsJson.data.assets.map((a) => ({ ...a, ...quoteSummary(pricesJson.data.series[a.id]) }))
  }, [assetsJson.data, pricesJson.data])

  const stats = useMemo(
    () => dailyStats(data?.dailyBars, asset?.category === 'crypto' ? 365 : 252),
    [data?.dailyBars, asset?.category],
  )

  // Legend follows the crosshair, falling back to the latest visible bar
  const idx = hoverIdx != null && hoverIdx >= 0 && hoverIdx < visibleCount ? hoverIdx : visibleCount - 1
  const legendValues = Object.fromEntries(Object.entries(indicators).map(([id, v]) => [
    id, id === 'bb' ? { upper: v.upper[idx], lower: v.lower[idx] } : v[idx],
  ]))
  const compareValue = useMemo(() => {
    const cb = data?.compareBars
    const t = bars[idx]?.time
    if (!cb || !compareAsset || t == null) return null
    let last = null
    for (const b of cb) { if (b.time > t) break; last = b }
    const convertedCompare = currencyAsset && isConvertible(compareAsset, currencyAsset.id)
    return last && { label: convertedCompare ? `${compareAsset.id}/${currencyAsset.id}` : compareAsset.pair, value: last.close }
  }, [data?.compareBars, bars, idx, compareAsset, currencyAsset])

  const selectAsset = (id) => setParam('asset', id)

  if (assetsJson.error || pricesJson.error || error) {
    return <div className="card error">Could not load market data. Please try again later.</div>
  }

  return (
    <>
      <TickerTape items={quotes} onSelect={selectAsset} />
      <PageHeader
        title="Market"
        subtitle="Prices of crypto, currencies, precious metals, energy and equity indices."
      />

      {asset && (
        <Toolbar
          categories={assetsJson.data.categories}
          assets={assetsJson.data.assets}
          assetId={asset.id}
          onAsset={selectAsset}
          interval={interval}
          onInterval={(iv) => setParam('tf', iv === '1d' ? null : iv)}
          onRange={(days) => chartRef.current?.setRangeDays(days)}
          currency={currencyId}
          onCurrency={setCurrency}
          currencyEnabled={asset.quote === 'usd_per_unit' && asset.category !== 'fx'}
          indicators={enabled}
          toggleIndicator={toggleIndicator}
          showVolume={showVolume}
          toggleVolume={toggleVolume}
          hasVolume={hasVolume}
          compareId={compareAsset?.id}
          onCompare={(id) => setParam('compare', id)}
          replayActive={replay.active}
          onReplay={replay.active ? replay.stop : replay.start}
        />
      )}

      <div className="market-grid">
        <div className="market-main">
          <section className={`card chart-card${loading && data ? ' refreshing' : ''}`} aria-label="Price chart">
            <div className="chart-frame">
              {data && (
                <ChartLegend
                  asset={asset}
                  interval={interval}
                  currencyId={data.converted ? currency.id : null}
                  bar={bars[idx]}
                  prevBar={bars[idx - 1]}
                  values={legendValues}
                  compare={compareValue}
                  precision={precision}
                  showVolume={hasVolume && showVolume}
                />
              )}
              <PriceChart
                ref={chartRef}
                dataKey={data?.key}
                bars={bars}
                cursor={replay.active ? replay.cursor : null}
                indicators={indicators}
                enabled={enabled}
                compareBars={compareAsset ? data?.compareBars : null}
                compareLabel={compareAsset?.id}
                showVolume={hasVolume && showVolume}
                precision={precision}
                theme={theme}
                onHover={setHoverIdx}
              />
            </div>
            <ReplayControls replay={replay} times={times} currentTime={bars[visibleCount - 1]?.time} intraday={interval === '4h'} />
            <p className="chart-note muted small">
              {compareAsset
                ? 'Percentage scale: both series are rebased to the first visible bar. '
                : ''}
              {interval === '4h' ? '4H candles aggregated from Yahoo Finance hourly bars (UTC).' : 'Daily candles from Yahoo Finance (UTC).'}
              {asset && currencyId !== 'USD' && !currencyAsset ? ` Shown in its native quote — ${currencyId} pricing does not apply to this asset.` : ''}
            </p>
          </section>

          <EconomicCalendar data={calendarJson.data} asset={asset} />
          <MarketNews data={newsJson.data} asset={asset} />
        </div>

        <aside className="market-side">
          <AssetDetail
            asset={asset}
            stats={stats}
            currency={currency}
            converted={Boolean(data?.converted)}
            ratePair={currencyAsset?.pair}
            usdLast={quotes.find((q) => q.id === asset?.id)?.last}
          />
          {quotes.length > 0 && (
            <Watchlist categories={assetsJson.data.categories} items={quotes} selected={asset?.id} onSelect={selectAsset} />
          )}
        </aside>
      </div>
    </>
  )
}
