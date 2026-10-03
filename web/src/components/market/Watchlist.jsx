import { formatPrice } from '../../lib/format.js'
import Change from './Change.jsx'
import AssetLogo from '../AssetLogo.jsx'

export default function Watchlist({ categories, items, selected, onSelect }) {
  return (
    <section className="card watchlist" aria-label="Watchlist">
      <div className="card-head"><h2>Watchlist</h2><span className="muted small">Last · 1D</span></div>
      <div className="watchlist-body">
        {categories.map((cat) => (
          <div key={cat.id} className="watchlist-group">
            <div className="watchlist-label">{cat.label}</div>
            {items.filter((a) => a.category === cat.id).map((a) => (
              <button
                key={a.id}
                className={`watchlist-row${a.id === selected ? ' active' : ''}`}
                onClick={() => onSelect(a.id)}
                aria-pressed={a.id === selected}
              >
                <span className="watchlist-asset">
                  <AssetLogo id={a.id} size={26} />
                  <span className="watchlist-name">
                    <span className="asset-id">{a.id}</span>
                    <span className="muted small">{a.name}</span>
                  </span>
                </span>
                <span className="watchlist-quote">
                  <span className="num">{formatPrice(a.last)}</span>
                  <Change value={a.change1d} className="small" />
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
