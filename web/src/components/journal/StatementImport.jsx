import { useState } from 'react'
import { parseStatement, StatementError } from '../../lib/statement.js'
import { existingTickets, importStatement } from '../../lib/journal.js'
import { assetForSymbol } from '../../lib/symbols.js'

const NY_CLOSE = 180 // stored offset for New York close servers (+2h winter / +3h summer)
const FIXED = [-300, -240, -180, 0, 60, 240, 330, 480, 540, 600]
const offsetLabel = (m) => {
  if (m === 120 || m === 180) return 'UTC+2 / UTC+3 · New York close (most MT4 brokers)'
  const h = Math.abs(m) / 60
  return `UTC${m < 0 ? '−' : '+'}${Number.isInteger(h) ? h : h.toFixed(1)}`
}
const serverDate = (s) => new Date(s * 1000).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })

// Same account if broker and number match; a lone account with that number also counts
function matchAccount(accounts, parsed) {
  const same = accounts.filter((a) => a.account_number === parsed.account)
  return same.find((a) => a.broker.toLowerCase() === parsed.broker.toLowerCase()) ?? (same.length === 1 ? same[0] : null)
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
// "18 trades and 1 balance record", "1 balance record", "3 trades"
const describe = (trades, cash) => [trades && plural(trades, 'trade'), cash && plural(cash, 'balance record')].filter(Boolean).join(' and ')

// New records are the ones whose ticket isn't stored yet for this account
const fresh = ({ parsed, known }) => ({
  trades: parsed.trades.filter((t) => !known.has(t.ticket)),
  cash: parsed.cash.filter((c) => !known.has(c.ticket)),
})

export default function StatementImport({ accounts, money, onImported }) {
  const [state, setState] = useState({ step: 'idle' })
  const [offset, setOffset] = useState(NY_CLOSE)
  const [dragging, setDragging] = useState(false)

  const read = async (file) => {
    if (!file) return
    if (!/\.html?$/i.test(file.name) || file.size > 20_000_000) {
      setState({ step: 'error', message: 'Choose the .htm file MT4 saves as a Detailed Report (up to 20 MB).' })
      return
    }
    setState({ step: 'reading' })
    try {
      const parsed = parseStatement(await file.text())
      if (!parsed.trades.length && !parsed.cash.length) throw new StatementError('This statement has no closed trades or balance operations.')
      const account = matchAccount(accounts ?? [], parsed)
      const known = account ? await existingTickets(account.id) : new Set()
      if (account?.server_utc_offset_minutes != null) setOffset(account.server_utc_offset_minutes)
      setState({ step: 'preview', file: file.name, parsed, account, known })
    } catch (e) {
      setState({ step: 'error', message: e instanceof StatementError ? e.message : 'Could not read this file. Is it an MT4 Detailed Statement?' })
    }
  }

  const run = async () => {
    const { parsed, account } = state
    setState((s) => ({ ...s, step: 'importing' }))
    try {
      const id = await importStatement({ parsed, accountId: account?.id ?? null, offsetMinutes: offset })
      const { trades, cash } = fresh(state)
      setState({ step: 'done', newTrades: trades.length, newCash: cash.length })
      onImported(id)
    } catch {
      setState((s) => ({ ...s, step: 'preview', error: 'The import failed. Anything already saved is kept — try again to add the rest.' }))
    }
  }

  let preview = null
  if (state.step === 'preview' || state.step === 'importing') {
    const { parsed, account, known } = state
    const { trades: newTrades, cash: newCash } = fresh(state)
    const unmapped = [...new Set(parsed.trades.filter((t) => !assetForSymbol(t.symbol)).map((t) => t.symbol.toUpperCase()))]
    const net = newTrades.reduce((s, t) => s + t.profit + t.swap + t.commission + t.taxes, 0)
    const times = parsed.trades.flatMap((t) => [t.open_time, t.close_time]).concat(parsed.cash.map((c) => c.time))
    const offsetLocked = account?.server_utc_offset_minutes != null
    preview = (
      <div className="import-preview">
        <div className="import-head">
          <div>
            <strong>{parsed.broker}</strong> <span className="muted">#{parsed.account} · {parsed.currency}</span>
            <div className="muted small">{state.file} · {serverDate(Math.min(...times))} – {serverDate(Math.max(...times))}</div>
          </div>
          <span className="badge neutral">{account ? 'Matches a connected account' : 'New account'}</span>
        </div>

        <dl className="import-facts">
          <div><dt>Closed trades</dt><dd>{parsed.trades.length} <span className="muted">· {newTrades.length} new</span></dd></div>
          <div><dt>Deposits & withdrawals</dt><dd>{parsed.cash.length} <span className="muted">· {newCash.length} new</span></dd></div>
          <div><dt>Net P&L of new trades</dt><dd className={net > 0 ? 'up' : net < 0 ? 'down' : ''}>{money(net, true)}</dd></div>
          <div><dt>Statement balance</dt><dd>{parsed.balance == null ? '—' : money(parsed.balance)}</dd></div>
        </dl>

        <label className="field import-offset">
          <span className="field-label">Broker server time</span>
          <select value={offset} onChange={(e) => setOffset(Number(e.target.value))} disabled={offsetLocked || state.step === 'importing'}>
            {[NY_CLOSE, ...FIXED].map((m) => <option key={m} value={m}>{offsetLabel(m)}</option>)}
            {offsetLocked && ![NY_CLOSE, ...FIXED].includes(offset) && <option value={offset}>{offsetLabel(offset)}</option>}
          </select>
        </label>
        <p className="muted small">
          {offsetLocked
            ? 'Taken from your Expert Advisor connection, so imported and synced trades line up exactly.'
            : 'MT4 statements use the broker\'s clock. Most brokers run on New York close time; pick another offset only if yours differs.'}
        </p>

        <ul className="import-notes small muted">
          {known.size > 0 && <li>{parsed.trades.length - newTrades.length + parsed.cash.length - newCash.length} records are already in Vectes (same ticket) and stay as they are.</li>}
          {unmapped.length > 0 && <li>{unmapped.join(', ')} {unmapped.length > 1 ? 'have' : 'has'} no Vectes candles: counted in every statistic, not drawn on the chart.</li>}
          {parsed.openTrades > 0 && <li>{parsed.openTrades} open position{parsed.openTrades > 1 ? 's are' : ' is'} skipped until closed.</li>}
          {parsed.skipped > 0 && <li>{parsed.skipped} row{parsed.skipped > 1 ? 's' : ''} skipped (cancelled pending orders or unreadable lines).</li>}
        </ul>

        {state.error && <p className="auth-error" role="alert">{state.error}</p>}
        <div className="import-actions">
          <button
            className="button primary"
            onClick={run}
            disabled={state.step === 'importing' || newTrades.length + newCash.length === 0}
          >
            {state.step === 'importing'
              ? 'Importing…'
              : newTrades.length + newCash.length === 0
                ? 'Everything is already in Vectes'
                : `Import ${describe(newTrades.length, newCash.length)}`}
          </button>
          <button className="button ghost" onClick={() => setState({ step: 'idle' })} disabled={state.step === 'importing'}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <section className="card" aria-labelledby="import-title">
      <div className="card-head">
        <div>
          <h2 id="import-title">Import an MT4 statement</h2>
          <p className="muted small">For MT4 mobile or web users, closed accounts or a quick start without the EA. In MT4: <em>Account History → right-click → Save as Detailed Report</em>.</p>
        </div>
      </div>

      {preview ?? (
        <label
          className={`dropzone${dragging ? ' dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); read(e.dataTransfer.files?.[0]) }}
        >
          <input type="file" accept=".htm,.html,text/html" className="sr-only" onChange={(e) => { read(e.target.files?.[0]); e.target.value = '' }} />
          <strong>{state.step === 'reading' ? 'Reading…' : 'Drop your DetailedStatement.htm here'}</strong>
          <span className="muted small">or click to choose the file · it is read in your browser and never uploaded</span>
          {state.step === 'done' && (
            <span className="import-done" role="status">
              Imported {describe(state.newTrades, state.newCash)}. The dashboard above is up to date.
            </span>
          )}
          {state.step === 'error' && <span className="down small" role="alert">{state.message}</span>}
        </label>
      )}
    </section>
  )
}
