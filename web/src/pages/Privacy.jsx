import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import Footer from '../components/Footer.jsx'
import { ThemeToggle } from '../components/Header.jsx'

export default function Privacy() {
  return (
    <div className="app">
      <header className="auth-top">
        <Link to="/" className="brand" aria-label="Vectes home"><Logo size={24} /></Link>
        <ThemeToggle />
      </header>

      <main className="prose">
        <h1>Privacy &amp; terms</h1>
        <p className="muted">Last updated October 2, 2026</p>

        <p>
          Vectes is a portfolio project: a market-data site with a personal MetaTrader 4 trading journal. It is
          free, has no ads and no tracking. This page explains exactly what it stores and how to remove it.
        </p>

        <h2>What Vectes stores</h2>
        <ul>
          <li><strong>Your sign-in.</strong> Your email and password are handled by Supabase Auth; the password is stored only as a secure hash. Demo visitors get an anonymous sign-in with no email.</li>
          <li><strong>Trading data you send.</strong> For each trading account: broker name, account number, currency, balance and the broker's time zone. For each closed trade: ticket, symbol, side, volume, open and close times and prices, stop loss, take profit, commission, swap, taxes and profit. Deposits and withdrawals with their amount, time and comment.</li>
          <li><strong>Your notes and tags</strong> on trades.</li>
          <li><strong>Expert Advisor tokens:</strong> only a SHA-256 hash and the first characters, never the token itself.</li>
        </ul>

        <h2>What Vectes never stores</h2>
        <ul>
          <li>Broker, trading or investor passwords. The Expert Advisor uses its own revocable token and cannot place trades.</li>
          <li>Statement files. A Detailed Statement is read inside your browser; only the normalised trades are saved. The name printed on the statement is ignored.</li>
          <li>Open positions or pending orders, until they close.</li>
        </ul>

        <h2>Who can see it</h2>
        <p>
          Every table is protected by row-level security in Postgres: your data is only returned to your own sign-in.
          The database is hosted by Supabase (Amazon Web Services, US West). The project owner has administrative
          access to it, as any database administrator does, and only looks at stored data to fix a problem you report.
          Nothing is sold or shared.
        </p>

        <h2>In your browser</h2>
        <p>
          Vectes keeps your session, theme and chart preferences in your browser's local storage. There are no
          analytics or advertising cookies. Fonts load from Google Fonts and market data from GitHub Pages, which
          see the usual request details (such as your IP address) like any website you visit.
        </p>

        <h2>Keeping and deleting data</h2>
        <ul>
          <li>Demo accounts expire after 7 days and are deleted, with their sample data, the day after.</li>
          <li>Real accounts keep their data until you remove it. In the <Link className="link accent" to="/journal">Journal</Link> you can remove one trading account; on the <Link className="link accent" to="/account">account page</Link> you can delete your whole Vectes account. Both take effect immediately.</li>
          <li>Revoking an Expert Advisor token stops further syncs from that terminal.</li>
        </ul>

        <h2>Not investment advice</h2>
        <p>
          Vectes is for education and personal record-keeping. Nothing on the site is a recommendation to buy or
          sell anything. Market data comes from public sources (Yahoo Finance, CoinGecko) and may be delayed or
          incomplete; statistics are calculated from the data you provide and may differ from your broker's.
          Demo trades are synthetic. Use the site at your own risk.
        </p>

        <h2>Independence</h2>
        <p>
          Vectes is not affiliated with MetaQuotes, MetaTrader or any broker. MetaTrader is a trademark of
          MetaQuotes Ltd.
        </p>

        <h2>Questions</h2>
        <p>
          Open an issue on <a className="link accent" href="https://github.com/AristoclesofStgo/vectes/issues" target="_blank" rel="noreferrer">GitHub</a>.
        </p>
      </main>

      <Footer />
    </div>
  )
}
