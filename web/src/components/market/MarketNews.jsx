import { useState } from 'react'
import AssetLogo from '../AssetLogo.jsx'

const PAGE = 8

function ago(iso) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (min < 60) return `${Math.max(1, min)}m ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Headlines only: each one links to the publisher's full article
export default function MarketNews({ data, asset }) {
  const [tab, setTab] = useState('asset')
  const [shown, setShown] = useState(PAGE)
  const items = tab === 'asset' ? (data?.by_asset?.[asset?.id] ?? []) : (data?.all ?? [])

  const pick = (t) => { setTab(t); setShown(PAGE) }

  return (
    <section className="card news-card" aria-labelledby="news-title">
      <div className="card-head">
        <div className="panel-title">
          <span className="panel-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h11A1.5 1.5 0 0 1 18 5.5V19a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z" />
              <path d="M18 9h2.5V19a2 2 0 0 1-2 2M8 8.5h6M8 12h6M8 15.5h4" />
            </svg>
          </span>
          <h2 id="news-title">Market news</h2>
        </div>
        <div className="segmented" role="tablist" aria-label="News">
          <button role="tab" aria-selected={tab === 'asset'} className={tab === 'asset' ? 'active' : ''} onClick={() => pick('asset')}>
            {asset ? asset.name : 'Selected asset'}
          </button>
          <button role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'active' : ''} onClick={() => pick('all')}>All markets</button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="muted small">{data?.error ? 'News could not be updated today. It refreshes with the daily data run.' : 'No recent headlines for this asset.'}</p>
      ) : (
        <ul className="news-list">
          {items.slice(0, shown).map((n) => (
            <li key={n.id}>
              <a className="news-item" href={n.link} target="_blank" rel="noopener noreferrer">
                <span className="news-title">{n.title}</span>
                <span className="news-meta muted small">
                  {tab === 'all' && n.assets?.length > 0 && (
                    <span className="news-assets">{n.assets.slice(0, 4).map((id) => <AssetLogo key={id} id={id} size={14} />)}</span>
                  )}
                  <time dateTime={n.published}>{ago(n.published)}</time>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {items.length > shown && (
        <button className="button ghost news-more" onClick={() => setShown((s) => s + PAGE)}>Show more</button>
      )}
    </section>
  )
}
