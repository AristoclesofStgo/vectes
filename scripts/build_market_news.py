"""
Economic calendar and market headlines for the Market tab (web/public/data/).

  calendar.json  This week's economic events from the Forex Factory weekly feed:
                 time (UTC), currency, impact, forecast and previous value.
  news.json      Recent Yahoo Finance headlines per Vectes asset (title, link, time),
                 plus a merged "all markets" list. Only headlines and links are kept;
                 the articles stay on their publishers' sites.

Both sources are public and need no API key. A failing source never stops the
deploy: its file is written empty with the error noted, and the site says so.
"""

import html
import json
import os
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import requests

from catalog import asset_dicts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "web", "public", "data")

CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
PUBLISHED = "https://aristoclesofstgo.github.io/vectes/data/{name}"  # last good copy, used as a fallback
NEWS_URL = "https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
HEADERS = {"User-Agent": "Mozilla/5.0 (Vectes market data; +https://github.com/AristoclesofStgo/vectes)"}

PER_ASSET = 15     # headlines kept per asset
ALL_MARKETS = 40   # headlines in the merged list
IMPACTS = {"high": "high", "medium": "medium", "low": "low", "holiday": "holiday", "non-economic": "low"}


def utc_iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get(url, tries=3):
    for attempt in range(tries):
        try:
            res = requests.get(url, headers=HEADERS, timeout=20)
            if res.status_code == 429 and attempt < tries - 1:
                # Rate limited (the calendar feed allows a few requests per 5 minutes)
                time.sleep(min(int(res.headers.get("Retry-After", "60") or 60), 120))
                continue
            res.raise_for_status()
            return res
        except requests.RequestException:
            if attempt == tries - 1:
                raise
            time.sleep(2 * (attempt + 1))


def build_calendar():
    events = []
    for e in get(CALENDAR_URL).json():
        try:
            when = datetime.fromisoformat(e["date"])
        except (KeyError, ValueError):
            continue
        events.append({
            "time": utc_iso(when),
            "currency": str(e.get("country", "")).upper()[:3],
            "impact": IMPACTS.get(str(e.get("impact", "")).lower(), "low"),
            "title": html.unescape(str(e.get("title", ""))).strip(),
            "forecast": str(e.get("forecast") or "").strip(),
            "previous": str(e.get("previous") or "").strip(),
        })
    events.sort(key=lambda e: (e["time"], e["currency"]))
    if not events:
        raise ValueError("the calendar feed returned no events")
    return events


def build_news():
    by_asset, errors = {}, {}
    merged = {}
    for asset in asset_dicts():
        try:
            root = ET.fromstring(get(NEWS_URL.format(ticker=asset["yahoo"])).content)
        except (requests.RequestException, ET.ParseError) as exc:
            errors[asset["id"]] = str(exc)[:200]
            by_asset[asset["id"]] = []
            continue
        items = []
        for it in root.iter("item"):
            title = html.unescape((it.findtext("title") or "").strip())
            link = (it.findtext("link") or "").strip()
            guid = (it.findtext("guid") or link).strip()
            try:
                published = parsedate_to_datetime(it.findtext("pubDate") or "")
            except (TypeError, ValueError):
                continue
            if not title or not link.startswith("https://"):
                continue
            items.append({"id": guid, "title": title, "link": link, "published": utc_iso(published)})
        items.sort(key=lambda x: x["published"], reverse=True)
        by_asset[asset["id"]] = items[:PER_ASSET]

        # One headline can appear in several assets' feeds: keep it once, tagged with each asset
        for item in items[:PER_ASSET]:
            entry = merged.setdefault(item["id"], {**item, "assets": []})
            entry["assets"].append(asset["id"])
        time.sleep(0.3)  # be gentle with the feed

    all_markets = sorted(merged.values(), key=lambda x: x["published"], reverse=True)[:ALL_MARKETS]
    if not any(by_asset.values()):
        raise ValueError("no headlines from any feed")
    return by_asset, all_markets, errors


def published_copy(name, still_valid):
    """The file currently on the live site, if it is still usable."""
    try:
        data = requests.get(PUBLISHED.format(name=name), headers=HEADERS, timeout=20).json()
        return data if still_valid(data) else None
    except (requests.RequestException, ValueError):
        return None


def write(name, payload):
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, name), "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))


def main():
    now = utc_iso(datetime.now(timezone.utc))

    try:
        events = build_calendar()
        write("calendar.json", {"generated_at": now, "source": "Forex Factory", "events": events})
        print(f"calendar: {len(events)} events")
    except Exception as exc:  # noqa: BLE001 - fall back to the published copy, else an empty, labelled file
        week_ago = utc_iso(datetime.fromtimestamp(time.time() - 6 * 86400, timezone.utc))
        kept = published_copy("calendar.json", lambda d: d.get("events") and d["events"][-1]["time"] >= week_ago)
        if kept:
            write("calendar.json", {**kept, "stale": True})
            print(f"calendar: FAILED ({exc}); kept the published copy from {kept['generated_at']}", file=sys.stderr)
        else:
            write("calendar.json", {"generated_at": now, "source": "Forex Factory", "events": [], "error": str(exc)[:300]})
            print(f"calendar: FAILED ({exc})", file=sys.stderr)

    try:
        by_asset, all_markets, errors = build_news()
        write("news.json", {"generated_at": now, "source": "Yahoo Finance", "by_asset": by_asset, "all": all_markets, "errors": errors})
        print(f"news: {sum(len(v) for v in by_asset.values())} headlines, {len(all_markets)} merged, {len(errors)} feeds failed")
    except Exception as exc:  # noqa: BLE001
        kept = published_copy("news.json", lambda d: bool(d.get("all")))
        if kept:
            write("news.json", {**kept, "stale": True})
            print(f"news: FAILED ({exc}); kept the published copy from {kept['generated_at']}", file=sys.stderr)
        else:
            write("news.json", {"generated_at": now, "source": "Yahoo Finance", "by_asset": {}, "all": [], "error": str(exc)[:300]})
            print(f"news: FAILED ({exc})", file=sys.stderr)


if __name__ == "__main__":
    main()
