const LABELS = { crypto: 'Crypto', fx: 'Currencies', metals: 'Metals', energy: 'Oil' }

function Tile({ label, value, sub }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {sub && <span className="kpi-sub small muted">{sub}</span>}
    </div>
  )
}

const n = (v) => v.toLocaleString('en-US')

// Cleaning results for the original AWS pipeline exports
export default function QualityReport({ pipeline }) {
  const sources = pipeline.sources
  const sum = (key) => sources.reduce((a, s) => a + s[key], 0)
  const raw = sum('raw_rows')
  const clean = sum('clean_rows')

  return (
    <section className="card" aria-label="Data quality">
      <div className="card-head">
        <div>
          <h2>Data quality · original pipeline</h2>
          <p className="muted small">What cleaning the Snowflake exports found, and how each issue was handled.</p>
        </div>
      </div>

      <div className="kpi-row">
        <Tile label="Raw rows exported" value={n(raw)} sub={`${sources.length} Snowflake tables`} />
        <Tile label="Exact duplicates removed" value={n(sum('duplicate_rows'))} sub={`${((sum('duplicate_rows') / raw) * 100).toFixed(0)}% of all rows`} />
        <Tile label="Test runs collapsed" value={n(sum('collapsed_test_runs'))} sub="Manual runs on Jun 28" />
        <Tile label="Clean snapshots" value={n(clean)} sub={`${n(sum('stale_points'))} flagged as stale`} />
      </div>

      <div className="quality-grid">
        <div>
          <h3 className="detail-sub">Issues found and fixed</h3>
          <ul className="issues">
            {pipeline.issues.map((issue) => (
              <li key={issue}>
                <span className="issue-icon" aria-hidden="true">✓</span>
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Table</th>
                <th className="num">Raw</th>
                <th className="num">Duplicates</th>
                <th className="num hide-sm">Test runs</th>
                <th className="num">Clean</th>
                <th className="num hide-sm">Stale</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.table}>
                  <td><span className="asset-id">{s.table}</span> <span className="muted small hide-sm">{LABELS[s.category]} · {s.api}</span></td>
                  <td className="num">{n(s.raw_rows)}</td>
                  <td className="num">{n(s.duplicate_rows)}</td>
                  <td className="num hide-sm">{n(s.collapsed_test_runs)}</td>
                  <td className="num">{n(s.clean_rows)}</td>
                  <td className="num hide-sm">{n(s.stale_points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
