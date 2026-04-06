from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@app.post("/backtest/debug-candles")
def debug_candles():
    df = generate_mock_candles(
        market="XAUUSD",
        timeframe="15m",
        start="2024-01-01",
        end="2024-01-10",
    )
    return df.to_dict(orient="records")
