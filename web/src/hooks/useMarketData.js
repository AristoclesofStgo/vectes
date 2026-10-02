import { useEffect, useState } from 'react'
import { loadJson } from '../lib/data.js'
import { convertBars, isConvertible, rowsToBars } from '../lib/currency.js'

const candlePath = (interval, id) => `candles/${interval}/${id}.json`

async function loadBars(asset, interval, currencyAsset) {
  const rows = (await loadJson(candlePath(interval, asset.id))).data
  const bars = rowsToBars(rows)
  if (!currencyAsset || !isConvertible(asset, currencyAsset.id)) return { bars, converted: false }
  const rates = rowsToBars((await loadJson(candlePath(interval, currencyAsset.id))).data)
  return { bars: convertBars(bars, rates, currencyAsset.quote), converted: true }
}

/**
 * Candles for the selected asset (and optional comparison asset) in the
 * selected interval and currency, plus daily bars for summary statistics.
 * Keeps the previous result while a new one loads so the chart never flashes.
 */
export function useMarketData({ asset, compareAsset, interval, currencyAsset }) {
  const [state, setState] = useState({ data: null, loading: true, error: null })

  useEffect(() => {
    if (!asset) return
    let alive = true
    setState((s) => ({ ...s, loading: true }))

    Promise.all([
      loadBars(asset, interval, currencyAsset),
      loadBars(asset, '1d', currencyAsset),
      compareAsset ? loadBars(compareAsset, interval, currencyAsset) : null,
    ]).then(
      ([main, daily, compare]) => alive && setState({
        data: {
          key: `${asset.id}|${interval}|${currencyAsset?.id ?? 'USD'}`,
          bars: main.bars,
          converted: main.converted,
          dailyBars: daily.bars,
          compareBars: compare?.bars ?? null,
        },
        loading: false,
        error: null,
      }),
      (error) => alive && setState((s) => ({ ...s, loading: false, error })),
    )
    return () => { alive = false }
  }, [asset, compareAsset, interval, currencyAsset])

  return state
}
