import { useEffect, useMemo, useRef, useState } from 'react'

// Round flags for the calendar's currencies (flag-icons, MIT)
const FLAGS = import.meta.glob('../../assets/flags/*.svg', { eager: true, query: '?url', import: 'default' })
const flagFor = Object.fromEntries(Object.entries(FLAGS).map(([p, url]) => [p.match(/([A-Z]+)\.svg$/)[1], url]))

const IMPACT = {
  high: { label: 'High', level: 3 },
  medium: { label: 'Medium', level: 2 },
  low: { label: 'Low', level: 1 },
  holiday: { label: 'Holiday', level: 0 },
}

// Which currencies move an asset: everything is quoted in USD; FX pairs add their own currency
function relevantCurrencies(asset) {
  if (!asset) return null
  const own = asset.category === 'fx' ? [asset.id] : []
  return new Set(['USD', ...own])
}

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
const dayKey = (ms) => new Date(ms).toLocaleDateString('en-CA') // local YYYY-MM-DD
const dayLabel = (ms) => new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const timeLabel = (ms) => new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

function ImpactMark({ impact }) {
  const meta = IMPACT[impact] ?? IMPACT.low
  return (
    <span className={`impact impact-${impact}`} title={`${meta.label} impact`} aria-label={`${meta.label} impact`}>
      {impact === 'holiday' ? 'Holiday' : [1, 2, 3].map((i) => <span key={i} className={i <= meta.level ? 'on' : ''} />)}
    </span>
  )
}

export default function EconomicCalendar({ data, asset }) {
  const [impacts, setImpacts] = useState(['high', 'medium'])
  const [scope, setScope] = useState('relevant') // 'relevant' | 'all'
  const listRef = useRef(null)

  const relevant = relevantCurrencies(asset)
  const now = Date.now()

  const groups = useMemo(() => {
    const events = (data?.events ?? [])
      .map((e) => ({ ...e, ms: Date.parse(e.time) }))
      .filter((e) => impacts.includes(e.impact) || (e.impact === 'holiday' && impacts.includes('low')))
      .filter((e) => scope === 'all' || !relevant || relevant.has(e.currency))
    const byDay = new Map()
    for (const e of events) {
      const key = dayKey(e.ms)
      if (!byDay.has(key)) byDay.set(key, { key, label: dayLabel(e.ms), events: [] })
      byDay.get(key).events.push(e)
    }
    return [...byDay.values()]
  }, [data, impacts, scope, relevant ? [...relevant].join() : ''])  // eslint-disable-line react-hooks/exhaustive-deps

  const nextId = groups.flatMap((g) => g.events).find((e) => e.ms >= now)?.time

  // Open on today rather than last Sunday
  useEffect(() => {
    const today = listRef.current?.querySelector('[data-today="true"]')
    if (today && listRef.current) listRef.current.scrollTop = today.offsetTop - listRef.current.offsetTop
  }, [groups])

  const toggleImpact = (id) => setImpacts((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
  const todayKey = dayKey(now)

  return (
    <section className="card calendar-card" aria-labelledby="econ-title">
      <div className="card-head">
        <div>
          <h2 id="econ-title">Economic calendar</h2>
          <span className="muted small">This week · times in your time zone ({tz.replace(/_/g, ' ')})</span>
        </div>
        <div className="calendar-filters">
          <div className="segmented" role="group" aria-label="Impact">
            {['high', 'medium', 'low'].map((id) => (
              <button key={id} aria-pressed={impacts.includes(id)} className={impacts.includes(id) ? 'active' : ''} onClick={() => toggleImpact(id)}>
                {IMPACT[id].label}
              </button>
            ))}
          </div>
          <div className="segmented" role="radiogroup" aria-label="Currencies">
            <button role="radio" aria-checked={scope === 'relevant'} className={scope === 'relevant' ? 'active' : ''} onClick={() => setScope('relevant')}>
              {asset ? `For ${asset.id}` : 'Relevant'}
            </button>
            <button role="radio" aria-checked={scope === 'all'} className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>All</button>
          </div>
        </div>
      </div>

      {data?.error && !data?.events?.length ? (
        <p className="muted small">The calendar could not be updated today. It refreshes with the daily data run.</p>
      ) : (
        <div className="econ-list" ref={listRef}>
          <table className="table econ-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Cur.</th>
                <th>Impact</th>
                <th>Event</th>
                <th className="num">Forecast</th>
                <th className="num">Previous</th>
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.key} data-today={g.key === todayKey}>
                <tr className="econ-day">
                  <th colSpan={6}>{g.label}{g.key === todayKey ? ' · Today' : ''}</th>
                </tr>
                {g.events.map((e) => (
                  <tr key={`${e.time}-${e.currency}-${e.title}`} className={`${e.ms < now ? 'past' : ''}${e.time === nextId ? ' next' : ''}`}>
                    <td className="econ-time">{e.impact === 'holiday' ? 'All day' : timeLabel(e.ms)}</td>
                    <td>
                      <span className="econ-cur">
                        {flagFor[e.currency] && <img src={flagFor[e.currency]} alt="" width={16} height={16} />}
                        {e.currency}
                      </span>
                    </td>
                    <td><ImpactMark impact={e.impact} /></td>
                    <td className="econ-event">{e.title}{e.time === nextId && <span className="badge">Next</span>}</td>
                    <td className="num">{e.forecast || '—'}</td>
                    <td className="num">{e.previous || '—'}</td>
                  </tr>
                ))}
              </tbody>
            ))}
            {groups.length === 0 && (
              <tbody><tr><td colSpan={6} className="muted">No events match these filters this week.</td></tr></tbody>
            )}
          </table>
        </div>
      )}
      <p className="muted small source-note">Source: Forex Factory weekly calendar, refreshed daily{data?.stale ? ' (showing the last successful update)' : ''}.</p>
    </section>
  )
}
