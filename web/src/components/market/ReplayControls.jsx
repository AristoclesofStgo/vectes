import { SPEEDS } from '../../hooks/useReplay.js'
import { formatDate } from '../../lib/format.js'

export default function ReplayControls({ replay, total, currentTime, intraday }) {
  if (!replay.active) return null
  const when = currentTime
    ? formatDate(currentTime, intraday
      ? { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }
      : undefined)
    : ''

  return (
    <div className="replay" role="group" aria-label="Market replay">
      <span className="replay-badge"><span className="dot" aria-hidden="true" />Replay</span>
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
        min={2}
        max={total}
        value={replay.cursor}
        onChange={(e) => replay.seek(Number(e.target.value))}
        aria-label="Replay position"
      />
      <span className="replay-time small">{when}</span>
      <button className="button ghost" onClick={replay.stop}>Exit replay</button>
    </div>
  )
}
