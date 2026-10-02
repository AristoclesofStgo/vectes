// In-browser SQL over the site's datasets with DuckDB-WASM.
// The engine (~7 MB, from jsDelivr) is only downloaded on the first query.

import { loadJson } from './data.js'

let ready = null

const csvCell = (v) => {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const toCsv = (header, rows) => [header.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n')
const isoDate = (unix) => new Date(unix * 1000).toISOString().slice(0, 10)
const isoTime = (unix) => new Date(unix * 1000).toISOString().slice(0, 19).replace('T', ' ')

async function buildTables() {
  const [assets, prices, pipeline] = await Promise.all([
    loadJson('assets.json'), loadJson('prices_1d.json'), loadJson('pipeline.json'),
  ])
  const ids = assets.assets.map((a) => a.id)
  const candles = await Promise.all(ids.map((id) => loadJson(`candles/1d/${id}.json`)))

  const tables = {}
  tables.assets = toCsv(
    ['id', 'name', 'category', 'unit', 'pair', 'quote', 'investable', 'ticker'],
    assets.assets.map((a) => [a.id, a.name, a.category, a.unit, a.pair, a.quote, a.investable, a.ticker]),
  )
  tables.prices = toCsv(
    ['date', 'asset', 'close', 'traded'],
    ids.flatMap((id) => prices.time.map((t, i) => [isoDate(t), id, prices.series[id].close[i], Boolean(prices.series[id].traded[i])])),
  )
  tables.candles_1d = toCsv(
    ['asset', 'date', 'open', 'high', 'low', 'close', 'volume'],
    candles.flatMap((c) => c.data.map(([t, o, h, l, cl, v]) => [c.asset, isoDate(t), o, h, l, cl, v])),
  )
  tables.pipeline_snapshots = toCsv(
    ['asset', 'slot_time', 'close', 'stale', 'diff_bps'],
    Object.entries(pipeline.series).flatMap(([id, s]) => pipeline.time.map((t, i) => [
      id, isoTime(t), s.close[i], s.stale[i] === 1, pipeline.reconciliation[id]?.diff_bps[i],
    ])).filter((r) => r[2] != null),
  )
  return tables
}

async function init(onStatus) {
  onStatus?.('Downloading SQL engine…')
  const duckdb = await import('@duckdb/duckdb-wasm')
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles())
  // Cross-origin workers are not allowed directly, so bootstrap through a blob URL
  const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }))
  const worker = new Worker(workerUrl)
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  URL.revokeObjectURL(workerUrl)

  onStatus?.('Loading tables…')
  const conn = await db.connect()
  const tables = await buildTables()
  for (const [name, csv] of Object.entries(tables)) {
    await db.registerFileText(`${name}.csv`, csv)
    await conn.query(`CREATE TABLE ${name} AS SELECT * FROM read_csv_auto('${name}.csv', header = true)`)
  }
  onStatus?.(null)
  return conn
}

function cellValue(value, type) {
  if (value == null) return null
  if (typeof value === 'bigint') return Number(value)
  const t = String(type)
  if (t.startsWith('Date')) return new Date(value).toISOString().slice(0, 10)
  if (t.startsWith('Timestamp')) return new Date(value).toISOString().slice(0, 19).replace('T', ' ')
  if (typeof value === 'object') return JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
  return value
}

export async function runQuery(sql, onStatus) {
  if (!ready) {
    ready = init(onStatus)
    ready.catch(() => { ready = null })
  }
  const conn = await ready
  const started = performance.now()
  const result = await conn.query(sql)
  const fields = result.schema.fields
  const rows = result.toArray().map((row) => fields.map((f) => cellValue(row[f.name], f.type)))
  return { columns: fields.map((f) => f.name), rows, ms: performance.now() - started }
}

export const EXAMPLES = [
  {
    label: 'Best and worst performers',
    sql: `-- 1-year price change per asset, best first
SELECT a.id, a.name, a.category,
       round(100 * (arg_max(p.close, p.date) / arg_min(p.close, p.date) - 1), 2) AS change_pct
FROM prices p JOIN assets a ON a.id = p.asset
WHERE a.investable
GROUP BY ALL
ORDER BY change_pct DESC;`,
  },
  {
    label: 'Bitcoin monthly returns',
    sql: `-- Month-end closes and month-over-month return
WITH month_end AS (
  SELECT date_trunc('month', date) AS month, arg_max(close, date) AS close
  FROM prices WHERE asset = 'BTC'
  GROUP BY 1
)
SELECT strftime(month, '%Y-%m') AS month, round(close, 0) AS close,
       round(100 * (close / lag(close) OVER (ORDER BY month) - 1), 2) AS return_pct
FROM month_end ORDER BY month;`,
  },
  {
    label: 'Biggest daily moves in gold',
    sql: `-- Days when gold moved more than 2%
SELECT date, close,
       round(100 * (close / lag(close) OVER (ORDER BY date) - 1), 2) AS move_pct
FROM candles_1d WHERE asset = 'XAU'
QUALIFY abs(move_pct) > 2
ORDER BY abs(move_pct) DESC;`,
  },
  {
    label: 'BTC vs S&P 500 correlation',
    sql: `-- Correlation of daily returns on days both traded
WITH r AS (
  SELECT asset, date, close / lag(close) OVER (PARTITION BY asset ORDER BY date) - 1 AS ret
  FROM candles_1d WHERE asset IN ('BTC', 'SPX')
)
SELECT round(corr(b.ret, s.ret), 3) AS correlation, count(*) AS days
FROM r b JOIN r s ON b.date = s.date
WHERE b.asset = 'BTC' AND s.asset = 'SPX';`,
  },
  {
    label: 'Pipeline vs reference',
    sql: `-- How closely did the 2026 AWS pipeline match Yahoo Finance?
SELECT p.asset, a.category,
       count(*) FILTER (WHERE NOT stale) AS fresh_snapshots,
       round(avg(abs(diff_bps)) FILTER (WHERE NOT stale), 1) AS mean_abs_diff_bps
FROM pipeline_snapshots p JOIN assets a ON a.id = p.asset
GROUP BY ALL
ORDER BY mean_abs_diff_bps DESC;`,
  },
]
