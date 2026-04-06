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
    "asian":     (0, 9),
    "london":    (7, 16),
    "new_york":  (13, 22),
    "london_ny_overlap": (13, 16),
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


def compute_session_ranges(df: pd.DataFrame, session: str) -> pd.DataFrame:
    """Compute the high/low of a session for each trading day.

    For each candle, session_high/session_low reflect the *completed* session
    range from the most recent prior session (not the current one). This avoids
    look-ahead bias: during the current session the range is still forming, so
    we use yesterday's completed range until a new session completes.
    """
    bounds = SESSION_HOURS.get(session.lower())
    if bounds is None:
        df["session_high"] = np.nan
        df["session_low"] = np.nan
        return df

    start_h, end_h = bounds

    def _in_session(hour: int) -> bool:
        if start_h <= end_h:
            return start_h <= hour < end_h
        return hour >= start_h or hour < end_h

    # Pass 1: find the completed session range for each day
    # Group candles by date and session membership
    session_high = np.full(len(df), np.nan)
    session_low = np.full(len(df), np.nan)

    last_completed_high = np.nan
    last_completed_low = np.nan
    current_high = np.nan
    current_low = np.nan
    in_session_prev = False

    for i in range(len(df)):
        ts = df.iloc[i]["ts"]
        hour = ts.hour
        in_sess = _in_session(hour)

        if in_sess:
            h = df.iloc[i]["high"]
            l = df.iloc[i]["low"]
            if np.isnan(current_high):
                current_high = h
                current_low = l
            else:
                current_high = max(current_high, h)
                current_low = min(current_low, l)
        elif in_session_prev and not in_sess:
            # Session just ended — commit the range
            if not np.isnan(current_high):
                last_completed_high = current_high
                last_completed_low = current_low
            current_high = np.nan
            current_low = np.nan

        in_session_prev = in_sess

        # Use last completed session range (no look-ahead)
        session_high[i] = last_completed_high
        session_low[i] = last_completed_low

    df["session_high"] = np.round(session_high, 5)
    df["session_low"] = np.round(session_low, 5)
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
