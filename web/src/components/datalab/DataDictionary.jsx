import { SNOWFLAKE_TABLES, SQL_TABLES } from '../../lib/dictionary.js'

function TableDoc({ table, open }) {
  return (
    <details className="dict-table" open={open}>
      <summary>
        <code>{table.name}</code>
        <span className="muted small">{table.description}</span>
      </summary>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Column</th><th>Type</th><th>Description</th></tr>
          </thead>
          <tbody>
            {table.columns.map(([name, type, desc]) => (
              <tr key={name}>
                <td><code>{name}</code></td>
                <td className="muted"><code>{type}</code></td>
                <td className="wrap">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export default function DataDictionary() {
  return (
    <section className="card" aria-label="Data dictionary">
      <div className="card-head">
        <div>
          <h2>Data dictionary</h2>
          <p className="muted small">The tables you can query above, and the original Snowflake schema they descend from.</p>
        </div>
      </div>
      <h3 className="detail-sub">Website datasets (SQL playground)</h3>
      {SQL_TABLES.map((t, i) => <TableDoc key={t.name} table={t} open={i === 0} />)}
      <h3 className="detail-sub">Original Snowflake schema (AWS pipeline)</h3>
      {SNOWFLAKE_TABLES.map((t) => <TableDoc key={t.name} table={t} />)}
    </section>
  )
}
