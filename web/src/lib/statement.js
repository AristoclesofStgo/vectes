// Parser for the MT4 "Detailed Statement" (File → Save as Detailed Report, .htm).
// Runs entirely in the browser: the file never leaves the visitor's computer, only the
// normalised trades are saved. Times stay in broker-server seconds here; the importer
// converts them to UTC with the account's offset (see _shared/servertime.js).

const text = (el) => (el?.textContent ?? '').replace(/ /g, ' ').trim()

// "1 000.00" / "-2.82" / "" -> number (MT4 uses a space as the thousands separator)
const num = (s) => {
  const clean = String(s).replace(/[\s ]/g, '')
  if (clean === '') return 0
  const n = Number(clean)
  return Number.isFinite(n) ? n : NaN
}

// "2026.10.02 16:58:27" -> seconds, read as if UTC (it is broker-server time)
const serverSeconds = (s) => {
  const m = String(s).match(/^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!m) return NaN
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)) / 1000
}

export class StatementError extends Error {}

export function parseStatement(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const generator = doc.querySelector('meta[name="generator"]')?.getAttribute('content') ?? ''
  const title = text(doc.querySelector('title'))
  if (!/MetaQuotes/i.test(generator) && !/^Statement/i.test(title)) {
    throw new StatementError('This file is not an MT4 statement. In MT4 open the Account History tab, right-click and choose "Save as Detailed Report".')
  }
  if (/Trade History Report|ReportHistory/i.test(title + html.slice(0, 4000))) {
    throw new StatementError('This looks like an MT5 report. Only MT4 Detailed Statements are supported for now.')
  }

  const cells = [...doc.querySelectorAll('td')]
  const after = (label) => {
    const cell = cells.find((td) => text(td).startsWith(label))
    return cell ? text(cell).slice(label.length).trim() : null
  }
  const account = after('Account:')
  const currency = after('Currency:') || 'USD'
  const broker = text(doc.querySelector('body div b')) || text(doc.querySelector('b'))
  if (!account || !/^\d+$/.test(account)) throw new StatementError('Could not find the account number in this statement.')

  // Walk the rows, tracking which section of the report we're in
  const trades = []
  const cash = []
  let section = null
  let skipped = 0
  let openTrades = 0
  for (const tr of doc.querySelectorAll('tr')) {
    const tds = [...tr.querySelectorAll('td')]
    const first = text(tds[0])
    if (/^Closed Transactions:/i.test(first)) { section = 'closed'; continue }
    if (/^Open Trades:/i.test(first)) { section = 'open'; continue }
    if (/^(Working Orders|Summary|Details):/i.test(first)) { section = null; continue }
    if (!/^\d+$/.test(first)) continue // headers, totals, comment rows

    const type = text(tds[2]).toLowerCase()
    if (section === 'open') { if (type === 'buy' || type === 'sell') openTrades++; continue }
    if (section !== 'closed') continue

    if (type === 'buy' || type === 'sell') {
      if (tds.length < 14) { skipped++; continue }
      const row = {
        ticket: first,
        open_time: serverSeconds(text(tds[1])),
        type,
        lots: num(text(tds[3])),
        symbol: text(tds[4]),
        open_price: num(text(tds[5])),
        sl: num(text(tds[6])),
        tp: num(text(tds[7])),
        close_time: serverSeconds(text(tds[8])),
        close_price: num(text(tds[9])),
        commission: num(text(tds[10])),
        taxes: num(text(tds[11])),
        swap: num(text(tds[12])),
        profit: num(text(tds[13])),
      }
      const valid = Object.values(row).every((v) => typeof v === 'string' || Number.isFinite(v)) && row.lots > 0 && row.close_time >= row.open_time
      if (valid) trades.push(row)
      else skipped++
    } else if (type === 'balance' || type === 'credit') {
      const amount = num(text(tds.at(-1)))
      const time = serverSeconds(text(tds[1]))
      if (Number.isFinite(amount) && amount !== 0 && Number.isFinite(time)) {
        cash.push({ ticket: first, kind: type, amount, time, comment: text(tds[3]) || tr.querySelector('[title]')?.getAttribute('title') || null })
      } else skipped++
    } else {
      skipped++ // cancelled pending orders (buy limit, sell stop…) never became trades
    }
  }

  // Summary values sit in the cell after their label: <td>Balance:</td><td>938.65</td>
  const balanceLabel = cells.find((td) => text(td) === 'Balance:')
  const balance = balanceLabel?.nextElementSibling ? num(text(balanceLabel.nextElementSibling)) : NaN
  return {
    broker: broker || 'MT4 broker',
    account,
    currency,
    balance: Number.isFinite(balance) ? balance : null,
    trades,
    cash,
    skipped,
    openTrades,
  }
}
