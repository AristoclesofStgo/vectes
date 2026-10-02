"""
Build the static JSON datasets consumed by the website (web/public/data/).

Input:  data/raw/yahoo_1d.csv, yahoo_1h.csv, coingecko_markets.json   (extract_history.py)
        data/pipeline/snapshots.csv, cleaning_report.json              (clean_pipeline_exports.py)
Output: assets.json          catalog + crypto fundamentals
        prices_1d.json       daily closes of every asset on one aligned calendar
        candles/1d/<ID>.json daily OHLCV
        candles/4h/<ID>.json 4h OHLCV aggregated from hourly bars
        pipeline.json        6h snapshots captured by the AWS pipeline + reconciliation vs Yahoo
        quality.json         coverage and data quality metrics for the Data Lab

Runs in CI on every deploy; the output is not committed. If any asset is missing
or out of date the build aborts, the deploy fails, and GitHub Pages keeps serving
the last good version.
"""
import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from catalog import CATEGORIES, COINGECKO_IDS, asset_dicts

ROOT         = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR      = os.path.join(ROOT, "data", "raw")
PIPELINE_DIR = os.path.join(ROOT, "data", "pipeline")
OUT_DIR      = os.path.join(ROOT, "web", "public", "data")

MAX_STALENESS = pd.Timedelta(days=5)   # longest gap allowed between today and an asset's last bar
CANDLE_COLUMNS = ["time", "open", "high", "low", "close", "volume"]


def sig(x, digits=8):
    """Round to significant digits for compact JSON; NaN -> None."""
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return None
    return float(f"{x:.{digits}g}")


def unix(ts):
    return int(pd.Timestamp(ts).timestamp())


