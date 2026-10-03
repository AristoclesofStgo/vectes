import { useCallback, useMemo } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import AllocationEditor from '../components/portfolio/AllocationEditor.jsx'
import DrawdownChart from '../components/portfolio/DrawdownChart.jsx'
import EquityChart from '../components/portfolio/EquityChart.jsx'
import FrontierChart from '../components/portfolio/FrontierChart.jsx'
import KpiRow from '../components/portfolio/KpiRow.jsx'
import SettingsBar from '../components/portfolio/SettingsBar.jsx'
import { BenchmarkTable, BreakdownTable } from '../components/portfolio/Tables.jsx'
import { usePortfolioConfig } from '../hooks/usePortfolioConfig.js'
import { PERIODS, currencyRates, frontier, localPrices, metrics, simulate } from '../lib/backtest.js'
import { currencyById } from '../lib/currency.js'
import { useJson } from '../lib/data.js'
import { formatCompact, formatNumber } from '../lib/format.js'
import { BENCHMARKS, toFractions } from '../lib/portfolio.js'
import { downloadPortfolioReport } from '../lib/portfolioReport.js'
import { useStore } from '../store.js'

const EMPTY = new Set()

export default function Portfolio() {
  const assetsJson = useJson('assets.json')
  const pricesJson = useJson('prices_1d.json')
  const theme = useStore((s) => s.theme)
  const currencyId = useStore((s) => s.currency)
  const setCurrency = useStore((s) => s.setCurrency)

  const assetsById = useMemo(
    () => Object.fromEntries((assetsJson.data?.assets ?? []).map((a) => [a.id, a])),
    [assetsJson.data],
  )
  const investable = useMemo(() => (assetsJson.data?.assets ?? []).filter((a) => a.investable), [assetsJson.data])
  const investableIds = useMemo(() => (investable.length ? new Set(investable.map((a) => a.id)) : EMPTY), [investable])
  const [config, update] = usePortfolioConfig(investableIds)
  const currency = currencyById(currencyId)

  const money = useCallback((v, signed = false, axis = false) => {
    if (v == null || !Number.isFinite(v)) return '—'
    const abs = Math.abs(v) < 1e-9 ? 0 : Math.abs(v)
    if (abs === 0) return `${currency.symbol}0${currency.suffix ?? ''}`
    const body = axis ? formatCompact(abs) : formatNumber(abs, abs >= 1000 ? 0 : abs >= 1 ? 2 : 4)
    const sign = v < 0 ? '−' : signed && v > 0 ? '+' : ''
    return `${sign}${currency.symbol}${body}${currency.suffix ?? ''}`
  }, [currency])

  // Prices in the viewer's currency + the period's starting index
  const market = useMemo(() => {
    if (!pricesJson.data || !investable.length) return null
    const prices = pricesJson.data
    const rates = currencyRates(prices, assetsById, currencyId)
    const local = localPrices(prices, assetsById, investable.map((a) => a.id), rates)
    const days = PERIODS.find((p) => p.id === config.period).days
    const start = Math.max(0, prices.time.length - 1 - days)
    const tnx = prices.series.TNX.close.slice(start)
    const riskFree = tnx.reduce((a, b) => a + b, 0) / tnx.length / 100
    return { times: prices.time, local, start, riskFree }
  }, [pricesJson.data, investable, assetsById, currencyId, config.period])

  const targets = useMemo(() => toFractions(config.weights), [config.weights])

  const run = useCallback((weights, rebalance) => {
    const result = simulate({
      times: market.times, prices: market.local, weights, capital: config.capital,
      strategy: config.strategy, rebalance, start: market.start,
    })
    return { result, stats: metrics(result, market.riskFree) }
  }, [market, config.capital, config.strategy])

  const portfolio = useMemo(() => market && run(targets, config.rebalance), [market, run, targets, config.rebalance])

  const benchmarks = useMemo(() => {
    if (!market) return null
    const equal = Object.fromEntries(investable.map((a) => [a.id, 1 / investable.length]))
    return Object.fromEntries(BENCHMARKS.map((b) => [b.id, run(b.weights ?? equal, b.rebalance)]))
  }, [market, run, investable])

  const frontierData = useMemo(() => {
    const ids = Object.keys(targets).filter((id) => targets[id] > 0)
    if (!market || ids.length < 2) return null
    const f = frontier({ prices: market.local, ids, start: market.start, riskFree: market.riskFree })
    const current = { w: ids.map((id) => targets[id]), ...f.evaluate(ids.map((id) => targets[id])) }
    return { ...f, current }
  }, [market, targets])

  const applyFrontier = (point) => {
    const ids = frontierData.ids
    const pctWeights = ids.map((id, i) => [id, Math.round(point.w[i] * 100)]).filter(([, v]) => v > 0)
    // Fix rounding so the allocation sums to exactly 100%
    const diff = 100 - pctWeights.reduce((a, [, v]) => a + v, 0)
    if (pctWeights.length && diff) {
      const largest = pctWeights.reduce((a, b) => (b[1] > a[1] ? b : a))
      largest[1] += diff
    }
    update({ weights: Object.fromEntries(pctWeights) })
  }

  if (assetsJson.error || pricesJson.error) {
    return <div className="card error">Could not load market data. Please try again later.</div>
  }

  const loading = !portfolio || !benchmarks
  const isDca = config.strategy !== 'lump'
  const downloadPdf = loading ? null : () => downloadPortfolioReport({
    config, currency, portfolio, benchmarks, targets, assetsById, url: window.location.href,
  })

  return (
    <>
      <PageHeader
        title="Portfolio"
        subtitle="Build a multi-asset portfolio and see how it would have performed, compared with classic benchmarks."
      />
      <SettingsBar config={config} update={update} currency={currencyId} setCurrency={setCurrency} onDownloadPdf={downloadPdf} />

      <div className="portfolio-grid">
        <aside className="portfolio-side">
          {investable.length > 0 && (
            <AllocationEditor
              weights={config.weights}
              onChange={(weights) => update({ weights })}
              categories={assetsJson.data.categories}
              investable={investable}
            />
          )}
        </aside>

        <div className="portfolio-main">
          {loading ? (
            <div className="card skeleton" style={{ height: 520 }} />
          ) : (
            <>
              <KpiRow result={portfolio.result} stats={portfolio.stats} money={money} isDca={isDca} />
              <EquityChart
                result={portfolio.result}
                benchmarks={benchmarks}
                selected={config.benchmarks}
                onToggle={(b) => update({ benchmarks: b })}
                isDca={isDca}
                money={money}
                theme={theme}
                group="portfolio"
              />
              <DrawdownChart
                times={portfolio.result.times}
                drawdown={portfolio.stats.drawdown}
                maxDrawdown={portfolio.stats.maxDrawdown}
                theme={theme}
                group="portfolio"
              />
            </>
          )}
        </div>
      </div>

      {!loading && (
        <>
          <BenchmarkTable portfolio={portfolio} benchmarks={benchmarks} money={money} />
          <BreakdownTable result={portfolio.result} targets={targets} assetsById={assetsById} money={money} />
          <FrontierChart data={frontierData} current={frontierData?.current} onApply={applyFrontier} theme={theme} />
        </>
      )}
    </>
  )
}
