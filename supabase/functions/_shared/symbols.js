// Broker symbol -> Vectes asset. Brokers decorate names (xauusd, XAUUSD.m, US500.cash,
// EURUSD-ECN), so names are normalised before the lookup. Unmapped symbols are still
// journaled, they just have no Vectes candles to plot on.

const ALIASES = {
  XAU: ['XAUUSD', 'GOLD'],
  XAG: ['XAGUSD', 'SILVER'],
  XPT: ['XPTUSD', 'PLATINUM'],
  XPD: ['XPDUSD', 'PALLADIUM'],
  WTI: ['USOUSD', 'USOIL', 'WTI', 'XTIUSD', 'CL', 'CRUDE', 'OIL'],
  BRENT: ['UKOUSD', 'UKOIL', 'BRENT', 'XBRUSD', 'BRN'],
  EUR: ['EURUSD'],
  GBP: ['GBPUSD'],
  JPY: ['USDJPY'],
  CAD: ['USDCAD'],
  CHF: ['USDCHF'],
  MXN: ['USDMXN'],
  BRL: ['USDBRL'],
  BTC: ['BTCUSD', 'BITCOIN', 'XBTUSD'],
  ETH: ['ETHUSD', 'ETHEREUM'],
  SOL: ['SOLUSD'],
  XRP: ['XRPUSD'],
  ADA: ['ADAUSD'],
  SPX: ['US500', 'SPX500', 'SPX', 'SP500', 'USA500'],
  NDX: ['US100', 'NAS100', 'USTEC', 'NDX', 'NQ100', 'USA100'],
  DXY: ['DXY', 'USDX', 'USDIDX'],
  VIX: ['VIX', 'VOLX'],
}

const LOOKUP = Object.fromEntries(
  Object.entries(ALIASES).flatMap(([asset, names]) => names.map((n) => [n, asset])),
)

// "XAUUSD.m" -> "XAUUSD", "us500.cash" -> "US500", "EURUSD-ECN" -> "EURUSD", "GBPUSD+" -> "GBPUSD"
export function normaliseSymbol(symbol) {
  return String(symbol).trim().toUpperCase().split(/[.\-_+#!]/)[0]
}

export function assetForSymbol(symbol) {
  const name = normaliseSymbol(symbol)
  if (LOOKUP[name]) return LOOKUP[name]
  // Suffixes glued on without a separator, e.g. XAUUSDPRO or EURUSDM
  for (const len of [6, 5]) {
    const head = name.slice(0, len)
    if (name.length > len && LOOKUP[head]) return LOOKUP[head]
  }
  return null
}
