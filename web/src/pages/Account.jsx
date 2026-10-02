import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import ConfirmDelete from '../components/ConfirmDelete.jsx'
import { useAuth, daysLeft } from '../lib/auth.js'
import { listAccounts, listTokens } from '../lib/journal.js'

const longDate = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

export default function Account() {
  const session = useAuth((s) => s.session)
  const { signOut, deleteAccount } = useAuth.getState()
  const [data, setData] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    Promise.all([listAccounts(), listTokens()]).then(
      ([accounts, tokens]) => setData({
        accounts: accounts.length,
        trades: accounts.reduce((s, a) => s + a.tradeCount, 0),
        tokens: tokens.filter((t) => !t.revoked_at).length,
      }),
      () => setData({ error: true }),
    )
  }, [])

  if (!session) return null
  const demo = session.kind === 'demo'
  const left = daysLeft(session)

  return (
    <>
      <PageHeader title="Your account" subtitle="Your sign-in, what Vectes stores for you and how to remove it." />

      <div className="account-grid">
        <section className="card account-card">
          <h2>Sign-in</h2>
          <dl className="trade-facts">
            <div><dt>{demo ? 'Type' : 'Email'}</dt><dd>{demo ? 'Demo visitor (no email)' : session.email}</dd></div>
            <div>
              <dt>Access</dt>
              <dd>{demo ? `Until ${longDate(session.expiresAt)} · ${left} day${left === 1 ? '' : 's'} left` : 'Full access, no expiry'}</dd>
            </div>
          </dl>
          {demo && <p className="muted small">Demo accounts and their sample data are deleted automatically the day after they expire. Create a free account to keep a journal.</p>}
          <div><button className="button" onClick={signOut}>Sign out</button></div>
        </section>

        <section className="card account-card">
          <h2>Your data</h2>
          {data == null ? <div className="skeleton token-skeleton" /> : data.error ? (
            <p className="muted small">Could not load your data summary.</p>
          ) : (
            <dl className="trade-facts">
              <div><dt>Trading accounts</dt><dd>{data.accounts}</dd></div>
              <div><dt>Closed trades</dt><dd>{data.trades}</dd></div>
              <div><dt>Active EA tokens</dt><dd>{data.tokens}</dd></div>
            </dl>
          )}
          <p className="muted small">
            Everything here is private to your sign-in. Remove a single trading account from the <Link className="link accent" to="/journal">Journal</Link>,
            or read how data is handled in the <Link className="link accent" to="/privacy">privacy notice</Link>.
          </p>
        </section>
      </div>

      <section className="card danger-zone" aria-labelledby="danger-title">
        <h2 id="danger-title">Delete your Vectes account</h2>
        {deleting ? (
          <ConfirmDelete
            title="Delete your account permanently?"
            word="DELETE"
            action="Delete my account"
            onConfirm={deleteAccount}
            onCancel={() => setDeleting(false)}
          >
            <p>This removes your sign-in and every trading account, trade, deposit, note and EA token you stored. It can't be undone.</p>
            {!demo && <p>You can sign up again later with the same email, starting from an empty journal.</p>}
          </ConfirmDelete>
        ) : (
          <>
            <p className="muted small">Removes your sign-in and all of your journal data immediately. Any Expert Advisor still running stops being accepted.</p>
            <div><button className="button danger" onClick={() => setDeleting(true)}>Delete my account…</button></div>
          </>
        )}
      </section>
    </>
  )
}
