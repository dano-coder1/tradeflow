from __future__ import annotations

from engine.schema import Metrics


def compute_metrics(trades: list[dict], equity_curve: list[float]) -> Metrics:
    total = len(trades)
    if total == 0:
        return Metrics(
            total_trades=0,
            win_rate=0.0,
            profit_factor=0.0,
            max_drawdown=0.0,
            net_profit=0.0,
            avg_win=0.0,
            avg_loss=0.0,
        )

    wins = [t for t in trades if t["result"] == "win"]
    losses = [t for t in trades if t["result"] == "loss"]

    win_rate = len(wins) / total * 100

    gross_profit = sum(t["pnl"] for t in wins)
    gross_loss = sum(t["pnl"] for t in losses)
    profit_factor = gross_profit / abs(gross_loss) if gross_loss != 0 else float("inf")

    net_profit = sum(t["pnl"] for t in trades)
    avg_win = gross_profit / len(wins) if wins else 0.0
    avg_loss = gross_loss / len(losses) if losses else 0.0

    max_drawdown = _max_drawdown(equity_curve)

    return Metrics(
        total_trades=total,
        win_rate=round(win_rate, 2),
        profit_factor=round(profit_factor, 4),
        max_drawdown=round(max_drawdown, 4),
        net_profit=round(net_profit, 4),
        avg_win=round(avg_win, 4),
        avg_loss=round(avg_loss, 4),
    )


def _max_drawdown(equity: list[float]) -> float:
    if not equity:
        return 0.0
    peak = equity[0]
    max_dd = 0.0
    for val in equity:
        if val > peak:
            peak = val
        dd = (peak - val) / peak if peak != 0 else 0.0
        if dd > max_dd:
            max_dd = dd
    return max_dd
