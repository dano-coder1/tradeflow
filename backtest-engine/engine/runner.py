from __future__ import annotations

import logging

import pandas as pd

from engine.candles import candle_in_session, compute_session_ranges, generate_mock_candles
from engine.indicators import ema, rsi
from engine.metrics import compute_metrics
from engine.schema import BacktestResult, Metrics, StrategyDSL, TradeRecord

logger = logging.getLogger(__name__)


def run_backtest(strategy: StrategyDSL) -> BacktestResult:
    df = generate_mock_candles(
        market=strategy.market,
        timeframe=strategy.timeframe,
        start=str(strategy.date_range.from_date),
        end=str(strategy.date_range.to_date),
    )

    df = _attach_indicators(df, strategy)

    session_names: list[str] = []
    for f in strategy.filters:
        if f.type == "session":
            session_names.extend(f.sessions)

    trades: list[dict] = []
    equity_curve: list[dict] = [{"ts": df.iloc[0]["ts"].isoformat(), "equity": 10_000.0}]
    equity = 10_000.0
    open_trade: dict | None = None

    for i in range(1, len(df)):
        row = df.iloc[i]
        prev = df.iloc[i - 1]

        if row["ts"] is None:
            continue

        if open_trade is not None:
            closed, pnl = _check_exit(open_trade, row, strategy)
            if closed:
                commission = abs(pnl) * (strategy.commission_pct / 100)
                pnl -= commission
                open_trade["exit_ts"] = row["ts"].isoformat()
                open_trade["exit_price"] = round(row["close"] if not closed else open_trade.get("_exit_price", row["close"]), 5)
                open_trade["pnl"] = round(pnl, 4)
                open_trade["result"] = "win" if pnl > 0 else "loss"
                open_trade["rr"] = round(
                    abs(open_trade["exit_price"] - open_trade["entry_price"])
                    / abs(open_trade["entry_price"] - open_trade["stop_loss"])
                    if open_trade["entry_price"] != open_trade["stop_loss"] else 0.0,
                    4,
                )
                equity += pnl
                trades.append({k: v for k, v in open_trade.items() if not k.startswith("_")})
                open_trade = None

        if open_trade is None:
            if session_names and not candle_in_session(row["ts"], session_names):
                equity_curve.append({"ts": row["ts"].isoformat(), "equity": round(equity, 4)})
                continue

            if _check_entry(row, prev, strategy):
                entry_price = row["close"]
                direction = strategy.entry.direction
                sl_pct = strategy.exit.stop_loss.value / 100
                rr_ratio = strategy.exit.take_profit.ratio

                if direction == "long":
                    sl = entry_price * (1 - sl_pct)
                    tp = entry_price + (entry_price - sl) * rr_ratio
                else:
                    sl = entry_price * (1 + sl_pct)
                    tp = entry_price - (sl - entry_price) * rr_ratio

                open_trade = {
                    "entry_ts": row["ts"].isoformat(),
                    "exit_ts": "",
                    "direction": direction,
                    "entry_price": round(entry_price, 5),
                    "exit_price": 0.0,
                    "stop_loss": round(sl, 5),
                    "take_profit": round(tp, 5),
                    "pnl": 0.0,
                    "rr": 0.0,
                    "result": "loss",
                }

        equity_curve.append({"ts": row["ts"].isoformat(), "equity": round(equity, 4)})

    if open_trade is not None:
        last = df.iloc[-1]
        exit_price = last["close"]
        direction = open_trade["direction"]
        raw_pnl = (exit_price - open_trade["entry_price"]) if direction == "long" else (open_trade["entry_price"] - exit_price)
        commission = abs(raw_pnl) * (strategy.commission_pct / 100)
        raw_pnl -= commission
        open_trade["exit_ts"] = last["ts"].isoformat()
        open_trade["exit_price"] = round(exit_price, 5)
        open_trade["pnl"] = round(raw_pnl, 4)
        open_trade["result"] = "win" if raw_pnl > 0 else "loss"
        open_trade["rr"] = round(
            abs(exit_price - open_trade["entry_price"])
            / abs(open_trade["entry_price"] - open_trade["stop_loss"])
            if open_trade["entry_price"] != open_trade["stop_loss"] else 0.0,
            4,
        )
        equity += raw_pnl
        trades.append({k: v for k, v in open_trade.items() if not k.startswith("_")})
        equity_curve.append({"ts": last["ts"].isoformat(), "equity": round(equity, 4)})

    metrics = compute_metrics(trades, equity_curve)
    trade_records = [TradeRecord(**t) for t in trades]

    return BacktestResult(metrics=metrics, equity_curve=equity_curve, trades=trade_records)


