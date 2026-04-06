from __future__ import annotations

import numpy as np
import pandas as pd


TIMEFRAME_MINUTES = {
    "1m": 1, "5m": 5, "15m": 15, "30m": 30,
    "1h": 60, "4h": 240, "1d": 1440,
}

SESSION_HOURS = {
    "sydney":    (21, 6),
    "tokyo":     (0, 9),
    "london":    (7, 16),
    "new_york":  (13, 22),
}


def generate_mock_candles(
    market: str,
    timeframe: str,
    start: str,
    end: str,
    seed: int = 42,
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    freq_min = TIMEFRAME_MINUTES.get(timeframe, 15)

    timestamps = pd.date_range(start=start, end=end, freq=f"{freq_min}min")
    if len(timestamps) == 0:
        timestamps = pd.date_range(start=start, periods=1000, freq=f"{freq_min}min")

    n = len(timestamps)
    base = 2000.0 if "XAU" in market.upper() else 1.1000

    returns = rng.normal(0, 0.001, size=n)
    closes = base * np.exp(np.cumsum(returns))

    spread = closes * rng.uniform(0.0005, 0.003, size=n)
    highs = closes + spread * rng.uniform(0.3, 1.0, size=n)
    lows = closes - spread * rng.uniform(0.3, 1.0, size=n)
    opens = lows + (highs - lows) * rng.uniform(0.2, 0.8, size=n)
    volume = rng.integers(100, 5000, size=n).astype(float)

    df = pd.DataFrame({
        "ts": timestamps,
        "open": np.round(opens, 5),
        "high": np.round(highs, 5),
        "low": np.round(lows, 5),
        "close": np.round(closes, 5),
        "volume": volume,
    })
    return df


def candle_in_session(ts: pd.Timestamp, sessions: list[str]) -> bool:
    hour = ts.hour
    for s in sessions:
        bounds = SESSION_HOURS.get(s.lower())
        if bounds is None:
            continue
        start_h, end_h = bounds
        if start_h <= end_h:
            if start_h <= hour < end_h:
                return True
        else:
            if hour >= start_h or hour < end_h:
                return True
    return False
