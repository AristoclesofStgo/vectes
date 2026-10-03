import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import Footer from '../components/Footer.jsx'
import TickerTape from '../components/market/TickerTape.jsx'
import { ThemeToggle } from '../components/Header.jsx'
import { useAuth, hasAccess, DEMO_DAYS } from '../lib/auth.js'
import { useJson } from '../lib/data.js'
import { quoteSummary } from '../lib/stats.js'

const media = (file) => `${import.meta.env.BASE_URL}media/${file}`

const STATS = [
  ['24', 'assets across six markets'],
  ['1 year', 'of daily and 4-hour candles'],
  ['Daily', 'automated data refresh'],
  ['MT4', 'trade sync via Expert Advisor'],
]

const FEATURES = [
  {
    id: 'market',
    title: 'Market',
    text: 'Candlestick charts for crypto, currencies, metals, energy and equity indices, with moving averages, Bollinger Bands, RSI, asset comparison, prices in six currencies and a bar-by-bar replay mode.',
    image: 'market.webp',
  },
  {
    id: 'analysis',
    title: 'Analysis',
    text: 'Cross-asset analytics: a correlation heatmap, risk versus return, rolling correlations between any pair and ratio charts like gold/silver or BTC/ETH.',
    image: 'analysis.webp',
  },
  {
    id: 'portfolio',
    title: 'Portfolio',
    text: 'A backtester with dollar-cost averaging, rebalancing, benchmarks and an efficient frontier. Every setting lives in the URL, so a portfolio can be shared as a link.',
    image: 'portfolio.webp',
  },
  {
    id: 'datalab',
    title: 'Data Lab',
    text: 'The pipeline behind the site: architecture, data quality checks, reconciliation against the original AWS + Snowflake ETL and a SQL console that runs DuckDB in your browser.',
    image: 'sql.webp',
  },
]

const STEPS = [
  ['Create your account', 'Sign up with email or Google. Your trades are private to you — every table is protected by row-level security.'],
  ['Attach the Expert Advisor', 'Generate a personal token in Vectes and paste it into the Vectes EA on any MT4 chart. No broker password is ever requested.'],
  ['Trade as usual', 'Each closed trade is sent to your Journal with its entry, exit, swap and commission, and plotted on the same candles as the rest of Vectes.'],
]

const STACK = [
  ['Frontend', 'React · Vite · Zustand · lightweight-charts · ECharts · DuckDB-WASM'],
  ['Data pipeline', 'Python · pandas · Yahoo Finance · CoinGecko · GitHub Actions'],
  ['Backend', 'Supabase Auth · Postgres with row-level security · Edge Functions'],
  ['Trading', 'MQL4 Expert Advisor · MT4 Detailed Statement parser'],
  ['Origins', 'AWS Lambda · S3 · EventBridge · Snowflake · Tableau'],
]

function LoopVideo({ src, poster, className }) {
  const ref = useRef(null)
  // Respect reduced-motion: keep the poster frame instead of playing
  useEffect(() => {
    const video = ref.current
    if (!video) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) video.pause()
    else video.play().catch(() => {})
  }, [])
  return (
    <video
      ref={ref}
      className={className}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
    />
  )
}

