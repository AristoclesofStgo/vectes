// Data dictionary: the tables queryable in the SQL playground, plus the
// original Snowflake schema the AWS pipeline loaded (snowflake/setup.sql).

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

const common = [
  ['LAST_UPDATED', 'TIMESTAMP_NTZ', 'Source timestamp of the quote'],
  ['INGESTED_AT', 'TIMESTAMP_NTZ', 'When the extract Lambda ran'],
]
const commodity = (extra = []) => [
  ['SYMBOL', 'VARCHAR', 'XAU, XAG, XPT, XPD, WTI or BRENT'],
  ['NAME', 'VARCHAR', 'Display name'],
  ['UNIT', 'VARCHAR', 'troy oz or barrel'],
  ['CURRENCY', 'VARCHAR', 'Always USD'],
  ['PRICE', 'FLOAT', 'Latest close from Yahoo Finance'],
  ['OPEN_PRICE', 'FLOAT', 'Open of the 7-day window (bug: not the 24h open)'],
  ['HIGH_24H / LOW_24H', 'FLOAT', 'Latest daily bar high / low'],
  ['PRICE_CHANGE_24H / _PCT_24H', 'FLOAT', 'Really a ~7-day change, because of the OPEN_PRICE bug'],
  ['HIGH_7D / LOW_7D', 'FLOAT', 'Range over the last 7 daily bars'],
  ['HIGH_30D / LOW_30D', 'FLOAT', 'Never populated'],
  ...extra,
  ...common,
]

export const SNOWFLAKE_TABLES = [
  {
    name: 'CRYPTO_PRICES',
    description: 'CoinGecko /coins/markets for BTC, ETH, SOL, XRP and ADA.',
    columns: [
      ['ID / SYMBOL / NAME', 'VARCHAR', 'CoinGecko id, ticker and name'],
      ['CURRENT_PRICE', 'FLOAT', 'Price in USD'],
      ['HIGH_24H / LOW_24H', 'FLOAT', 'Rolling 24h range'],
      ['PRICE_CHANGE_24H / _PCT_24H', 'FLOAT', 'Rolling 24h change'],
      ['MARKET_CAP / MARKET_CAP_RANK', 'FLOAT / INT', 'Capitalization and rank'],
      ['TOTAL_VOLUME_24H', 'FLOAT', '24h traded volume in USD'],
      ['CIRCULATING_SUPPLY / TOTAL_SUPPLY', 'FLOAT', 'Coins in circulation / issued'],
      ['ATH / ATH_DATE / ATL / ATL_DATE', 'FLOAT / TIMESTAMP_NTZ', 'All-time high and low'],
      ...common,
    ],
  },
  {
    name: 'FX_PRICES',
    description: 'ExchangeRate-API latest rates vs USD (free tier, updated once a day).',
    columns: [
      ['BASE_CURRENCY / QUOTE_CURRENCY / PAIR', 'VARCHAR', 'Always USD as base, e.g. USD/EUR'],
      ['RATE', 'FLOAT', 'Units of the quote currency per USD'],
      ['BID … LOW_30D (11 columns)', 'FLOAT', 'Never populated by the free API'],
      ...common,
    ],
  },
  { name: 'METALS_PRICES', description: 'Yahoo Finance futures: gold, silver, platinum, palladium.', columns: commodity([['HIGH_52W / LOW_52W', 'FLOAT', 'Never populated']]) },
  { name: 'OIL_PRICES', description: 'Yahoo Finance futures: WTI and Brent crude.', columns: commodity() },
]