def read_json(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ── Load ───────────────────────────────────────────────────
def load_bars(interval):
    df = pd.read_csv(os.path.join(RAW_DIR, f"yahoo_{interval}.csv"))
    df["time"] = pd.to_datetime(df["time"], utc=True)
    return df.sort_values(["asset", "time"])


def validate(daily, assets):
    now = pd.Timestamp.now(tz="UTC")
    problems = []
    for a in assets:
        bars = daily[daily["asset"] == a["id"]]
        if bars.empty:
            problems.append(f"{a['id']}: no daily data")
        elif now - bars["time"].max() > MAX_STALENESS:
            problems.append(f"{a['id']}: last bar {bars['time'].max().date()} is too old")
    if problems:
        print("Build aborted, previous dataset kept:\n  " + "\n  ".join(problems))
        sys.exit(1)


# ── Transform ──────────────────────────────────────────────
def to_candles(df, has_volume):
    """Returns (rows, repaired) — Yahoo FX daily bars sometimes report a high/low
    inside the open/close range, so the wicks are widened to contain the body."""
    rows, repaired = [], 0
    for t, o, h, l, c, v in df[["time", "open", "high", "low", "close", "volume"]].itertuples(index=False):
        hi, lo = max(h, o, c), min(l, o, c)
        repaired += (hi != h) or (lo != l)
        rows.append([unix(t), sig(o), sig(hi), sig(lo), sig(c), int(v) if has_volume and not np.isnan(v) else None])
    return rows, int(repaired)


def daily_candles(daily, asset_id):
    df = daily[daily["asset"] == asset_id].copy()
    # Exchange-local dates arrive as e.g. 04:00Z; keep the calendar date only
    df["time"] = df["time"].dt.normalize()
    return df.drop_duplicates("time", keep="last")


def fx_daily_candles(hourly, asset_id):
    """Yahoo's daily FX bars close at the start of the day (London midnight), one
    session behind US markets. Rebuild them from hourly bars using the FX market
    convention: each trading day ends at 17:00 New York time."""
    df = hourly[hourly["asset"] == asset_id].copy()
    ny = df["time"].dt.tz_convert("America/New_York")
    df["day"] = (ny + pd.Timedelta(hours=7)).dt.tz_localize(None).dt.normalize().dt.tz_localize("UTC")
    agg = df.groupby("day").agg(open=("open", "first"), high=("high", "max"), low=("low", "min"),
                                close=("close", "last"), volume=("volume", "sum"))
    agg = agg.iloc[1:]   # the first session is only partially covered
    agg = agg[agg.index.dayofweek < 5]   # stray weekend ticks are not a session
    return agg.reset_index().rename(columns={"day": "time"})


def day_bars(daily, hourly, asset):
    if asset["category"] == "fx":
        return fx_daily_candles(hourly, asset["id"])
    return daily_candles(daily, asset["id"])


def four_hour_candles(hourly, asset_id):
    df = hourly[hourly["asset"] == asset_id].set_index("time")
    agg = df.resample("4h", origin="epoch", label="left", closed="left").agg(
        {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"})
    return agg.dropna(subset=["close"]).reset_index()


def aligned_closes(bars_by_asset, assets):
    first = min(b["time"].min() for b in bars_by_asset.values())
    last = max(b["time"].max() for b in bars_by_asset.values())
    days = pd.date_range(first, last, freq="D")
    series = {}
    for a in assets:
        d = bars_by_asset[a["id"]].set_index("time")["close"].reindex(days)
        traded = d.notna()
        d = d.ffill().bfill()
        series[a["id"]] = {"close": [sig(v) for v in d], "traded": [int(v) for v in traded]}
    return [unix(t) for t in days], series


def crypto_fundamentals(previous_assets):
    coins = read_json(os.path.join(RAW_DIR, "coingecko_markets.json"))
    if not coins:
        return {a["id"]: a.get("fundamentals") for a in (previous_assets or {}).get("assets", [])}
    by_id = {v: k for k, v in COINGECKO_IDS.items()}
    out = {}
    for c in coins:
        asset_id = by_id.get(c["id"])
        if not asset_id:
            continue
        out[asset_id] = {
            "market_cap":         c.get("market_cap"),
            "market_cap_rank":    c.get("market_cap_rank"),
            "volume_24h":         c.get("total_volume"),
            "circulating_supply": sig(c.get("circulating_supply")),
            "total_supply":       sig(c.get("total_supply")),
            "max_supply":         sig(c.get("max_supply")),
            "ath":                sig(c.get("ath")),
            "ath_date":           (c.get("ath_date") or "")[:10],
            "atl":                sig(c.get("atl")),
            "atl_date":           (c.get("atl_date") or "")[:10],
            "as_of":              (c.get("last_updated") or "")[:19] + "Z",
        }
    return out


def pipeline_dataset(hourly):
    """ETL-captured 6h snapshots, reconciled against Yahoo hourly bars."""
    snaps = pd.read_csv(os.path.join(PIPELINE_DIR, "snapshots.csv"))
    snaps["slot"] = pd.to_datetime(snaps["slot"], utc=True)
    snaps["ingested_at"] = pd.to_datetime(snaps["ingested_at"], utc=True, format="ISO8601")

    slots = pd.date_range(snaps["slot"].min(), snaps["slot"].max(), freq="6h")
    series = {}
    for asset_id, g in snaps.groupby("asset"):
        g = g.set_index("slot").reindex(slots)
        series[asset_id] = {
            "close": [sig(v) for v in g["close"]],
            "stale": [1 if pd.isna(s) else int(s) for s in g["stale"]],
        }

    # Yahoo's hourly window rolls forward (~1 year); once it no longer covers the
    # pipeline period, reuse the reconciliation committed in data/pipeline/.
    saved_path = os.path.join(PIPELINE_DIR, "reconciliation.json")
    covered = not hourly.empty and hourly["time"].min() <= snaps["ingested_at"].min()
    if covered:
        ref = hourly[["asset", "time", "close"]].rename(columns={"close": "reference", "time": "bar_time"})
        merged = pd.merge_asof(
            snaps.sort_values("ingested_at"), ref.sort_values("bar_time"),
            left_on="ingested_at", right_on="bar_time", by="asset", direction="backward")
        merged["diff_bps"] = (merged["close"] / merged["reference"] - 1) * 1e4
        reconciliation = {}
        for asset_id, g in merged.groupby("asset"):
            fresh = g[g["stale"] == 0]
            reconciliation[asset_id] = {
                "diff_bps":         [sig(v, 4) for v in g.set_index("slot")["diff_bps"].reindex(slots)],
                "mean_abs_bps":     sig(fresh["diff_bps"].abs().mean(), 4),
                "max_abs_bps":      sig(fresh["diff_bps"].abs().max(), 4),
                "compared_points":  int(fresh["diff_bps"].notna().sum()),
            }
        with open(saved_path, "w", encoding="utf-8") as f:
            json.dump(reconciliation, f, separators=(",", ":"))
    else:
        reconciliation = read_json(saved_path, {})

    return {
        "interval":  "6h",
        "time":      [unix(t) for t in slots],
        "series":    series,
        "reference": "Yahoo Finance hourly close at capture time",
        "reconciliation": reconciliation,
    }


# ── Load (write) ───────────────────────────────────────────
def write(rel_path, obj):
    path = os.path.join(OUT_DIR, rel_path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"), ensure_ascii=False)
    return os.path.getsize(path)


def build():
    assets = asset_dicts()
    daily  = load_bars("1d")
    hourly = load_bars("1h")
    validate(daily, assets)

    previous_assets = read_json(os.path.join(OUT_DIR, "assets.json"))
    fundamentals    = crypto_fundamentals(previous_assets)

    sizes, coverage, daily_bars = {}, [], {}
    for a in assets:
        d1 = day_bars(daily, hourly, a)
        daily_bars[a["id"]] = d1
        h4 = four_hour_candles(hourly, a["id"])
        has_volume = bool(d1["volume"].fillna(0).gt(0).any())
        a["has_volume"] = has_volume

        rows_1d, repaired_1d = to_candles(d1, has_volume)
        rows_4h, repaired_4h = to_candles(h4, has_volume)
        sizes[f"candles/1d/{a['id']}.json"] = write(f"candles/1d/{a['id']}.json", {
            "asset": a["id"], "interval": "1d", "columns": CANDLE_COLUMNS, "data": rows_1d})
        sizes[f"candles/4h/{a['id']}.json"] = write(f"candles/4h/{a['id']}.json", {
            "asset": a["id"], "interval": "4h", "columns": CANDLE_COLUMNS, "data": rows_4h})

        coverage.append({
            "asset":     a["id"],
            "ticker":    a["yahoo"],
            "bars_1d":   len(d1),
            "bars_4h":   len(h4),
            "repaired_wicks": repaired_1d + repaired_4h,
            "first_day": d1["time"].min().strftime("%Y-%m-%d"),
            "last_day":  d1["time"].max().strftime("%Y-%m-%d"),
        })

    catalog = []
    for a in assets:
        catalog.append({
            "id":         a["id"],
            "name":       a["name"],
            "category":   a["category"],
            "unit":       a["unit"],
            "pair":       a["pair"],
            "quote":      a["quote"],
            "investable": a["investable"],
            "has_volume": a["has_volume"],
            "source":     "Yahoo Finance",
            "ticker":     a["yahoo"],
            "fundamentals": fundamentals.get(a["id"]),
        })
    sizes["assets.json"] = write("assets.json", {"categories": CATEGORIES, "assets": catalog})

    times, series = aligned_closes(daily_bars, assets)
    sizes["prices_1d.json"] = write("prices_1d.json", {"interval": "1d", "time": times, "series": series})

    pipeline = pipeline_dataset(hourly)
    sizes["pipeline.json"] = write("pipeline.json", pipeline)

    extract_log = read_json(os.path.join(RAW_DIR, "extract_log.json"), {})
    cleaning    = read_json(os.path.join(PIPELINE_DIR, "cleaning_report.json"), {})
    sizes["quality.json"] = write("quality.json", {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "extracted_at": extract_log.get("extracted_at"),
        "history": {
            "source":   "Yahoo Finance (daily + hourly), CoinGecko (crypto fundamentals)",
            "period":   extract_log.get("period"),
            "start":    datetime.fromtimestamp(times[0], timezone.utc).strftime("%Y-%m-%d"),
            "end":      datetime.fromtimestamp(times[-1], timezone.utc).strftime("%Y-%m-%d"),
            "assets":   coverage,
        },
        "pipeline": cleaning,
        "notes": [
            "Daily history is refreshed by a scheduled GitHub Action; the original AWS pipeline ran from 2026-06-27 to 2026-07-11.",
            "4h candles are aggregated from Yahoo hourly bars (UTC-aligned).",
            "Yahoo's daily FX bars close at London midnight, one session behind US markets; FX daily candles are rebuilt from hourly bars with the 17:00 New York cutoff.",
            "Any bar whose high/low falls inside its open/close range has its wicks widened to contain the body.",
            "Non-crypto markets do not trade on weekends/holidays; their last close is carried forward in prices_1d.json and flagged with traded = 0.",
            "Index levels (S&P 500, Nasdaq 100) exclude dividends.",
        ],
    })

    total = sum(sizes.values())
    print(f"wrote {len(sizes)} files to {os.path.relpath(OUT_DIR, ROOT)} ({total / 1024:.0f} KB total)")
    for name in ("assets.json", "prices_1d.json", "pipeline.json", "quality.json"):
        print(f"  {name:16} {sizes[name] / 1024:7.1f} KB")
    c1 = sum(v for k, v in sizes.items() if k.startswith("candles/1d"))
    c4 = sum(v for k, v in sizes.items() if k.startswith("candles/4h"))
    print(f"  candles/1d/*     {c1 / 1024:7.1f} KB\n  candles/4h/*     {c4 / 1024:7.1f} KB")


if __name__ == "__main__":
    build()
