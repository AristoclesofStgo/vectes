"""
Clean the original Snowflake exports (tableau/*.csv) captured by the AWS pipeline
between 2026-06-27 and 2026-07-11, and persist them as a committed dataset.

Input:  tableau/Crypto_*, FX_*, Metals_*, Oil_*   (raw, local only)
Output: data/pipeline/snapshots.csv               (clean, long format)
        data/pipeline/cleaning_report.json

Cleaning rules
  1. Drop exact duplicate rows (the load Lambda inserted some S3 files up to 4 times).
  2. Snap every snapshot to the 6h schedule grid (03/09/15/21 UTC) and keep the
     latest snapshot per slot. This collapses the manual test runs of 2026-06-28.
  3. Flag stale points: metals/energy while futures are closed, FX between the
     daily ExchangeRate-API updates.

Run once; the pipeline is no longer active so this data does not change.
"""
import glob
import json
import os

import pandas as pd

ROOT    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "tableau")
OUT_DIR = os.path.join(ROOT, "data", "pipeline")

SLOT        = pd.Timedelta(hours=6)
SLOT_OFFSET = pd.Timedelta(hours=3)   # runs fired at ~02:55/08:55/14:55/20:55 UTC

SOURCES = {
    "crypto": {"file": "Crypto_*", "key": "SYMBOL",         "price": "CURRENT_PRICE", "table": "CRYPTO_PRICES", "api": "CoinGecko"},
    "fx":     {"file": "FX_*",     "key": "QUOTE_CURRENCY", "price": "RATE",          "table": "FX_PRICES",     "api": "ExchangeRate-API"},
    "metals": {"file": "Metals_*", "key": "SYMBOL",         "price": "PRICE",         "table": "METALS_PRICES", "api": "Yahoo Finance"},
    "energy": {"file": "Oil_*",    "key": "SYMBOL",         "price": "PRICE",         "table": "OIL_PRICES",    "api": "Yahoo Finance"},
}
FX_USD_PER_UNIT = {"EUR", "GBP"}   # pairs quoted as USD per unit (EUR/USD, GBP/USD)


def futures_closed(ts):
    """CME metals/energy futures: closed Saturday and Sunday before 22:00 UTC."""
    return (ts.dt.dayofweek == 5) | ((ts.dt.dayofweek == 6) & (ts.dt.hour < 22))


def clean(category, cfg):
    path = glob.glob(os.path.join(SRC_DIR, cfg["file"] + ".csv"))[0]
    raw  = pd.read_csv(path, parse_dates=["INGESTED_AT", "LAST_UPDATED"])

    report = {
        "category":       category,
        "table":          cfg["table"],
        "api":            cfg["api"],
        "source_file":    os.path.basename(path),
        "raw_rows":       len(raw),
        "columns":        len(raw.columns),
        "always_null_columns": [c for c, n in raw.isna().sum().items() if n == len(raw)],
    }

    df = raw.drop_duplicates().copy()
    report["duplicate_rows"] = len(raw) - len(df)

    df["asset"] = df[cfg["key"]].str.upper()
    df["slot"]  = (df["INGESTED_AT"] - SLOT_OFFSET).dt.round(SLOT) + SLOT_OFFSET
    df = df.sort_values("INGESTED_AT")
    before = len(df)
    df = df.drop_duplicates(["asset", "slot"], keep="last")
    report["collapsed_test_runs"] = before - len(df)
    report["clean_rows"] = len(df)

    price = df[cfg["price"]].astype(float)
    if category == "fx":
        # Pipeline stored every pair as units per USD; express it in market convention
        df["close"] = [1 / p if a in FX_USD_PER_UNIT else p for a, p in zip(df["asset"], price)]
    else:
        df["close"] = price

    df = df.sort_values(["asset", "slot"])
    if category == "crypto":
        df["stale"] = False
    elif category == "fx":
        df["stale"] = df.groupby("asset")["LAST_UPDATED"].diff() == pd.Timedelta(0)
    else:
        df["stale"] = futures_closed(df["slot"]) | (df.groupby("asset")["close"].diff() == 0)

    out = pd.DataFrame({
        "asset":       df["asset"],
        "category":    category,
        "slot":        df["slot"].dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ingested_at": df["INGESTED_AT"].dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "close":       df["close"],
        "stale":       df["stale"].astype(int),
        "volume_24h":  df.get("TOTAL_VOLUME_24H"),
        "market_cap":  df.get("MARKET_CAP"),
    })
    report["stale_points"] = int(out["stale"].sum())
    report["first_snapshot"] = out["ingested_at"].min()
    report["last_snapshot"]  = out["ingested_at"].max()
    return out, report


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    frames, reports = [], []
    for category, cfg in SOURCES.items():
        out, report = clean(category, cfg)
        frames.append(out)
        reports.append(report)

    snapshots = pd.concat(frames, ignore_index=True)
    snapshots.to_csv(os.path.join(OUT_DIR, "snapshots.csv"), index=False, float_format="%.10g")

    with open(os.path.join(OUT_DIR, "cleaning_report.json"), "w", encoding="utf-8") as f:
        json.dump({
            "schedule": "EventBridge every 6h (~02:55, 08:55, 14:55, 20:55 UTC)",
            "architecture": "EventBridge -> Lambda Extract -> S3 -> Lambda Load -> Snowflake",
            "sources": reports,
            "issues": [
                "Some S3 files were loaded into Snowflake more than once, producing exact duplicate rows.",
                "Manual test runs on 2026-06-28 created extra snapshots outside the 6h schedule.",
                "Metals/energy OPEN_PRICE was the open from 7 days earlier, so PRICE_CHANGE_PCT_24H was really a weekly change.",
                "ExchangeRate-API (free tier) publishes once a day, so most 6h FX snapshots repeat the previous value.",
                "HIGH_30D / LOW_30D / HIGH_52W / LOW_52W were never populated.",
            ],
        }, f, indent=2, default=str)

    print(f"snapshots.csv: {len(snapshots)} rows, {snapshots['asset'].nunique()} assets")
    for r in reports:
        print(f"  {r['category']:7} raw={r['raw_rows']:5} dup={r['duplicate_rows']:5} "
              f"test_runs={r['collapsed_test_runs']:3} clean={r['clean_rows']:4} stale={r['stale_points']}")


if __name__ == "__main__":
    main()
