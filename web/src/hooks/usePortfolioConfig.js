import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PERIODS, REBALANCING, STRATEGIES } from '../lib/backtest.js'
import { BENCHMARKS, DEFAULT_WEIGHTS, MAX_BENCHMARKS, decodeWeights, encodeWeights } from '../lib/portfolio.js'

const DEFAULTS = { cap: 10000, s: 'lump', r: 'monthly', p: '1y', b: '6040.SPX' }
const oneOf = (list, value, fallback) => (list.some((x) => x.id === value) ? value : fallback)

/** Portfolio settings live in the URL so any configuration can be shared */
export function usePortfolioConfig(investableIds) {
  const [params, setParams] = useSearchParams()

  const config = useMemo(() => {
    const capital = Number(params.get('cap'))
    const benchmarks = (params.get('b') ?? DEFAULTS.b).split('.').filter((id) => BENCHMARKS.some((b) => b.id === id))
    return {
      weights: decodeWeights(params.get('w'), investableIds) ?? (params.has('w') ? {} : DEFAULT_WEIGHTS),
      capital: Number.isFinite(capital) && capital > 0 ? capital : DEFAULTS.cap,
      strategy: oneOf(STRATEGIES, params.get('s'), DEFAULTS.s),
      rebalance: oneOf(REBALANCING, params.get('r'), DEFAULTS.r),
      period: oneOf(PERIODS, params.get('p'), DEFAULTS.p),
      benchmarks: benchmarks.slice(0, MAX_BENCHMARKS),
    }
  }, [params, investableIds])

  const update = useCallback((patch) => {
    setParams((p) => {
      const next = new URLSearchParams(p)
      for (const [key, value] of Object.entries(patch)) {
        if (key === 'weights') next.set('w', encodeWeights(value))
        else if (key === 'capital') next.set('cap', String(value))
        else if (key === 'strategy') next.set('s', value)
        else if (key === 'rebalance') next.set('r', value)
        else if (key === 'period') next.set('p', value)
        else if (key === 'benchmarks') next.set('b', value.join('.'))
      }
      return next
    }, { replace: true })
  }, [setParams])

  return [config, update]
}
