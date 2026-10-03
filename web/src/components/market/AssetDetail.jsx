import { formatCompact, formatDate, formatMoney, formatNumber, pricePrecision } from '../../lib/format.js'
import Change from './Change.jsx'
import AssetLogo from '../AssetLogo.jsx'

function Stat({ label, children }) {
  return (
    <div className="stat">
      <dt className="muted small">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export default function AssetDetail({ asset, stats, currency, converted, ratePair, usdLast }) {
  if (!asset || !stats) return <section className="card skeleton" style={{ minHeight: 280 }} />
  const inUsd = asset.quote === 'usd_per_unit' && asset.category !== 'fx'
  const money = (v) => {
    if (converted) return formatMoney(v, currency)
    if (inUsd) return formatMoney(v, { symbol: '$' })
    return formatNumber(v, pricePrecision(v))   // FX rates, yields and index levels
  }
  const f = asset.fundamentals

  return (
    <section className="card detail" aria-label={`${asset.name} details`}>
      <div className="detail-head">
        <div className="detail-title">
          <AssetLogo id={asset.id} size={36} />
          <div>
            <h2>{asset.name}</h2>
            <span className="muted small">{converted ? `${asset.id}/${currency.id} · priced in ${currency.label}` : asset.pair}</span>
          </div>
        </div>
        <span className="badge neutral">{asset.ticker}</span>
      </div>

      <div className="hero">
        <span className="hero-value">{money(stats.last)}</span>
        <Change value={stats.change1d} />
      </div>
      <p className="muted small">Last daily close · {formatDate(stats.asOf)}{asset.category === 'crypto' ? ' (UTC day in progress)' : ''}</p>

      <div className="range" aria-label="52-week range">
        <div className="range-track">
          <span className="range-marker" style={{ left: `${stats.rangePosition * 100}%` }} />
        </div>
        <div className="range-labels small">
          <span><span className="muted">52W low</span> {money(stats.low52w)}</span>
          <span><span className="muted">52W high</span> {money(stats.high52w)}</span>
        </div>
      </div>

      <dl className="stats-grid">
        <Stat label="1Y return"><Change value={stats.change1y} /></Stat>
        <Stat label="Volatility (ann.)">{(stats.volatility * 100).toFixed(1)}%</Stat>
      </dl>

      {f && (
        <>
          <h3 className="detail-sub">Fundamentals <span className="muted small">USD · CoinGecko</span></h3>
          <dl className="stats-grid">
            <Stat label="Market cap">${formatCompact(f.market_cap)}</Stat>
            <Stat label="Rank">#{f.market_cap_rank}</Stat>
            <Stat label="24h volume">${formatCompact(f.volume_24h)}</Stat>
            <Stat label="Circulating supply">
              {formatCompact(f.circulating_supply)}{f.max_supply ? <span className="muted"> / {formatCompact(f.max_supply)}</span> : null}
            </Stat>
            <Stat label="All-time high">
              ${formatNumber(f.ath, f.ath >= 100 ? 0 : 4)}
              <span className="muted small block">{formatDate(Date.parse(f.ath_date) / 1000)}</span>
            </Stat>
            <Stat label="From ATH"><Change value={usdLast / f.ath - 1} /></Stat>
          </dl>
        </>
      )}

      {converted && (
        <p className="muted small note">Converted from USD at each bar's {ratePair} close.</p>
      )}
    </section>
  )
}