export default function Home() {
  const navigate = useNavigate()
  const session = useAuth((s) => s.session)
  const startDemo = useAuth((s) => s.startDemo)
  const assets = useJson('assets.json')
  const prices = useJson('prices_1d.json')

  const quotes = useMemo(() => {
    if (!assets.data || !prices.data) return []
    return assets.data.assets.map((a) => ({ ...a, ...quoteSummary(prices.data.series[a.id]) }))
  }, [assets.data, prices.data])

  const signedIn = hasAccess(session)
  const [demo, setDemo] = useState({ busy: false, error: null })

  const tryDemo = async () => {
    if (demo.busy) return
    if (!signedIn) {
      setDemo({ busy: true, error: null })
      try {
        await startDemo()
      } catch {
        setDemo({ busy: false, error: 'The demo could not start. Please try again in a moment.' })
        return
      }
    }
    navigate('/market')
  }
  const demoLabel = demo.busy ? 'Preparing demo…' : 'Try the demo'
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="app home">
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="brand" aria-label="Vectes home"><Logo size={26} /></Link>
          <nav className="home-nav" aria-label="Page sections">
            <button onClick={() => scrollTo('features')}>Features</button>
            <button onClick={() => scrollTo('journal')}>Journal</button>
            <button onClick={() => scrollTo('built')}>How it's built</button>
          </nav>
          <div className="header-actions">
            <ThemeToggle />
            {signedIn ? (
              <Link className="button primary" to="/market">Open Vectes</Link>
            ) : (
              <>
                <Link className="button ghost" to="/login">Log in</Link>
                <button className="button primary hide-sm" onClick={tryDemo} disabled={demo.busy}>Try demo</button>
              </>
            )}
          </div>
        </div>
      </header>

      <TickerTape items={quotes} onSelect={(id) => navigate(`/market?asset=${id}`)} />

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">Market data · Trading journal</span>
            <h1>Your trades, measured against the market.</h1>
            <p className="lead">
              Vectes combines a year of market data for 24 assets with a personal trading journal.
              Connect MetaTrader 4 and every closed trade lands next to the charts, analytics and
              backtests you already use.
            </p>
            <div className="hero-actions">
              <button className="button primary lg" onClick={tryDemo} disabled={demo.busy}>{demoLabel}</button>
              <Link className="button lg" to="/signup">Create an account</Link>
            </div>
            {demo.error
              ? <p className="small down" role="alert">{demo.error}</p>
              : <p className="muted small">Demo access lasts {DEMO_DAYS} days with sample trades. No sign-up needed.</p>}
          </div>
          <div className="hero-media">
            <LoopVideo className="hero-video" src={media('hero.mp4')} poster={media('hero-poster.jpg')} />
          </div>
        </section>

        <section className="stats-band" aria-label="Vectes in numbers">
          {STATS.map(([value, label]) => (
            <div key={label} className="stat">
              <strong>{value}</strong>
              <span className="muted">{label}</span>
            </div>
          ))}
        </section>

        <section id="features" className="section">
          <div className="section-head">
            <span className="eyebrow">Features</span>
            <h2>Everything in one place</h2>
            <p className="muted">Five tabs, one dataset. All of it is available in the demo.</p>
          </div>
          <div className="feature-list">
            {FEATURES.map((f) => (
              <article key={f.id} className="feature">
                <div className="feature-copy">
                  <h3>{f.title}</h3>
                  <p className="muted">{f.text}</p>
                </div>
                <figure className="feature-shot">
                  <img src={media(f.image)} alt={`${f.title} tab screenshot`} loading="lazy" decoding="async" />
                </figure>
              </article>
            ))}
          </div>
        </section>

        <section id="journal" className="journal-band">
          <LoopVideo className="band-video" src={media('journal.mp4')} poster={media('journal-poster.jpg')} />
          <div className="band-inner">
            <div className="section-head">
              <span className="eyebrow">New · Journal</span>
              <h2>Your MetaTrader 4 trades, synced automatically</h2>
              <p>
                The Journal tab turns your trading history into statistics: net P&amp;L, win rate,
                profit factor, drawdown, a P&amp;L calendar and every trade drawn on the chart.
                Prefer not to install anything? Upload an MT4 Detailed Statement instead.
              </p>
            </div>
            <ol className="steps">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="step">
                  <span className="step-index">{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="built" className="section">
          <div className="section-head">
            <span className="eyebrow">How it's built</span>
            <h2>An end-to-end data engineering project</h2>
          </div>
          <dl className="stack">
            {STACK.map(([k, v]) => (
              <div key={k} className="stack-row">
                <dt>{k}</dt>
                <dd className="muted">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="cta">
          <h2>See it with real data</h2>
          <p className="muted">Open the demo and explore every tab for {DEMO_DAYS} days.</p>
          <div className="hero-actions">
            <button className="button primary lg" onClick={tryDemo} disabled={demo.busy}>{demoLabel}</button>
            <Link className="button lg" to="/login">Log in</Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
