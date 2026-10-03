import { RANGES, SPEEDS } from '../../hooks/useReplay.js'
import { formatDate } from '../../lib/format.js'

// <input type="date"> speaks YYYY-MM-DD; bar times are UTC seconds
const toDateInput = (seconds) => new Date(seconds * 1000).toISOString().slice(0, 10)
const fromDateInput = (value) => Date.parse(`${value}T00:00:00Z`) / 1000

export default function ReplayControls({ replay, times, currentTime, intraday }) {
  if (!replay.active) return null
  const total = times.length
  const when = currentTime
    ? formatDate(currentTime, intraday
      ? { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }
      : undefined)
    : ''
  const startTime = times[replay.from]
  const played = replay.cursor - replay.from
  const length = total - replay.from

  return (
    <div className="replay" role="group" aria-label="Market replay">
      <div className="replay-row">
        <span className="replay-badge"><span className="dot" aria-hidden="true" />Replay</span>
        <span className="field-label">From</span>
        <div className="segmented" role="radiogroup" aria-label="Replay period">
          {RANGES.map((r) => (
            <button key={r.id} role="radio" aria-checked={replay.range === r.id} className={replay.range === r.id ? 'active' : ''} onClick={() => replay.chooseRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <input
          className={`input replay-date${replay.range === 'custom' ? ' active' : ''}`}
          type="date"
          min={toDateInput(times[2])}
          max={toDateInput(times[total - 1])}
          value={startTime ? toDateInput(startTime) : ''}
          onChange={(e) => e.target.value && replay.chooseDate(fromDateInput(e.target.value))}
          aria-label="Replay start date"
        />
        <span className="muted small replay-progress">{played} of {length} bars</span>
        <button className="button ghost replay-exit" onClick={replay.stop}>Exit replay</button>
      </div>

      <div className="replay-row">
        <div className="replay-buttons">
          <button className="icon-button" onClick={() => replay.step(-1)} aria-label="Previous bar" title="Previous bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zM9.5 12 18 6v12z" /></svg>
          </button>
          <button className="icon-button primary" onClick={replay.togglePlay} aria-label={replay.playing ? 'Pause' : 'Play'} title={replay.playing ? 'Pause' : 'Play'}>
            {replay.playing
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>}
          </button>
          <button className="icon-button" onClick={() => replay.step(1)} aria-label="Next bar" title="Next bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6h2v12h-2zM6 6l8.5 6L6 18z" /></svg>
          </button>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Replay speed">
          {SPEEDS.map((s) => (
            <button key={s.id} role="radio" aria-checked={replay.speed === s.id} className={replay.speed === s.id ? 'active' : ''} onClick={() => replay.setSpeed(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <input
          className="replay-slider"
          type="range"
          min={replay.from}
          max={total}
          value={replay.cursor}
          onChange={(e) => replay.seek(Number(e.target.value))}
          aria-label="Replay position"
        />
        <span className="replay-time small">{when}</span>
      </div>
    </div>
  )
}
