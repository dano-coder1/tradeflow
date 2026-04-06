from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import date

from engine.candles import generate_mock_candles
from engine.runner import run_backtest
from engine.schema import BacktestResult, StrategyDSL

app = FastAPI(title="TradeFlow Backtest Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/backtest", response_model=BacktestResult)
def backtest(strategy: StrategyDSL):
    return run_backtest(strategy)


class CandlesRequest(BaseModel):
    market: str = "XAUUSD"
    timeframe: str = "15m"
    date_from: date = Field(alias="from")
    date_to: date = Field(alias="to")
    model_config = {"populate_by_name": True}


@app.post("/backtest/candles")
def get_candles(req: CandlesRequest):
    df = generate_mock_candles(
        market=req.market,
        timeframe=req.timeframe,
        start=str(req.date_from),
        end=str(req.date_to),
    )
    # Downsample to max 2000
    max_candles = 2000
    step = max(1, len(df) // max_candles)
    rows = df.iloc[::step]
    return [
        {
            "ts": row["ts"].isoformat(),
            "open": round(float(row["open"]), 5),
            "high": round(float(row["high"]), 5),
            "low": round(float(row["low"]), 5),
            "close": round(float(row["close"]), 5),
        }
        for _, row in rows.iterrows()
    ]


@app.post("/backtest/debug-candles")
def debug_candles():
    df = generate_mock_candles(
        market="XAUUSD",
        timeframe="15m",
        start="2024-01-01",
        end="2024-01-10",
    )
    return df.to_dict(orient="records")
