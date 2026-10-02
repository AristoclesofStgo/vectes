import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import CorrelationHeatmap from '../components/analysis/CorrelationHeatmap.jsx'
import PairExplorer, { WINDOWS } from '../components/analysis/PairExplorer.jsx'
import RatioCard from '../components/analysis/RatioCard.jsx'
import RiskReturnChart from '../components/analysis/RiskReturnChart.jsx'
import StatsTable from '../components/analysis/StatsTable.jsx'
import {
  RATIOS, assetStats, correlation, correlationMatrix, ratioSeries, returnsOf, rollingCorrelation, sampleCloses,
} from '../lib/analysis.js'
import { PERIODS } from '../lib/backtest.js'
import { CURRENCIES } from '../lib/currency.js'
import { useJson } from '../lib/data.js'
import { formatDate } from '../lib/format.js'
import { useStore } from '../store.js'

export default function Analysis() {
  const assetsJson = useJson('assets.json')
  const pricesJson = useJson('prices_1d.json')
  const theme = useStore((s) => s.theme)
  const currencyId = useStore((s) => s.currency)
  const setCurrency = useStore((s) => s.setCurrency)
  const [params, setParams] = useSearchParams()
  const [hidden, setHidden] = useState(() => new Set())

  const assets = assetsJson.data?.assets ?? []
  const categories = assetsJson.data?.categories ?? []
  const names = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a.name])), [assets])
  const valid = (id, fallback) => (names[id] ? id : fallback)

  const period = PERIODS.find((p) => p.id === params.get('p')) ?? PERIODS[2]
  const pairA = valid(params.get('a'), 'BTC')
  const pairB = valid(params.get('b'), 'SPX')
  const window = WINDOWS.find((w) => String(w.id) === params.get('w'))?.id ?? 60

  const setParam = useCallback((patch) => {
    setParams((p) => {
      const next = new URLSearchParams(p)
      for (const [k, v] of Object.entries(patch)) next.set(k, String(v))
      return next
    }, { replace: true })
  }, [setParams])

  // Full-year samples feed the rolling window; the period slices what is shown
  const data = useMemo(() => {
    if (!pricesJson.data || !assets.length) return null
    const prices = pricesJson.data
    const full = sampleCloses(prices, assets, currencyId, 0)
    const start = Math.max(0, prices.time.length - 1 - period.days)
    const sample = sampleCloses(prices, assets, currencyId, start)
    const returns = returnsOf(sample.closes)
    const tnx = prices.series.TNX.close.slice(start)
    const riskFree = tnx.reduce((a, b) => a + b, 0) / tnx.length / 100
    return { prices, full, fullReturns: returnsOf(full.closes), sample, returns, start, riskFree }
  }, [pricesJson.data, assets, currencyId, period.days])

  const ids = useMemo(() => assets.filter((a) => !hidden.has(a.category)).map((a) => a.id), [assets, hidden])
  const matrix = useMemo(() => data && correlationMatrix(data.returns, ids), [data, ids])
  // Yields and volatility indices are gauges, not investable returns: keep them in the heatmap only
  const investableIds = useMemo(() => ids.filter((id) => assets.find((a) => a.id === id)?.investable), [ids, assets])
  const stats = useMemo(() => data && assetStats(data.sample.closes, data.returns, investableIds, data.riskFree), [data, investableIds])

  const pair = useMemo(() => {
    if (!data) return null
    const roll = rollingCorrelation(data.fullReturns[pairA], data.fullReturns[pairB], window)
    const from = data.sample.times[0]
    const rollTimes = data.full.times.slice(1)
    const keep = rollTimes.map((t) => t >= from)
    return {
      times: data.sample.times,
      rollTimes: rollTimes.filter((_, i) => keep[i]),
      rolling: roll.filter((_, i) => keep[i]),
      closesA: data.sample.closes[pairA],
      closesB: data.sample.closes[pairB],
      fullCorr: correlation(data.returns[pairA], data.returns[pairB]),
    }
  }, [data, pairA, pairB, window])

  const toggleCategory = (id) => setHidden((h) => {
    const next = new Set(h)
    if (next.has(id)) next.delete(id)
    else if (categories.length - next.size > 1) next.add(id)
    return next
  })

  if (assetsJson.error || pricesJson.error) {
    return <div className="card error">Could not load market data. Please try again later.</div>
  }

  return (
    <>
      <PageHeader
        title="Analysis"
        subtitle="How assets move together, how much risk each one carries, and the classic cross-market ratios."
      />

      <div className="settings-bar" role="toolbar" aria-label="Analysis settings">
        <div className="setting">
          <span className="field-label">Period</span>
          <div className="segmented" role="radiogroup" aria-label="Period">
            {PERIODS.map((p) => (
              <button key={p.id} role="radio" aria-checked={period.id === p.id} className={period.id === p.id ? 'active' : ''} onClick={() => setParam({ p: p.id })}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="setting">
          <span className="field-label">Currency</span>
          <select value={currencyId} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.label}</option>)}
          </select>
        </label>
        <div className="setting">
          <span className="field-label">Show</span>
          <div className="chips" role="group" aria-label="Asset classes">
            {categories.map((c) => (
              <button key={c.id} className={`chip${hidden.has(c.id) ? '' : ' active'}`} aria-pressed={!hidden.has(c.id)} onClick={() => toggleCategory(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!data || !matrix ? (
        <div className="card skeleton" style={{ height: 520 }} />
      ) : (
        <>
          <div className="analysis-grid">
            <CorrelationHeatmap
              ids={ids}
              matrix={matrix}
              days={data.returns[ids[0]].length}
              onPick={(a, b) => setParam({ a, b })}
              theme={theme}
            />
            <RiskReturnChart stats={stats} names={names} theme={theme} />
          </div>

          <PairExplorer
            a={pairA} b={pairB} window={window}
            onChange={setParam}
            categories={categories} assets={assets}
            times={pair.times} rolling={pair.rolling} rollTimes={pair.rollTimes}
            closesA={pair.closesA} closesB={pair.closesB} fullCorr={pair.fullCorr}
            theme={theme}
          />

          <section aria-label="Market ratios">
            <div className="section-head">
              <h2>Market ratios</h2>
              <p className="muted small">Classic cross-asset gauges, in US dollars, over the selected period.</p>
            </div>
            <div className="ratio-grid">
              {RATIOS.map((r) => {
                const s = ratioSeries(data.prices, r, data.start)
                return <RatioCard key={r.id} ratio={r} times={s.times} values={s.values} theme={theme} />
              })}
            </div>
          </section>

          <StatsTable stats={stats} names={names} />

          <p className="muted small methodology">
            {data.returns[ids[0]].length} daily returns from {formatDate(data.sample.times[0])} to {formatDate(data.sample.times.at(-1))}, sampled on US trading days
            so that 24/7 crypto and weekday markets line up (weekend crypto moves are folded into Monday). Volatility is annualized with 252 trading days.
            {currencyId !== 'USD' && ` Assets quoted in USD are converted to ${currencyId}; currency pairs, yields and index levels keep their native quote.`}
            {' '}Sharpe uses the average US 10-year Treasury yield over the period ({(data.riskFree * 100).toFixed(2)}%). Beta and correlation are measured against the S&P 500.
          </p>
        </>
      )}
    </>
  )
}
