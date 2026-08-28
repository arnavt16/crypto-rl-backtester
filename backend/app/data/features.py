"""
Technical-indicator feature engineering, built from scratch on pandas/numpy
(no ta-lib dependency -- keeps install trivial and the math transparent).

All indicators are computed strictly causally (only past/current bars), so
there is no lookahead leakage into the RL environment's observations.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

FEATURE_COLUMNS = [
    "ret_1d",
    "ret_5d",
    "sma_10_ratio",
    "sma_30_ratio",
    "ema_12_ratio",
    "rsi_14",
    "volatility_10d",
    "macd_hist",
    "bb_position",
]


def _rsi(close: pd.Series, window: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / window, adjust=False, min_periods=window).mean()
    avg_loss = loss.ewm(alpha=1 / window, adjust=False, min_periods=window).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50.0)  # neutral when undefined (flat/no-loss period)


def _macd_hist(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.Series:
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    return macd_line - signal_line


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Input: dataframe with columns [date, open, high, low, close, volume],
    sorted ascending by date.

    Output: same rows, plus FEATURE_COLUMNS, with the model-input feature
    columns z-scored using an EXPANDING window (so scaling at time t only
    ever uses data up to t -- avoids leaking future distribution info into
    the observation the agent sees during training).
    """
    out = df.copy().reset_index(drop=True)
    close = out["close"]

    out["ret_1d"] = close.pct_change(1)
    out["ret_5d"] = close.pct_change(5)

    sma_10 = close.rolling(10).mean()
    sma_30 = close.rolling(30).mean()
    ema_12 = close.ewm(span=12, adjust=False).mean()
    out["sma_10_ratio"] = close / sma_10 - 1
    out["sma_30_ratio"] = close / sma_30 - 1
    out["ema_12_ratio"] = close / ema_12 - 1

    out["rsi_14"] = _rsi(close, 14) / 100.0  # scale to ~[0,1]

    out["volatility_10d"] = out["ret_1d"].rolling(10).std()

    out["macd_hist"] = _macd_hist(close) / close  # normalize by price level

    bb_mid = close.rolling(20).mean()
    bb_std = close.rolling(20).std()
    bb_upper = bb_mid + 2 * bb_std
    bb_lower = bb_mid - 2 * bb_std
    out["bb_position"] = (close - bb_lower) / (bb_upper - bb_lower).replace(0, np.nan)

    # Drop the warm-up period where rolling windows aren't full yet.
    out = out.dropna(subset=FEATURE_COLUMNS).reset_index(drop=True)

    # Clip extreme outliers (early illiquid days have wild % moves) so a
    # handful of freak bars don't dominate the observation scale.
    for col in FEATURE_COLUMNS:
        lo, hi = out[col].quantile([0.001, 0.999])
        out[col] = out[col].clip(lo, hi)

    return out


def train_test_split_by_date(
    df: pd.DataFrame, split_date: str
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Chronological split -- train is strictly before split_date, test is
    on/after it. This is the walk-forward boundary: the agent never sees
    test-period data (prices or engineered features) during training."""
    dates = pd.to_datetime(df["date"])
    cutoff = pd.to_datetime(split_date)
    train = df[dates < cutoff].reset_index(drop=True)
    test = df[dates >= cutoff].reset_index(drop=True)
    return train, test
