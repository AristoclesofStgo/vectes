import { useEffect, useRef, useState } from 'react'
import { CURRENCIES } from '../../lib/currency.js'
import { INDICATORS } from '../../lib/indicators.js'

export const RANGES = [
  { id: '1M', days: 30 },
  { id: '3M', days: 91 },
  { id: '6M', days: 182 },
  { id: '1Y', days: null },
]

function AssetSelect({ id, label, value, onChange, categories, assets, allowNone }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        {allowNone && <option value="">None</option>}
        {categories.map((cat) => (
          <optgroup key={cat.id} label={cat.label}>
            {assets.filter((a) => a.category === cat.id).map((a) => (
              <option key={a.id} value={a.id}>{a.id} · {a.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}

function IndicatorMenu({ indicators, toggleIndicator, showVolume, toggleVolume, hasVolume }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  const count = Object.values(indicators).filter(Boolean).length + (hasVolume && showVolume ? 1 : 0)

  return (
    <div className="menu" ref={ref}>
      <button className="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        Indicators{count ? <span className="count">{count}</span> : null}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="menu-panel" role="group" aria-label="Indicators">
          {INDICATORS.map((ind) => (
            <label key={ind.id} className="check">
              <input type="checkbox" checked={indicators[ind.id]} onChange={() => toggleIndicator(ind.id)} />
              <span className="line-key" style={{ background: `var(--series-${ind.slot})` }} aria-hidden="true" />
              {ind.label}
            </label>
          ))}
          <label className={`check${hasVolume ? '' : ' disabled'}`}>
            <input type="checkbox" checked={hasVolume && showVolume} disabled={!hasVolume} onChange={toggleVolume} />
            <span className="line-key neutral" aria-hidden="true" />
            Volume{hasVolume ? '' : ' (n/a)'}
          </label>
        </div>
      )}
    </div>
  )
}

export default function Toolbar(p) {
  return (
    <div className="toolbar" role="toolbar" aria-label="Chart controls">
      <AssetSelect id="asset" label="Asset" value={p.assetId} onChange={p.onAsset} categories={p.categories} assets={p.assets} />

      <div className="segmented" role="radiogroup" aria-label="Timeframe">
        {['1d', '4h'].map((iv) => (
          <button key={iv} role="radio" aria-checked={p.interval === iv} className={p.interval === iv ? 'active' : ''} onClick={() => p.onInterval(iv)}>
            {iv.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="segmented" role="group" aria-label="Visible range">
        {RANGES.map((r) => (
          <button key={r.id} onClick={() => p.onRange(r.days)}>{r.id}</button>
        ))}
      </div>

      <label className="field" title={p.currencyEnabled ? '' : 'Not applicable to currencies, yields and index levels'}>
        <span className="field-label">Price in</span>
        <select value={p.currency} onChange={(e) => p.onCurrency(e.target.value)} disabled={!p.currencyEnabled}>
          {CURRENCIES.map((c) => (
            <option key={c.id} value={c.id}>{c.id} · {c.label}</option>
          ))}
        </select>
      </label>

      <IndicatorMenu
        indicators={p.indicators} toggleIndicator={p.toggleIndicator}
        showVolume={p.showVolume} toggleVolume={p.toggleVolume} hasVolume={p.hasVolume}
      />

      <AssetSelect id="compare" label="Compare" value={p.compareId} onChange={p.onCompare} categories={p.categories} assets={p.assets.filter((a) => a.id !== p.assetId)} allowNone />

      <button className={`button replay-toggle${p.replayActive ? ' active' : ''}`} onClick={p.onReplay} aria-pressed={p.replayActive}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
        Replay
      </button>
    </div>
  )
}
