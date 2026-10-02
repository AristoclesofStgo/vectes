import { useState } from 'react'
import { PERIODS, REBALANCING, STRATEGIES } from '../../lib/backtest.js'
import { CURRENCIES } from '../../lib/currency.js'

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="setting">
      <span className="field-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} role="radio" aria-checked={value === o.id} className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function CopyLink() {
  const [state, setState] = useState('idle')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setState('copied')
    } catch {
      setState('failed')
    }
    setTimeout(() => setState('idle'), 1800)
  }
  return (
    <button className="button" onClick={copy}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
      {state === 'copied' ? 'Link copied' : state === 'failed' ? 'Copy the URL above' : 'Copy link'}
    </button>
  )
}

export default function SettingsBar({ config, update, currency, setCurrency }) {
  const [draft, setDraft] = useState(null)
  const commitCapital = () => {
    const value = Number(String(draft ?? '').replace(/[^0-9.]/g, ''))
    if (draft != null && value > 0) update({ capital: Math.min(value, 1e12) })
    setDraft(null)
  }

  return (
    <div className="settings-bar" role="toolbar" aria-label="Simulation settings">
      <label className="setting">
        <span className="field-label">Capital</span>
        <input
          className="input"
          inputMode="decimal"
          value={draft ?? config.capital.toLocaleString('en-US')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitCapital}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          aria-label="Starting capital"
        />
      </label>
      <label className="setting">
        <span className="field-label">Currency</span>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.label}</option>)}
        </select>
      </label>
      <Segmented label="Period" options={PERIODS} value={config.period} onChange={(period) => update({ period })} />
      <Segmented label="Strategy" options={STRATEGIES} value={config.strategy} onChange={(strategy) => update({ strategy })} />
      <Segmented label="Rebalance" options={REBALANCING} value={config.rebalance} onChange={(rebalance) => update({ rebalance })} />
      <div className="setting push"><CopyLink /></div>
    </div>
  )
}