def _attach_indicators(df: pd.DataFrame, strategy: StrategyDSL) -> pd.DataFrame:
    for cond in strategy.entry.conditions:
        if cond.type == "ema_cross":
            df[f"ema_{cond.fast}"] = ema(df["close"], cond.fast)
            df[f"ema_{cond.slow}"] = ema(df["close"], cond.slow)
        elif cond.type in ("rsi_above", "rsi_below"):
            col = f"rsi_{cond.period}"
            if col not in df.columns:
                df[col] = rsi(df["close"], cond.period)
        elif cond.type == "session_range":
            if "session_high" not in df.columns:
                df = compute_session_ranges(df, cond.session)
                valid = df["session_high"].notna().sum()
                logger.info(
                    "Session range (%s): %d candles with valid range",
                    cond.session, valid,
                )
    return df


def _check_entry(current: pd.Series, prev: pd.Series, strategy: StrategyDSL) -> bool:
    """Check all entry conditions.

    Indicator conditions (EMA, RSI) are evaluated on *prev* to avoid look-ahead.
    Breakout conditions compare prev vs current close for cross detection.
    """
    for cond in strategy.entry.conditions:
        if cond.type == "ema_cross":
            fast_col = f"ema_{cond.fast}"
            slow_col = f"ema_{cond.slow}"
            if pd.isna(prev.get(fast_col)) or pd.isna(prev.get(slow_col)):
                return False
            if strategy.entry.direction == "long":
                if prev[fast_col] <= prev[slow_col]:
                    return False
            else:
                if prev[fast_col] >= prev[slow_col]:
                    return False
        elif cond.type == "rsi_above":
            col = f"rsi_{cond.period}"
            if pd.isna(prev.get(col)) or prev[col] <= cond.value:
                return False
        elif cond.type == "rsi_below":
            col = f"rsi_{cond.period}"
            if pd.isna(prev.get(col)) or prev[col] >= cond.value:
                return False
        elif cond.type == "session_range":
            # Data condition — just verify a valid range exists on current candle
            if pd.isna(current.get("session_high")) or pd.isna(current.get("session_low")):
                return False
        elif cond.type == "breakout":
            # Breakout: prev close on one side, current close crosses to the other
            if pd.isna(current.get("session_high")) or pd.isna(current.get("session_low")):
                return False
            if cond.level == "session_high":
                level = current["session_high"]
                if not (prev["close"] <= level and current["close"] > level):
                    return False
                logger.debug(
                    "Breakout HIGH at %s: close=%.5f > level=%.5f",
                    current["ts"], current["close"], level,
                )
            elif cond.level == "session_low":
                level = current["session_low"]
                if not (prev["close"] >= level and current["close"] < level):
                    return False
                logger.debug(
                    "Breakout LOW at %s: close=%.5f < level=%.5f",
                    current["ts"], current["close"], level,
                )
    return True


def _check_exit(trade: dict, candle: pd.Series, strategy: StrategyDSL) -> tuple[bool, float]:
    direction = trade["direction"]
    entry_price = trade["entry_price"]
    sl = trade["stop_loss"]
    tp = trade["take_profit"]

    if direction == "long":
        if candle["low"] <= sl:
            trade["_exit_price"] = sl
            return True, sl - entry_price
        if candle["high"] >= tp:
            trade["_exit_price"] = tp
            return True, tp - entry_price
    else:
        if candle["high"] >= sl:
            trade["_exit_price"] = sl
            return True, entry_price - sl
        if candle["low"] <= tp:
            trade["_exit_price"] = tp
            return True, entry_price - tp

    return False, 0.0
