"""
Extract one year of market history for every asset in the catalog.

Output (data/raw/, not committed):
  yahoo_1d.csv          daily OHLCV, long format
  yahoo_1h.csv          hourly OHLCV, long format (aggregated to 4h by the build step)
  coingecko_markets.json  current crypto fundamentals (market cap, supply, ATH)
  extract_log.json      per-ticker status of this run

Yahoo Finance is unofficial and occasionally rate-limits, so each failed ticker is
retried individually. If one still fails, build_web_data.py aborts the deploy.
"""
import json
import os
import time
from datetime import datetime, timezone

import pandas as pd
import requests
import yfinance as yf

from catalog import ASSETS, COINGECKO_IDS

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, "data", "raw")

PERIOD  = "1y"
RETRIES = 3


def download(tickers, interval):
    data = yf.download(tickers, period=PERIOD, interval=interval, group_by="ticker",
                       auto_adjust=False, progress=False, threads=True)
    frames = {}
    for t in tickers:
        try:
            df = data[t] if len(tickers) > 1 else data
        except KeyError:
            continue
        df = df.dropna(subset=["Close"])
        if not df.empty:
            frames[t] = df
    return frames


def extract_yahoo(interval):
    tickers = [a[5] for a in ASSETS]
    frames  = download(tickers, interval)

    for attempt in range(1, RETRIES + 1):
        missing = [t for t in tickers if t not in frames]
        if not missing:
            break
        print(f"  retry {attempt} ({interval}): {missing}")
        time.sleep(2 * attempt)
        for t in missing:
            frames.update(download([t], interval))

    rows = []
    by_ticker = {a[5]: a[0] for a in ASSETS}
    for ticker, df in frames.items():
        idx = df.index.tz_convert("UTC") if df.index.tz is not None else df.index.tz_localize("UTC")
        rows.append(pd.DataFrame({
            "asset":  by_ticker[ticker],
            "ticker": ticker,
            "time":   idx.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "open":   df["Open"].values,
            "high":   df["High"].values,
            "low":    df["Low"].values,
            "close":  df["Close"].values,
            "volume": df["Volume"].values,
        }))

    out = pd.concat(rows, ignore_index=True)
    path = os.path.join(RAW_DIR, f"yahoo_{interval}.csv")
    out.to_csv(path, index=False, float_format="%.10g")
    print(f"yahoo {interval}: {len(out)} rows, {out['asset'].nunique()}/{len(ASSETS)} assets -> {os.path.relpath(path, ROOT)}")

    return {by_ticker[t]: {"ticker": t, "rows": int(len(frames[t])) if t in frames else 0,
                           "ok": t in frames} for t in tickers}


def extract_coingecko():
    url = "https://api.coingecko.com/api/v3/coins/markets"
    params = {"vs_currency": "usd", "ids": ",".join(COINGECKO_IDS.values())}
    for attempt in range(1, RETRIES + 1):
        try:
            response = requests.get(url, params=params, timeout=20)
            response.raise_for_status()
            coins = response.json()
            with open(os.path.join(RAW_DIR, "coingecko_markets.json"), "w", encoding="utf-8") as f:
                json.dump(coins, f)
            print(f"coingecko: {len(coins)} coins")
            return {"ok": True, "coins": len(coins)}
        except Exception as e:
            print(f"  coingecko attempt {attempt} failed: {e}")
            time.sleep(5 * attempt)
    return {"ok": False, "coins": 0}


def main():
    os.makedirs(RAW_DIR, exist_ok=True)
    log = {
        "extracted_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "period": PERIOD,
        "yahoo_1d": extract_yahoo("1d"),
        "yahoo_1h": extract_yahoo("1h"),
        "coingecko": extract_coingecko(),
    }
    with open(os.path.join(RAW_DIR, "extract_log.json"), "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2)


if __name__ == "__main__":
    main()
