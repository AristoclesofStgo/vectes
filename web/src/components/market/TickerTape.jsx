import { formatPrice } from '../../lib/format.js'
import Change from './Change.jsx'
import AssetLogo from '../AssetLogo.jsx'

// Scrolling price strip; the content is duplicated so the loop is seamless
export default function TickerTape({ items, onSelect }) {
  if (!items?.length) return <div className="ticker" aria-hidden="true" />
  const row = (copy) => items.map((a) => (
    <button
      key={`${copy}-${a.id}`}
      className="ticker-item"
      onClick={() => onSelect(a.id)}
      tabIndex={copy ? -1 : 0}
      aria-hidden={copy ? 'true' : undefined}
    >
      <AssetLogo id={a.id} size={18} />
      <span className="ticker-id">{a.id}</span>
      <span className="ticker-price">{formatPrice(a.last)}</span>
      <Change value={a.change1d} />
    </button>
  ))
  return (
    <div className="ticker" aria-label="Latest prices">
      <div className="ticker-track">
        {row(0)}
        {row(1)}
      </div>
    </div>
  )
}
