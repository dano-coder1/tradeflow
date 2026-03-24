import { TradeDirection } from "@/types/trade";

export function calculateRR(
  direction: TradeDirection,
  entry: number | null,
  sl: number | null,
  tp: number | null
): number | null {
  if (entry == null || sl == null || tp == null) return null;

  let risk = 0;
  let reward = 0;

  if (direction === "long") {
    risk = entry - sl;
    reward = tp - entry;
  } else {
    risk = sl - entry;
    reward = entry - tp;
  }

  if (risk <= 0) return null;
  return Number((reward / risk).toFixed(2));
}

export function calculatePnL(
  direction: TradeDirection,
  entry: number | null,
  exit: number | null
): number | null {
  if (entry == null || exit == null) return null;
  const pnl = direction === "long" ? exit - entry : entry - exit;
  return Number(pnl.toFixed(2));
}

export function calculateResult(
  pnl: number | null
): "win" | "loss" | "breakeven" | null {
  if (pnl == null) return null;
  if (pnl > 0) return "win";
  if (pnl < 0) return "loss";
  return "breakeven";
}

export function calculateStatus(exit: number | null): "open" | "closed" {
  return exit == null ? "open" : "closed";
}