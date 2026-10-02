import { PRESETS, equalWeights, totalWeight } from '../../lib/portfolio.js'

const fmtWeight = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, ''))

export default function AllocationEditor({ weights, onChange, categories, investable }) {
  const total = totalWeight(weights)
  const held = investable.filter((a) => weights[a.id] != null)
  const available = investable.filter((a) => weights[a.id] == null)

  const set = (id, value) => {
    const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
    onChange({ ...weights, [id]: Math.round(v * 100) / 100 })
  }
  const remove = (id) => {
    const next = { ...weights }
    delete next[id]
    onChange(next)
  }
  const scaleTo100 = () => {
    const k = 100 / total
    onChange(Object.fromEntries(Object.entries(weights).map(([id, v]) => [id, Math.round(v * k * 100) / 100])))
  }
  const applyPreset = (p) => onChange(p.weights ?? equalWeights(investable.map((a) => a.id)))

  return (
    <section className="card allocation" aria-label="Allocation">
      <div className="card-head">
        <h2>Allocation</h2>
        <span className="muted small">{held.length} assets</span>
      </div>

      <div className="presets" role="group" aria-label="Presets">
        {PRESETS.map((p) => <button key={p.id} className="chip" onClick={() => applyPreset(p)}>{p.label}</button>)}
        <button className="chip ghost" onClick={() => onChange({})}>Clear</button>
      </div>

      <div className="alloc-rows">
        {held.length === 0 && <p className="muted small empty">No assets yet — pick a preset or add one below. Unallocated capital is held as cash.</p>}
        {held.map((a) => (
          <div key={a.id} className="alloc-row">
            <div className="alloc-name">
              <span className="asset-id">{a.id}</span>
              <span className="muted small">{a.name}</span>
            </div>
            <input
              type="range" min={0} max={100} step={1}
              value={weights[a.id]}
              onChange={(e) => set(a.id, Number(e.target.value))}
              aria-label={`${a.name} weight`}
            />
            <div className="alloc-input">
              <input
                className="input"
                inputMode="decimal"
                value={fmtWeight(weights[a.id])}
                onChange={(e) => set(a.id, Number(e.target.value))}
                aria-label={`${a.name} weight in percent`}
              />
              <span className="muted small">%</span>
            </div>
            <button className="icon-button small" onClick={() => remove(a.id)} aria-label={`Remove ${a.name}`} title="Remove">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
        ))}
      </div>

      {available.length > 0 && (
        <label className="add-asset">
          <span className="sr-only">Add asset</span>
          <select value="" onChange={(e) => e.target.value && set(e.target.value, Math.max(1, Math.min(10, 100 - total)))}>
            <option value="">+ Add asset</option>
            {categories.map((cat) => {
              const options = available.filter((a) => a.category === cat.id)
              return options.length ? (
                <optgroup key={cat.id} label={cat.label}>
                  {options.map((a) => <option key={a.id} value={a.id}>{a.id} · {a.name}</option>)}
                </optgroup>
              ) : null
            })}
          </select>
        </label>
      )}

      <div className="alloc-total">
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${Math.min(total, 100)}%` }} className={total > 100 ? 'over' : ''} />
        </div>
        <div className="alloc-total-text small">
          {total > 100.001 ? (
            <>
              <span className="down">Over-allocated by {(total - 100).toFixed(1)}% — weights are scaled down in the simulation.</span>
              <button className="button ghost small" onClick={scaleTo100}>Scale to 100%</button>
            </>
          ) : (
            <>
              <span><strong>{total.toFixed(1)}%</strong> invested · <strong>{(100 - total).toFixed(1)}%</strong> cash</span>
              {total > 0 && total < 99.999 && <button className="button ghost small" onClick={scaleTo100}>Scale to 100%</button>}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
