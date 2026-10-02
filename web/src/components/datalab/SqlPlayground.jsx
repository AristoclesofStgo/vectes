import { useState } from 'react'
import { EXAMPLES, runQuery } from '../../lib/duckdb.js'
import { SQL_TABLES } from '../../lib/dictionary.js'

const MAX_ROWS = 500

function formatCell(v) {
  if (v == null) return <span className="muted">NULL</span>
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toLocaleString('en-US', { maximumFractionDigits: 6 })
  return v
}

function downloadCsv(result) {
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
  const csv = [result.columns.join(','), ...result.rows.map((r) => r.map(esc).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: 'vectes-query.csv' })
  a.click()
  URL.revokeObjectURL(url)
}

export default function SqlPlayground() {
  const [sql, setSql] = useState(EXAMPLES[0].sql)
  const [status, setStatus] = useState(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const run = async () => {
    if (running || !sql.trim()) return
    setRunning(true)
    setError(null)
    try {
      setResult(await runQuery(sql, setStatus))
    } catch (e) {
      setResult(null)
      setError(String(e?.message ?? e).replace(/^Error:\s*/, ''))
    } finally {
      setStatus(null)
      setRunning(false)
    }
  }

  const onKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      run()
    }
  }

  return (
    <section className="card sql" aria-label="SQL playground">
      <div className="card-head">
        <div>
          <h2>SQL playground</h2>
          <p className="muted small">
            Query the site’s datasets with DuckDB, running entirely in your browser. Tables:{' '}
            {SQL_TABLES.map((t, i) => <span key={t.name}><code>{t.name}</code>{i < SQL_TABLES.length - 1 ? ', ' : ''}</span>)}.
          </p>
        </div>
      </div>

      <div className="chips sql-examples" role="group" aria-label="Example queries">
        {EXAMPLES.map((ex) => (
          <button key={ex.label} className={`chip${sql === ex.sql ? ' active' : ''}`} onClick={() => { setSql(ex.sql); setResult(null); setError(null) }}>
            {ex.label}
          </button>
        ))}
      </div>

      <textarea
        className="sql-editor"
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        rows={9}
        aria-label="SQL query"
      />

      <div className="sql-actions">
        <button className="button run" onClick={run} disabled={running}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
          {running ? 'Running…' : 'Run query'}
        </button>
        <span className="muted small">
          {status ?? (result ? `${result.rows.length.toLocaleString('en-US')} rows · ${result.ms.toFixed(0)} ms` : 'Ctrl + Enter to run · the engine (~7 MB) loads on the first query')}
        </span>
        {result?.rows.length > 0 && (
          <button className="button ghost small push" onClick={() => downloadCsv(result)}>Download CSV</button>
        )}
      </div>

      {error && <pre className="sql-error" role="alert">{error}</pre>}

      {result && (
        <div className="table-wrap sql-result">
          <table className="table">
            <thead>
              <tr>{result.columns.map((c) => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {result.rows.slice(0, MAX_ROWS).map((row, i) => (
                <tr key={i}>
                  {row.map((v, j) => <td key={j} className={typeof v === 'number' ? 'num' : ''}>{formatCell(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {result.rows.length > MAX_ROWS && (
            <p className="muted small">Showing the first {MAX_ROWS} of {result.rows.length.toLocaleString('en-US')} rows — download the CSV for all of them.</p>
          )}
        </div>
      )}
    </section>
  )
}
