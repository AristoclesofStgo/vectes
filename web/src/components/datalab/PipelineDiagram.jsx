import { formatDate } from '../../lib/format.js'

const ORIGINAL = [
  { title: 'EventBridge', detail: 'Schedule · every 6 hours' },
  { title: 'Lambda Extract', detail: 'CoinGecko · ExchangeRate-API · Yahoo Finance' },
  { title: 'Amazon S3', detail: 'Raw JSON staging · raw/ → processed/' },
  { title: 'Lambda Load', detail: 'Inserts into Snowflake' },
  { title: 'Snowflake', detail: '4 tables · crypto, FX, metals, oil' },
  { title: 'Tableau', detail: 'Market dashboard' },
]

const CURRENT = [
  { title: 'GitHub Actions', detail: 'Cron · daily at 22:30 UTC' },
  { title: 'extract_history.py', detail: 'Yahoo Finance daily + hourly · CoinGecko' },
  { title: 'build_web_data.py', detail: 'Clean · align · validate · reconcile' },
  { title: 'Static datasets', detail: '52 JSON files · ~2.5 MB' },
  { title: 'GitHub Pages', detail: 'React + Vite build' },
  { title: 'Your browser', detail: 'Charts · simulator · DuckDB SQL' },
]

function Flow({ steps, tone }) {
  return (
    <ol className={`flow ${tone}`}>
      {steps.map((s, i) => (
        <li key={s.title} className="flow-step">
          <div className="flow-node">
            <span className="flow-index">{i + 1}</span>
            <strong>{s.title}</strong>
            <span className="muted small">{s.detail}</span>
          </div>
          {i < steps.length - 1 && <span className="flow-arrow" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  )
}

export default function PipelineDiagram({ quality }) {
  const extracted = quality?.extracted_at ? new Date(quality.extracted_at) : null
  return (
    <section className="card" aria-label="Pipeline architecture">
      <div className="card-head">
        <div>
          <h2>Pipeline architecture</h2>
          <p className="muted small">The project started as a serverless ETL on AWS; today the same idea runs for free on GitHub.</p>
        </div>
      </div>

      <div className="era">
        <div className="era-head">
          <span className="badge neutral">Jun 27 – Jul 11, 2026</span>
          <h3>Original ETL · AWS + Snowflake</h3>
        </div>
        <Flow steps={ORIGINAL} tone="original" />
      </div>

      <div className="era-bridge small">
        <span className="flow-arrow down" aria-hidden="true" />
        <span><code>clean_pipeline_exports.py</code> deduplicates the Snowflake exports and keeps them as <code>pipeline_snapshots</code></span>
      </div>

      <div className="era">
        <div className="era-head">
          <span className="badge">Live</span>
          <h3>Today · daily refresh on GitHub</h3>
          {extracted && (
            <span className="muted small">
              Last run {formatDate(extracted.getTime() / 1000)}, {extracted.toLocaleTimeString('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })} UTC
            </span>
          )}
        </div>
        <Flow steps={CURRENT} tone="current" />
      </div>
    </section>
  )
}
