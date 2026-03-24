import { TradingStyle, StrategyProfile } from "@/types/trader-profile";

export interface StrategyPreset {
  name: string;
  style: TradingStyle;
  description: string;
  strategy: StrategyProfile;
}

export const STRATEGY_PRESETS: Record<Exclude<TradingStyle, "custom">, StrategyPreset> = {
  smc: {
    name: "Smart Money Concepts (SMC)",
    style: "smc",
    description: "Trade with institutional order flow — liquidity sweeps, BOS/CHoCH, order blocks, FVG.",
    strategy: {
      entry_rules: [
        "Establish HTF bias (Daily/Weekly) before any LTF entry",
        "Wait for liquidity sweep of a clean high or low",
        "Confirm BOS or CHoCH on entry timeframe with a closed candle",
        "Enter at or inside an Order Block or FVG after displacement",
        "Only enter from premium or discount zones — never mid-range",
      ],
      exit_rules: [
        "TP1 at nearest imbalance or minor liquidity target",
        "TP2 at opposing swing high/low or major OB",
        "TP3 at HTF liquidity (weekly high/low)",
        "Move SL to break-even after TP1 is hit",
        "Exit immediately if market structure invalidates bias",
      ],
      confirmation_rules: [
        "HTF bias aligns with the entry direction",
        "Visible displacement (impulsive candle) from entry level",
        "At least one liquidity sweep before entry",
        "BOS or CHoCH confirmed — no entry on wick alone",
      ],
      risk_management: [
        "Risk maximum 1-2% per trade",
        "SL placed below/above origin of displacement",
        "Minimum R:R of 1:2 before entering",
        "No trades in choppy or ranging markets",
        "No more than 2 open positions simultaneously",
      ],
      non_negotiables: [
        "No trade without HTF bias confirmation",
        "No entry without a visible liquidity sweep",
        "No entry without displacement from the level",
        "Never enter mid-range",
        "Wait for BOS or CHoCH before executing",
        "SL must be at the invalidation level, not arbitrary",
      ],
    },
  },

  breakout: {
    name: "Breakout Trading",
    style: "breakout",
    description: "Trade momentum breakouts from consolidation with volume confirmation and retest entries.",
    strategy: {
      entry_rules: [
        "Identify a clear consolidation range with at least 3 touches on each side",
        "Wait for a candle close outside the range (not just a wick)",
        "Enter on the first retest of the broken level",
        "Confirm breakout with above-average volume",
        "Avoid breakouts against the HTF trend",
      ],
      exit_rules: [
        "TP1 at measured move (range height projected from breakout point)",
        "TP2 at next significant support/resistance level",
        "Trail SL after 1:1 R:R is achieved",
        "Exit if retest fails and price re-enters the range",
      ],
      confirmation_rules: [
        "Full candle body closes outside the range",
        "Retest holds the broken level as new S/R",
        "HTF trend supports the breakout direction",
        "Volume confirms the break",
      ],
      risk_management: [
        "SL just inside the broken range",
        "Risk maximum 1% per trade",
        "Avoid entries during low-volume sessions",
        "Minimum 1:2 R:R required",
      ],
      non_negotiables: [
        "Only trade closed candle breakouts — no wicks",
        "Always wait for the retest, never chase",
        "HTF must align with the breakout direction",
        "Exit immediately if price re-enters the range",
        "Volume must confirm the break",
      ],
    },
  },

  scalping: {
    name: "Scalping",
    style: "scalping",
    description: "High-frequency short-duration trades during peak liquidity sessions with tight risk.",
    strategy: {
      entry_rules: [
        "Trade only during high-liquidity sessions (London open, NY open, overlap)",
        "Use M1-M5 for entries, M15 for direction and context",
        "Enter at dynamic support/resistance (EMA 20/50 on M5)",
        "Look for momentum candles with immediate follow-through",
        "Only trade in the direction of the M15 trend",
      ],
      exit_rules: [
        "Take profit quickly — targets are 1:1 to 1:2",
        "Exit if price stalls for more than 3 candles after entry",
        "Never hold overnight",
        "Close all positions 30 minutes before major news events",
      ],
      confirmation_rules: [
        "M15 shows a clear trend (not ranging)",
        "M5 entry aligns with M15 bias",
        "Clear momentum visible — not a slow grind",
        "Spread is normal (not widened)",
      ],
      risk_management: [
        "Maximum 0.5% risk per trade",
        "Tight SL (5-15 pips depending on asset)",
        "Stop trading after 3 consecutive losses in a session",
        "Daily loss limit of 2% — hard stop",
        "No trades during major news releases",
      ],
      non_negotiables: [
        "Only trade London and NY sessions",
        "Never hold a position overnight",
        "Stop after 3 consecutive losses",
        "Exit if price stalls — do not wait for SL",
        "No trading 30 minutes around major news",
        "Daily loss limit is non-negotiable",
      ],
    },
  },
};
