// Current market history: what each nightly extract delivered per asset
export default function CoverageTable({ history, names }) {
  return (
    <section className="card" aria-label="History coverage">
      <div className="card-head">
        <h2>History coverage</h2>
      </div>
      <div className="table-wrap coverage">
        <table className="table">
          <thead>
            <tr>
              <th>Asset</th>
              <th className="hide-sm">Source ticker</th>
              <th className="num">Daily bars</th>
              <th className="num">4h bars</th>
              <th className="num hide-sm">First</th>
              <th className="num">Last</th>
            </tr>
          </thead>
          <tbody>
            {history.assets.map((a) => (
              <tr key={a.asset}>
                <td><span className="asset-id">{a.asset}</span> <span className="muted hide-sm">{names[a.asset]}</span></td>
                <td className="muted hide-sm"><code>{a.ticker}</code></td>
                <td className="num">{a.bars_1d}</td>
                <td className="num">{a.bars_4h.toLocaleString('en-US')}</td>
                <td className="num hide-sm">{a.first_day}</td>
                <td className="num">{a.last_day}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
