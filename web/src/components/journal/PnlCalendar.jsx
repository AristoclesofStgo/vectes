import { useMemo, useState } from 'react'
import { chartTokens, inkOn } from '../../lib/chartTheme.js'
import { dailyPnl, WEEKDAYS } from '../../lib/journalStats.js'

const monthKey = (key) => key.slice(0, 7)
const monthLabel = (ym) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

// Diverging fill: strong pole above half of the largest day, soft step below it
function fillFor(net, maxAbs, t) {
  const [neg, negSoft, , posSoft, pos] = t.diverging
  if (!net) return null
  const strong = Math.abs(net) >= maxAbs / 2
  return net > 0 ? (strong ? pos : posSoft) : (strong ? neg : negSoft)
}

export default function PnlCalendar({ trades, money, theme }) {
  const days = useMemo(() => dailyPnl(trades), [trades])
  const months = useMemo(() => [...new Set([...days.keys()].map(monthKey))].sort(), [days])
  const [picked, setPicked] = useState(null)
  const month = months.includes(picked) ? picked : months.at(-1)
  const idx = months.indexOf(month)

  const { cells, total, tradeCount, maxAbs } = useMemo(() => {
    if (!month) return { cells: [], total: 0, tradeCount: 0, maxAbs: 0 }
    const [y, m] = month.split('-').map(Number)
    const first = new Date(Date.UTC(y, m - 1, 1))
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const lead = (first.getUTCDay() + 6) % 7 // Monday-first grid
    const out = Array.from({ length: lead }, () => null)
    let total = 0, tradeCount = 0, maxAbs = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${month}-${String(d).padStart(2, '0')}`
      const v = days.get(key)
      if (v) { total += v.net; tradeCount += v.count; maxAbs = Math.max(maxAbs, Math.abs(v.net)) }
      out.push({ day: d, key, ...v })
    }
    return { cells: out, total, tradeCount, maxAbs }
  }, [month, days])

  const t = useMemo(() => chartTokens(), [theme]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!month) return null
  return (
    <section className="card calendar" aria-label="Daily P&L calendar">
      <div className="card-head">
        <div>
          <h2>Daily P&L</h2>
          <span className="muted small">{tradeCount} trades · <span className={total > 0 ? 'up' : total < 0 ? 'down' : ''}>{money(total, true)}</span> this month · days in UTC</span>
        </div>
        <div className="calendar-nav">
          <button className="icon-button" onClick={() => setPicked(months[idx - 1])} disabled={idx <= 0} aria-label="Previous month">‹</button>
          <span className="calendar-month">{monthLabel(month)}</span>
          <button className="icon-button" onClick={() => setPicked(months[idx + 1])} disabled={idx >= months.length - 1} aria-label="Next month">›</button>
        </div>
      </div>
      <div className="calendar-grid" role="grid">
        {WEEKDAYS.map((d) => <div key={d} className="calendar-head" role="columnheader">{d}</div>)}
        {cells.map((c, i) => {
          if (!c) return <div key={`pad-${i}`} className="calendar-cell pad" aria-hidden="true" />
          const fill = fillFor(c.net, maxAbs, t)
          const label = c.count ? `${c.key}: ${money(c.net, true)} from ${c.count} trade${c.count > 1 ? 's' : ''}` : `${c.key}: no trades`
          return (
            <div
              key={c.key}
              role="gridcell"
              className={`calendar-cell${c.count ? ' traded' : ''}`}
              style={fill ? { background: fill, color: inkOn(fill) } : undefined}
              title={label}
              aria-label={label}
            >
              <span className="calendar-day">{c.day}</span>
              {c.count > 0 && (
                <>
                  <span className="calendar-pnl">{money(c.net, true, Math.abs(c.net) >= 1000)}</span>
                  <span className="calendar-count">{c.count}×</span>
                </>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
