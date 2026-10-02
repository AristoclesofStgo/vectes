import { useEffect, useState } from 'react'

// Datasets are produced by scripts/build_web_data.py into public/data/
const cache = new Map()

export function loadJson(path) {
  if (!cache.has(path)) {
    const url = `${import.meta.env.BASE_URL}data/${path}`
    const request = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`${res.status} loading ${path}`)
      return res.json()
    })
    request.catch(() => cache.delete(path)) // allow a retry after a failure
    cache.set(path, request)
  }
  return cache.get(path)
}

export function useJson(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true })

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    loadJson(path).then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error) => alive && setState({ data: null, error, loading: false }),
    )
    return () => { alive = false }
  }, [path])

  return state
}
