import { useMemo, useState } from 'react'
import { updateTradeNotes } from '../../lib/journal.js'
import { formatDuration, netPnl } from '../../lib/journalStats.js'

const PAGE = 25
const when = (ms) => new Date(ms).toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
const price = (v) => (v == null ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: 5 }))

function NotesEditor({ trade, onSaved }) {
  const [notes, setNotes] = useState(trade.notes ?? '')
  const [tags, setTags] = useState((trade.tags ?? []).join(', '))
  const [state, setState] = useState('idle') // idle | saving | saved | error

  const save = async (e) => {
    e.preventDefault()
    const clean = [...new Set(tags.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean))].slice(0, 12)
    setState('saving')
    try {
      await updateTradeNotes(trade.id, { notes, tags: clean })
      onSaved({ ...trade, notes: notes.trim() || null, tags: clean })
      setTags(clean.join(', '))
      setState('saved')
    } catch {
      setState('error')
    }
  }

  return (
    <form className="notes-editor" onSubmit={save}>
      <label>
        <span className="field-label">Notes</span>
        <textarea className="input" rows={3} maxLength={2000} value={notes} onChange={(e) => { setNotes(e.target.value); setState('idle') }} placeholder="Why you took it, what you'd do differently…" />
      </label>
      <label>
        <span className="field-label">Tags</span>
        <input className="input" value={tags} onChange={(e) => { setTags(e.target.value); setState('idle') }} placeholder="breakout, news, a+ setup" />
      </label>
      <div className="notes-actions">
        <button className="button primary" type="submit" disabled={state === 'saving'}>{state === 'saving' ? 'Saving…' : 'Save notes'}</button>
        {state === 'saved' && <span className="muted small" role="status">Saved</span>}
        {state === 'error' && <span className="down small" role="alert">Could not save. Try again.</span>}
      </div>
    </form>
  )
}

export default function TradesTable({ trades, money, focusId, onFocus, onUpdate }) {
  const [symbol, setSymbol] = useState('')
  const [side, setSide] = useState('')
  const [result, setResult] = useState('')
  const [tag, setTag] = useState('')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState(null)

  const symbols = useMemo(() => [...new Set(trades.map((t) => t.symbol.toUpperCase()))].sort(), [trades])
  const tags = useMemo(() => [...new Set(trades.flatMap((t) => t.tags ?? []))].sort(), [trades])

  const rows = useMemo(() => trades
    .filter((t) => (!symbol || t.symbol.toUpperCase() === symbol)
      && (!side || t.side === side)
      && (!result || (result === 'win' ? netPnl(t) > 0 : netPnl(t) <= 0))
      && (!tag || t.tags?.includes(tag)))
    .slice()
    .reverse(), [trades, symbol, side, result, tag])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const current = Math.min(page, pages - 1)
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE)
  const filter = (setter) => (e) => { setter(e.target.value); setPage(0) }

  return (
    <section className="card" aria-label="Trades">
      <div className="card-head">
        <div>
          <h2>Trades</h2>
          <span className="muted small">{rows.length} of {trades.length} · newest first · times in UTC</span>
        </div>
        <div className="filters">
          <select value={symbol} onChange={filter(setSymbol)} aria-label="Symbol">
            <option value="">All symbols</option>
            {symbols.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={side} onChange={filter(setSide)} aria-label="Side">
            <option value="">Long & short</option>
            <option value="buy">Long</option>
            <option value="sell">Short</option>
          </select>
          <select value={result} onChange={filter(setResult)} aria-label="Result">
            <option value="">Wins & losses</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
          </select>
          {tags.length > 0 && (
            <select value={tag} onChange={filter(setTag)} aria-label="Tag">
              <option value="">Any tag</option>
              {tags.map((x) => <option key={x}>{x}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table className="table trades-table">
          <thead>
            <tr>
              <th>Closed</th>
              <th>Symbol</th>
              <th>Side</th>
              <th className="num">Lots</th>
              <th className="num">Entry</th>
              <th className="num">Exit</th>
              <th className="num hide-sm">Held</th>
              <th className="num">Net P&L</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => {
              const pnl = netPnl(t)
              const expanded = open === t.id
              return [
                <tr
                  key={t.id}
                  className={`trade-row${expanded ? ' expanded' : ''}${focusId === t.id ? ' focused' : ''}`}
                  onClick={() => setOpen(expanded ? null : t.id)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(expanded ? null : t.id) } }}
                  aria-expanded={expanded}
                >
                  <td>{when(t.closeMs)}</td>
                  <td className="asset-id">{t.symbol.toUpperCase()}{(t.notes || t.tags?.length > 0) && <span className="note-dot" title="Has notes" aria-label="has notes" />}</td>
                  <td>{t.side === 'buy' ? 'Long' : 'Short'}</td>
                  <td className="num">{t.volume.toFixed(2)}</td>
                  <td className="num">{price(t.open_price)}</td>
                  <td className="num">{price(t.close_price)}</td>
                  <td className="num hide-sm">{formatDuration(t.closeMs - t.openMs)}</td>
                  <td className={`num ${pnl > 0 ? 'up' : pnl < 0 ? 'down' : ''}`}>{money(pnl, true)}</td>
                </tr>,
                expanded && (
                  <tr key={`${t.id}-detail`} className="trade-detail">
                    <td colSpan={8}>
                      <div className="trade-detail-grid">
                        <dl className="trade-facts">
                          <div><dt>Ticket</dt><dd>{t.ticket}</dd></div>
                          <div><dt>Opened</dt><dd>{when(t.openMs)}</dd></div>
                          <div><dt>Stop / target</dt><dd>{price(t.stop_loss)} / {price(t.take_profit)}</dd></div>
                          <div><dt>Gross profit</dt><dd>{money(t.profit, true)}</dd></div>
                          <div><dt>Swap · commission</dt><dd>{money(t.swap, true)} · {money(t.commission, true)}</dd></div>
                          <div><dt>Source</dt><dd>{t.source === 'ea' ? 'Expert Advisor' : t.source === 'statement' ? 'Statement import' : 'Demo data'}</dd></div>
                        </dl>
                        <div className="trade-detail-side">
                          <NotesEditor key={t.id} trade={t} onSaved={onUpdate} />
                          {t.asset_id && (
                            <button type="button" className="button" onClick={(e) => { e.stopPropagation(); onFocus(t) }}>Show on chart</button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ),
              ]
            })}
            {shown.length === 0 && (
              <tr><td colSpan={8} className="muted">No trades match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="pager">
          <button className="button" onClick={() => setPage(current - 1)} disabled={current === 0}>Previous</button>
          <span className="muted small">Page {current + 1} of {pages}</span>
          <button className="button" onClick={() => setPage(current + 1)} disabled={current >= pages - 1}>Next</button>
        </div>
      )}
    </section>
  )
}
