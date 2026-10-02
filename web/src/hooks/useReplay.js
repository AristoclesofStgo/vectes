import { useCallback, useEffect, useRef, useState } from 'react'

export const SPEEDS = [
  { id: 1,  label: '1×',  ms: 450 },
  { id: 4,  label: '4×',  ms: 120 },
  { id: 16, label: '16×', ms: 30 },
]

/**
 * Market replay: reveals bars one at a time as if they were arriving live.
 * `cursor` is the number of visible bars (null when replay is off).
 */
export function useReplay(total, resetKey) {
  const [cursor, setCursor] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(4)
  const timer = useRef(null)

  const stop = useCallback(() => {
    setPlaying(false)
    setCursor(null)
  }, [])

  // A different asset/interval/currency ends the replay
  useEffect(() => { stop() }, [resetKey, stop])

  const start = useCallback(() => {
    // Begin a quarter of the way in so indicators have history to work with
    setCursor(Math.max(60, Math.floor(total * 0.25)))
    setPlaying(true)
  }, [total])

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

  const togglePlay = useCallback(() => {
    setCursor((c) => (c != null && c >= total ? Math.max(60, Math.floor(total * 0.25)) : c))
    setPlaying((p) => !p)
  }, [total])

  const step = useCallback((delta) => {
    setPlaying(false)
    setCursor((c) => Math.min(total, Math.max(2, (c ?? total) + delta)))
  }, [total])

  const seek = useCallback((value) => {
    setPlaying(false)
    setCursor(Math.min(total, Math.max(2, value)))
  }, [total])

  return { active: cursor != null, cursor, playing, speed, setSpeed, start, stop, togglePlay, step, seek }
}
