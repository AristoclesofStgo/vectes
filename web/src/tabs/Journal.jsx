import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader, { ComingSoon } from '../components/PageHeader.jsx'
import ConnectMT4 from '../components/journal/ConnectMT4.jsx'
import JournalKpis from '../components/journal/JournalKpis.jsx'
import EquityCurve from '../components/journal/EquityCurve.jsx'
import PnlCalendar from '../components/journal/PnlCalendar.jsx'
import Breakdown from '../components/journal/Breakdown.jsx'
import TradeChart from '../components/journal/TradeChart.jsx'
import TradesTable from '../components/journal/TradesTable.jsx'
import { listAccounts, listTrades } from '../lib/journal.js'
import { journalStats, startingBalance } from '../lib/journalStats.js'
import { useJson } from '../lib/data.js'
import { useStore } from '../store.js'

// Money in the account currency: "+$1,234.56" / "−$12.30". `short` is for axis labels:
// compact from 10k up, whole units below (so a $1,000 account doesn't read "$1K, $1K, $990")
function moneyFormatter(currency) {
  let symbol = ''
  try {
    symbol = new Intl.NumberFormat('en-US', { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? ''
  } catch {}
  const plain = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
  const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
  return (value, signed = false, short = false) => {
    if (value == null || !Number.isFinite(value)) return '—'
    const abs = Math.abs(value)
    const fmt = !short ? plain : abs >= 10000 ? compact : whole
    const body = `${symbol}${fmt.format(abs)}`
    if (value < 0) return `−${body}`
    return signed && value > 0 ? `+${body}` : body
  }
}

const accountName = (a) => `${a.label || a.broker} · #${a.account_number}`

export default function Journal() {
  const theme = useStore((s) => s.theme)
  const assetsJson = useJson('assets.json')
  const [accounts, setAccounts] = useState(null)
  const [accountId, setAccountId] = useState(null)
  const [trades, setTrades] = useState(null)
  const [error, setError] = useState(null)
  const [focus, setFocus] = useState(null)

  useEffect(() => {
    listAccounts().then(
      (list) => {
        setAccounts(list)
        // Default to the account synced most recently, else the one with most trades
        const best = [...list].sort((a, b) => (Date.parse(b.last_sync_at ?? 0) || 0) - (Date.parse(a.last_sync_at ?? 0) || 0) || b.tradeCount - a.tradeCount)[0]
        setAccountId(best?.id ?? null)
      },
      () => setError('Could not load your journal. Please refresh the page.'),
    )
  }, [])

  useEffect(() => {
    if (!accountId) return
    let alive = true
    setTrades(null)
    setFocus(null)
    listTrades(accountId).then(
      (rows) => alive && setTrades(rows),
      () => alive && setError('Could not load your trades. Please refresh the page.'),
    )
    return () => { alive = false }
  }, [accountId])

  const account = accounts?.find((a) => a.id === accountId)
  const money = useMemo(() => moneyFormatter(account?.currency || 'USD'), [account?.currency])
  const start = useMemo(() => (trades ? startingBalance(account, trades) : null), [account, trades])
  const stats = useMemo(() => (trades?.length ? journalStats(trades, start) : null), [trades, start])
  const assets = useMemo(() => Object.fromEntries((assetsJson.data?.assets ?? []).map((a) => [a.id, a])), [assetsJson.data])

  const focusTrade = useCallback((t) => {
    setFocus(t)
    if (t) document.querySelector('.trade-chart')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  const updateTrade = useCallback((t) => setTrades((rows) => rows.map((r) => (r.id === t.id ? { ...r, ...t } : r))), [])

  const empty = accounts && accounts.length === 0
  const loading = !error && !empty && (!accounts || !trades)

  return (
    <>
      <PageHeader
        title="Journal"
        subtitle="Your own MetaTrader 4 trades, analysed and plotted on the same market data as the rest of Vectes."
      >
        {accounts?.length > 0 && (
          <label className="field">
            <span className="field-label">Account</span>
            <select value={accountId ?? ''} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{accountName(a)}</option>)}
            </select>
          </label>
        )}
      </PageHeader>

      {error && <div className="card error">{error}</div>}

      {loading && <div className="card skeleton" style={{ height: 420 }} />}

      {stats && (
        <>
          <JournalKpis stats={stats} money={money} />
          <div className="journal-grid">
            <EquityCurve trades={trades} start={start} money={money} theme={theme} />
            <PnlCalendar trades={trades} money={money} theme={theme} />
          </div>
          <TradeChart trades={trades} focus={focus} onFocus={setFocus} assets={assets} money={money} theme={theme} />
          <Breakdown trades={trades} money={money} />
          <TradesTable trades={trades} money={money} focusId={focus?.id} onFocus={focusTrade} onUpdate={updateTrade} />
        </>
      )}

      {trades && trades.length === 0 && (
        <div className="card empty-journal">
          <h2>No closed trades in this account yet</h2>
          <p className="muted">Trades appear here as soon as the Expert Advisor sends them.</p>
        </div>
      )}

      {empty && (
        <div className="card empty-journal">
          <h2>Connect your first account</h2>
          <p className="muted">Follow the steps below. Your statistics, equity curve and trade chart appear after the first sync.</p>
        </div>
      )}

      <ConnectMT4 />

      <ComingSoon
        items={[
          ['Statement import', 'Upload an MT4 Detailed Statement (.htm). It is parsed in your browser, symbols are mapped to Vectes assets and duplicates are skipped.'],
        ]}
      />
    </>
  )
}
