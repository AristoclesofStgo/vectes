import { useMemo } from 'react'
import PageHeader, { ComingSoon } from '../components/PageHeader.jsx'
import { useJson } from '../lib/data.js'
import { formatPct, formatPrice, formatDate } from '../lib/format.js'

// Last close, previous trading-day change and 1Y change for every asset
function summarize(series) {
  const { close, traded } = series
  const tradedIdx = traded.reduce((acc, t, i) => (t ? [...acc, i] : acc), [])
  const last = close[tradedIdx.at(-1)]
  const prev = close[tradedIdx.at(-2)]
  const first = close[tradedIdx[0]]
  return { last, change1d: last / prev - 1, change1y: last / first - 1 }
}

function ChangeCell({ value }) {
  const cls = value > 0 ? 'up' : value < 0 ? 'down' : ''
  return <td className={`num ${cls}`}>{formatPct(value)}</td>
}

function Overview() {
  const assets = useJson('assets.json')
  const prices = useJson('prices_1d.json')

  const rows = useMemo(() => {
    if (!assets.data || !prices.data) return null
    return assets.data.categories.map((cat) => ({
      ...cat,
      assets: assets.data.assets
        .filter((a) => a.category === cat.id)
        .map((a) => ({ ...a, ...summarize(prices.data.series[a.id]) })),
    }))
  }, [assets.data, prices.data])

  if (assets.error || prices.error) {
    return <div className="card error">Could not load market data. Run the data build (see README) and reload.</div>
  }
  if (!rows) return <div className="card skeleton" style={{ height: 480 }} />

  const t = prices.data.time
  return (
    <section className="card">
      <div className="card-head">
        <h2>Market overview</h2>
        <span className="muted small">{formatDate(t[0])} – {formatDate(t.at(-1))} · daily closes</span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Asset</th>
              <th className="hide-sm">Pair</th>
              <th className="num">Last</th>
              <th className="num">1D</th>
              <th className="num">1Y</th>
            </tr>
          </thead>
          {rows.map((cat) => (
            <tbody key={cat.id}>
              <tr className="group-row"><th colSpan={5}>{cat.label}</th></tr>
              {cat.assets.map((a) => (
                <tr key={a.id}>
                  <td><span className="asset-id">{a.id}</span> <span className="muted">{a.name}</span></td>
                  <td className="muted hide-sm">{a.pair}</td>
                  <td className="num">{formatPrice(a.last)}</td>
                  <ChangeCell value={a.change1d} />
                  <ChangeCell value={a.change1y} />
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  )
}

export default function Market() {
  return (
    <>
      <PageHeader
        title="Market"
        subtitle="One year of prices across crypto, currencies, precious metals, energy and equity indices."
      />
      <Overview />
      <ComingSoon items={[
        ['TradingView-style chart', 'Interactive candlesticks on daily and 4-hour timeframes with volume and indicators.'],
        ['Market replay', 'Play back the past year as if it were happening live, at adjustable speed.'],
        ['Cross-currency pricing', 'View any asset priced in EUR, GBP, JPY, MXN or gold ounces.'],
      ]} />
    </>
  )
}
