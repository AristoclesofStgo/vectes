import { useCallback, useEffect, useRef, useState } from 'react'

export const SPEEDS = [
  { id: 1,  label: '1×',  ms: 450 },
  { id: 4,  label: '4×',  ms: 120 },
  { id: 16, label: '16×', ms: 30 },
]

// How far back the replay starts; bars before it stay on the chart as context
export const RANGES = [
  { id: '1w', label: '1W', days: 7 },
  { id: '1m', label: '1M', days: 30 },
  { id: '3m', label: '3M', days: 91 },
  { id: '6m', label: '6M', days: 182 },
  { id: '1y', label: '1Y', days: 365 },
]
const DEFAULT_RANGE = '3m'
const MIN_BARS = 2

// First bar at or after `time` (seconds), never before the second bar
function indexAt(times, time) {
  const i = times.findIndex((t) => t >= time)
  return Math.max(MIN_BARS, i === -1 ? times.length - 1 : i)
}

/**
 * Market replay: reveals bars one at a time as if they were arriving live,
 * starting from a chosen range (1W…1Y) or date. `cursor` is the number of
 * visible bars (null when replay is off); `from` is where playback began.
 */
export function useReplay(times, resetKey) {
  const total = times.length
  const [cursor, setCursor] = useState(null)
  const [from, setFrom] = useState(null)
  const [range, setRange] = useState(DEFAULT_RANGE) // a RANGES id, or 'custom'
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(4)
  const timer = useRef(null)

  const stop = useCallback(() => {
    setPlaying(false)
    setCursor(null)
    setFrom(null)
  }, [])

  // A different asset/interval/currency ends the replay
  useEffect(() => { stop() }, [resetKey, stop])

  const startAt = useCallback((index) => {
    const i = Math.min(Math.max(MIN_BARS, index), total)
    setFrom(i)
    setCursor(i)
    setPlaying(true)
  }, [total])

  const rangeStart = useCallback((id) => {
    const r = RANGES.find((x) => x.id === id) ?? RANGES.find((x) => x.id === DEFAULT_RANGE)
    return indexAt(times, times[total - 1] - r.days * 86400)
  }, [times, total])

  const start = useCallback(() => startAt(rangeStart(range === 'custom' ? DEFAULT_RANGE : range)), [startAt, rangeStart, range])

  // Picking a range or a date restarts playback from there
  const chooseRange = useCallback((id) => {
    setRange(id)
    startAt(rangeStart(id))
  }, [startAt, rangeStart])

  const chooseDate = useCallback((seconds) => {
    setRange('custom')
    startAt(indexAt(times, seconds))
  }, [startAt, times])

  useEffect(() => {
    clearInterval(timer.current)
    if (!playing || cursor == null) return
    const ms = SPEEDS.find((s) => s.id === speed)?.ms ?? 120
    timer.current = setInterval(() => {
      setCursor((c) => {
        if (c >= total) {
          setPlaying(false)
          return total
        }
        return c + 1
      })
    }, ms)
    return () => clearInterval(timer.current)
  }, [playing, speed, total, cursor == null])

  // Play at the end goes back to the chosen start
  const togglePlay = useCallback(() => {
    setCursor((c) => (c != null && c >= total ? from ?? c : c))
    setPlaying((p) => !p)
  }, [total, from])

  const step = useCallback((delta) => {
    setPlaying(false)
    setCursor((c) => Math.min(total, Math.max(MIN_BARS, (c ?? total) + delta)))
  }, [total])

  const seek = useCallback((value) => {
    setPlaying(false)
    setCursor(Math.min(total, Math.max(MIN_BARS, value)))
  }, [total])

  return {
    active: cursor != null, cursor, from, range, playing, speed,
    setSpeed, start, stop, togglePlay, step, seek, chooseRange, chooseDate,
  }
}
