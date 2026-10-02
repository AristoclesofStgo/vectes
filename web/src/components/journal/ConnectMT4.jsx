import { useCallback, useEffect, useState } from 'react'
import { createToken, deleteToken, listAccounts, listTokens, revokeToken, EA_DOWNLOAD, INGEST_HOST } from '../../lib/journal.js'
import { formatNumber } from '../../lib/format.js'

const when = (iso) => (iso
  ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  : 'Never')

function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } catch {}
  }
  return <button type="button" className="button" onClick={copy}>{done ? 'Copied' : label}</button>
}

function NewToken({ token, onDone }) {
  return (
    <div className="token-reveal" role="status">
      <p><strong>Your new token.</strong> Copy it now and paste it into the EA inputs — it won't be shown again.</p>
      <div className="token-row">
        <code className="token-value">{token}</code>
        <CopyButton text={token} />
      </div>
      <button type="button" className="button ghost" onClick={onDone}>I've saved it</button>
    </div>
  )
}

export default function ConnectMT4() {
  const [accounts, setAccounts] = useState(null)
  const [tokens, setTokens] = useState(null)
  const [error, setError] = useState(null)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState(null)

  const load = useCallback(async () => {
    try {
      const [a, t] = await Promise.all([listAccounts(), listTokens()])
      setAccounts(a)
      setTokens(t)
      setError(null)
    } catch {
      setError('Could not load your connections. Please refresh the page.')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (fn) => {
    setBusy(true)
    try {
      await fn()
      await load()
    } catch {
      setError('That did not work. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const create = (e) => {
    e.preventDefault()
    act(async () => {
      setFresh(await createToken(label || 'MT4'))
      setLabel('')
    })
  }

  const active = tokens?.filter((t) => !t.revoked_at) ?? []

  return (
    <section className="card connect" aria-labelledby="connect-title">
      <div className="card-head">
        <div>
          <h2 id="connect-title">Connect MetaTrader 4</h2>
          <p className="muted small">The Vectes Expert Advisor sends every closed trade to this Journal. It never asks for your broker password and cannot place trades.</p>
        </div>
      </div>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <div className="connect-grid">
        <ol className="setup-steps">
          <li>
            <h3>Download the Expert Advisor</h3>
            <p className="muted">In MT4 open <em>File → Open Data Folder</em>, then copy the file into <code>MQL4/Experts</code> and restart MT4 (or right-click <em>Expert Advisors → Refresh</em> in the Navigator).</p>
            <a className="button" href={EA_DOWNLOAD} download="VectesSync.mq4">Download VectesSync.mq4</a>
          </li>
          <li>
            <h3>Allow Vectes in MT4</h3>
            <p className="muted"><em>Tools → Options → Expert Advisors</em>: tick <em>Allow WebRequest for listed URL</em> and add:</p>
            <div className="token-row">
              <code className="token-value">{INGEST_HOST}</code>
              <CopyButton text={INGEST_HOST} />
            </div>
          </li>
          <li>
            <h3>Show your full history</h3>
            <p className="muted">In the <em>Account History</em> tab, right-click and choose <em>All History</em>, so the first sync includes your past trades.</p>
          </li>
          <li>
            <h3>Create a token and attach the EA</h3>
            <p className="muted">Drag <em>VectesSync</em> onto any chart, paste the token into <em>Inputs → Vectes token</em> and press OK. The chart shows the sync status in the top-left corner.</p>
          </li>
        </ol>

        <div className="connect-side">
          <h3>Tokens</h3>
          {fresh ? (
            <NewToken token={fresh} onDone={() => setFresh(null)} />
          ) : (
            <form className="token-form" onSubmit={create}>
              <input
                className="input"
                placeholder="Label, e.g. Infinox live"
                value={label}
                maxLength={60}
                onChange={(e) => setLabel(e.target.value)}
                aria-label="Token label"
              />
              <button className="button primary" type="submit" disabled={busy}>Create token</button>
            </form>
          )}

          {tokens == null ? (
            <div className="skeleton token-skeleton" />
          ) : active.length === 0 ? (
            <p className="muted small">No active tokens yet.</p>
          ) : (
            <ul className="token-list">
              {active.map((t) => (
                <li key={t.id}>
                  <div>
                    <strong>{t.label}</strong> <code className="muted">{t.token_prefix}…</code>
                    <div className="muted small">Created {when(t.created_at)} · Last used {when(t.last_used_at)}</div>
                  </div>
                  <button type="button" className="button ghost" disabled={busy} onClick={() => act(() => revokeToken(t.id))}>Revoke</button>
                </li>
              ))}
            </ul>
          )}
          {tokens?.some((t) => t.revoked_at) && (
            <details className="revoked">
              <summary className="muted small">Revoked tokens</summary>
              <ul className="token-list">
                {tokens.filter((t) => t.revoked_at).map((t) => (
                  <li key={t.id}>
                    <div className="muted">
                      {t.label} <code>{t.token_prefix}…</code>
                      <div className="small">Revoked {when(t.revoked_at)}</div>
                    </div>
                    <button type="button" className="button ghost" disabled={busy} onClick={() => act(() => deleteToken(t.id))}>Delete</button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <h3>Accounts</h3>
          {accounts == null ? (
            <div className="skeleton token-skeleton" />
          ) : accounts.length === 0 ? (
            <p className="muted small">No accounts yet. They appear here after the first sync.</p>
          ) : (
            <ul className="token-list">
              {accounts.map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>{a.label || a.broker}</strong> <span className="muted">#{a.account_number}</span>
                    <div className="muted small">
                      {a.tradeCount} trades
                      {a.balance != null && <> · Balance {formatNumber(Number(a.balance), 2)} {a.currency}</>}
                      {a.last_sync_at && <> · Synced {when(a.last_sync_at)}</>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
