"""Single source of truth for every asset shown on the website."""

# quote: "usd_per_unit"  -> close is the USD value of 1 unit (BTC/USD, EUR/USD)
#        "units_per_usd" -> close is units of the asset per 1 USD (USD/JPY, USD/MXN)
#        "level"         -> index level or yield, not convertible to USD
ASSETS = [
    # id       name                        category   unit        pair          yahoo        quote            investable
    ("BTC",   "Bitcoin",                   "crypto",  "coin",     "BTC/USD",    "BTC-USD",   "usd_per_unit",  True),
    ("ETH",   "Ethereum",                  "crypto",  "coin",     "ETH/USD",    "ETH-USD",   "usd_per_unit",  True),
    ("SOL",   "Solana",                    "crypto",  "coin",     "SOL/USD",    "SOL-USD",   "usd_per_unit",  True),
    ("XRP",   "XRP",                       "crypto",  "coin",     "XRP/USD",    "XRP-USD",   "usd_per_unit",  True),
    ("ADA",   "Cardano",                   "crypto",  "coin",     "ADA/USD",    "ADA-USD",   "usd_per_unit",  True),
    ("XAU",   "Gold",                      "metals",  "troy oz",  "XAU/USD",    "GC=F",      "usd_per_unit",  True),
    ("XAG",   "Silver",                    "metals",  "troy oz",  "XAG/USD",    "SI=F",      "usd_per_unit",  True),
    ("XPT",   "Platinum",                  "metals",  "troy oz",  "XPT/USD",    "PL=F",      "usd_per_unit",  True),
    ("XPD",   "Palladium",                 "metals",  "troy oz",  "XPD/USD",    "PA=F",      "usd_per_unit",  True),
    ("WTI",   "WTI Crude Oil",             "energy",  "barrel",   "WTI/USD",    "CL=F",      "usd_per_unit",  True),
    ("BRENT", "Brent Crude Oil",           "energy",  "barrel",   "BRENT/USD",  "BZ=F",      "usd_per_unit",  True),
    ("EUR",   "Euro",                      "fx",      "currency", "EUR/USD",    "EURUSD=X",  "usd_per_unit",  True),
    ("GBP",   "British Pound",             "fx",      "currency", "GBP/USD",    "GBPUSD=X",  "usd_per_unit",  True),
    ("JPY",   "Japanese Yen",              "fx",      "currency", "USD/JPY",    "JPY=X",     "units_per_usd", True),
    ("CAD",   "Canadian Dollar",           "fx",      "currency", "USD/CAD",    "CAD=X",     "units_per_usd", True),
    ("CHF",   "Swiss Franc",               "fx",      "currency", "USD/CHF",    "CHF=X",     "units_per_usd", True),
    ("MXN",   "Mexican Peso",              "fx",      "currency", "USD/MXN",    "MXN=X",     "units_per_usd", True),
    ("BRL",   "Brazilian Real",            "fx",      "currency", "USD/BRL",    "BRL=X",     "units_per_usd", True),
    ("SPX",   "S&P 500",                   "indices", "index",    "SPX",        "^GSPC",     "usd_per_unit",  True),
    ("NDX",   "Nasdaq 100",                "indices", "index",    "NDX",        "^NDX",      "usd_per_unit",  True),
    ("AGG",   "US Aggregate Bond ETF",     "indices", "share",    "AGG",        "AGG",       "usd_per_unit",  True),
    ("TNX",   "US 10Y Treasury Yield",     "macro",   "%",        "US10Y",      "^TNX",      "level",         False),
    ("DXY",   "US Dollar Index",           "macro",   "index",    "DXY",        "DX-Y.NYB",  "level",         False),
    ("VIX",   "CBOE Volatility Index",     "macro",   "index",    "VIX",        "^VIX",      "level",         False),
]

CATEGORIES = [
    {"id": "crypto",  "label": "Crypto",          "trades_24_7": True},
    {"id": "metals",  "label": "Precious Metals", "trades_24_7": False},
    {"id": "energy",  "label": "Energy",          "trades_24_7": False},
    {"id": "fx",      "label": "Currencies",      "trades_24_7": False},
    {"id": "indices", "label": "Indices & Bonds", "trades_24_7": False},
    {"id": "macro",   "label": "Macro",           "trades_24_7": False},
]

COINGECKO_IDS = {"BTC": "bitcoin", "ETH": "ethereum", "SOL": "solana", "XRP": "ripple", "ADA": "cardano"}


def asset_dicts():
    keys = ("id", "name", "category", "unit", "pair", "yahoo", "quote", "investable")
    return [dict(zip(keys, a)) for a in ASSETS]
