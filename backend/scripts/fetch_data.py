"""
Fetch real historical daily BTC-USD OHLCV data.

Source: skforecast-datasets (MIT-licensed, public tutorial dataset), which is
itself sourced from public crypto market data providers. This is REAL market
data, not synthetic/simulated -- important for backtest credibility.

Run: python backend/scripts/fetch_data.py
Writes: data/btc_daily.csv (repo root /data)
"""
import sys
from pathlib import Path

import pandas as pd
import requests

SOURCE_URL = (
    "https://raw.githubusercontent.com/skforecast/skforecast-datasets/"
    "main/data/bitcoin.csv"
)

REPO_ROOT = Path(__file__).resolve().parents[2]
OUT_PATH = REPO_ROOT / "data" / "btc_daily.csv"


def main() -> None:
    print(f"Fetching {SOURCE_URL} ...")
    resp = requests.get(SOURCE_URL, timeout=30)
    resp.raise_for_status()

    tmp_path = OUT_PATH.with_suffix(".raw.csv")
    tmp_path.write_bytes(resp.content)

    df = pd.read_csv(tmp_path)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").drop_duplicates(subset="date").reset_index(drop=True)

    keep = ["date", "open", "high", "low", "close", "volume"]
    missing = [c for c in keep if c not in df.columns]
    if missing:
        print(f"ERROR: source is missing expected columns: {missing}", file=sys.stderr)
        sys.exit(1)
    df = df[keep]

    # Sanity checks -- fail loudly rather than silently shipping bad data.
    assert df["close"].gt(0).all(), "non-positive close price found"
    assert df["date"].is_monotonic_increasing, "dates not sorted"
    assert len(df) > 500, f"suspiciously few rows: {len(df)}"

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_PATH, index=False)
    tmp_path.unlink()

    print(f"Saved {len(df)} rows -> {OUT_PATH}")
    print(f"Date range: {df['date'].min().date()} -> {df['date'].max().date()}")


if __name__ == "__main__":
    main()
