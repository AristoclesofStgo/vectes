// Data dictionary: the tables queryable in the SQL playground.

export const SQL_TABLES = [
  {
    name: 'assets',
    description: 'Catalog of the 24 instruments on the site.',
    columns: [
      ['id', 'VARCHAR', 'Short identifier used everywhere (BTC, XAU, SPX…)'],
      ['name', 'VARCHAR', 'Display name'],
      ['category', 'VARCHAR', 'crypto · metals · energy · fx · indices · macro'],
      ['unit', 'VARCHAR', 'What one unit is: coin, troy oz, barrel, index…'],
      ['pair', 'VARCHAR', 'Market quoting convention, e.g. EUR/USD or USD/JPY'],
      ['quote', 'VARCHAR', 'usd_per_unit, units_per_usd, or level (yields and indices)'],
      ['investable', 'BOOLEAN', 'False for gauges that cannot be held (VIX, 10Y yield, DXY)'],
      ['ticker', 'VARCHAR', 'Yahoo Finance symbol the history comes from'],
    ],
  },
  {
    name: 'prices',
    description: 'Daily closes for every asset on one aligned calendar (one row per asset per day).',
    columns: [
      ['date', 'DATE', 'Calendar day (UTC)'],
      ['asset', 'VARCHAR', 'References assets.id'],
      ['close', 'DOUBLE', 'Close in the asset’s native quote; carried forward on non-trading days'],
      ['traded', 'BOOLEAN', 'False when the market was closed and the close was carried forward'],
    ],
  },
  {
    name: 'candles_1d',
    description: 'Daily OHLCV candles, trading days only. FX sessions end at 17:00 New York.',
    columns: [
      ['asset', 'VARCHAR', 'References assets.id'],
      ['date', 'DATE', 'Trading day'],
      ['open', 'DOUBLE', 'First price of the session'],
      ['high', 'DOUBLE', 'Session high'],
      ['low', 'DOUBLE', 'Session low'],
      ['close', 'DOUBLE', 'Last price of the session'],
      ['volume', 'BIGINT', 'Traded volume; NULL for FX, yields and indices without volume'],
    ],
  },
  {
    name: 'pipeline_snapshots',
    description: '6-hourly prices captured by the original AWS pipeline (Jun 27 – Jul 11, 2026), after cleaning.',
    columns: [
      ['asset', 'VARCHAR', 'References assets.id'],
      ['slot_time', 'TIMESTAMP', 'Scheduled 6h slot (03/09/15/21 UTC) the snapshot was snapped to'],
      ['close', 'DOUBLE', 'Price captured by the pipeline, in market quoting convention'],
      ['stale', 'BOOLEAN', 'True when the source had not published a new value (weekends, daily FX)'],
      ['diff_bps', 'DOUBLE', 'Difference vs the Yahoo Finance hourly close at capture time, in basis points'],
    ],
  },
]
