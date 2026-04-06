from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


# --- Conditions ---

class EMAcrossCondition(BaseModel):
    type: Literal["ema_cross"]
    fast: int = Field(gt=0)
    slow: int = Field(gt=0)


class RSIAboveCondition(BaseModel):
    type: Literal["rsi_above"]
    period: int = Field(gt=0)
    value: float = Field(ge=0, le=100)


class RSIBelowCondition(BaseModel):
    type: Literal["rsi_below"]
    period: int = Field(gt=0)
    value: float = Field(ge=0, le=100)


Condition = EMAcrossCondition | RSIAboveCondition | RSIBelowCondition


# --- Exit ---

class FixedPctStopLoss(BaseModel):
    type: Literal["fixed_pct"]
    value: float = Field(gt=0)


class RRTakeProfit(BaseModel):
    type: Literal["rr"]
    ratio: float = Field(gt=0)


# --- Filters ---

class SessionFilter(BaseModel):
    type: Literal["session"]
    sessions: list[str]


Filter = SessionFilter


# --- Strategy DSL ---

class DateRange(BaseModel):
    from_date: date = Field(alias="from")
    to_date: date = Field(alias="to")


class Entry(BaseModel):
    direction: Literal["long", "short"]
    conditions: list[Condition]


class Exit(BaseModel):
    stop_loss: FixedPctStopLoss
    take_profit: RRTakeProfit


class StrategyDSL(BaseModel):
    market: str
    timeframe: str
    date_range: DateRange
    entry: Entry
    exit: Exit
    filters: list[Filter] = []
    commission_pct: float = Field(default=0.0, ge=0)

    model_config = {"populate_by_name": True}


# --- Response models ---

class TradeRecord(BaseModel):
    entry_ts: str
    exit_ts: str
    direction: str
    entry_price: float
    exit_price: float
    stop_loss: float
    take_profit: float
    pnl: float
    rr: float
    result: Literal["win", "loss"]


class Metrics(BaseModel):
    total_trades: int
    win_rate: float
    profit_factor: float
    max_drawdown: float
    net_profit: float
    avg_win: float
    avg_loss: float


class BacktestResult(BaseModel):
    metrics: Metrics
    equity_curve: list[float]
    trades: list[TradeRecord]
