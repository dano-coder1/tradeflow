// ── Shared strategy types and localStorage helpers ───────────────────────────
// Used by Strategy page, Chart Coach modal, and Trade Autopsy.

export interface SavedStrategy {
  id: string;
  name: string;
  source: "preset" | "search" | "file" | "url" | "text" | "image" | "pdf";
  summary: string;
  rules: string[];
  methodologyTags: string[];
  marketTags: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  created_at: string;
}

const STRATEGIES_KEY = "tf:strategies";
const ACTIVE_KEY = "tf:active-strategy";

export function loadStrategies(): SavedStrategy[] {
  try { const r = localStorage.getItem(STRATEGIES_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}

export function saveStrategies(s: SavedStrategy[]) {
  try { localStorage.setItem(STRATEGIES_KEY, JSON.stringify(s)); } catch {}
}

export function loadActiveStrategyId(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

export function saveActiveStrategyId(id: string | null) {
  try { if (id) localStorage.setItem(ACTIVE_KEY, id); else localStorage.removeItem(ACTIVE_KEY); } catch {}
}

export function getActiveStrategy(): SavedStrategy | null {
  const strats = loadStrategies();
  const id = loadActiveStrategyId();
  return strats.find((s) => s.id === id) ?? null;
}

/**
 * Sync the active SavedStrategy to Supabase trader_profiles
 * so the dashboard (server component) can display it.
 */
export async function syncActiveStrategyToProfile(strategy: SavedStrategy): Promise<void> {
  try {
    // Map SavedStrategy difficulty to TraderProfile experience_level
    const experienceMap: Record<string, string> = {
      beginner: "beginner",
      intermediate: "intermediate",
      advanced: "advanced",
    };

    // Map methodology tags to style
    const tags = strategy.methodologyTags.map((t) => t.toLowerCase());
    let style = "custom";
    if (tags.includes("smc") || tags.includes("order-flow")) style = "smc";
    else if (tags.includes("breakout") || tags.includes("session")) style = "breakout";
    else if (tags.includes("scalping")) style = "scalping";

    const strategyJson = {
      entry_rules: strategy.rules,
      exit_rules: [] as string[],
      confirmation_rules: [] as string[],
      risk_management: [] as string[],
      non_negotiables: [] as string[],
    };

    await fetch("/api/trader-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        style,
        experience_level: experienceMap[strategy.difficulty] ?? "intermediate",
        strategy_json: strategyJson,
        strategy_text: `${strategy.name}\n\n${strategy.summary}`,
      }),
    });
  } catch {
    // Non-critical — dashboard just won't show the strategy
  }
}

// ── Backtest DSL type (shared with backtesting page) ─────────────────────────

export interface BacktestDSL {
  market?: string;
  timeframe?: string;
  date_range?: { from: string; to: string };
  entry?: {
    direction?: string;
    conditions?: Array<Record<string, unknown>>;
  };
  exit?: {
    stop_loss?: { type: string; value: number };
    take_profit?: { type: string; ratio: number };
  };
  filters?: Array<{ type: string; sessions?: string[] }>;
  commission_pct?: number;
}

// ── Curated strategies ───────────────────────────────────────────────────────

export interface CuratedStrategy {
  name: string;
  summary: string;
  category: string;
  marketFit: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  rules: string[];
  methodologyTags: string[];
  backtest_dsl?: BacktestDSL;
}

export const CURATED_STRATEGIES: CuratedStrategy[] = [
  {
    name: "SMC Sniper Entries",
    summary: "Institutional order flow strategy using BOS, CHoCH, order blocks, and FVG for precise entries from premium/discount zones.",
    category: "SMC",
    marketFit: ["forex", "gold", "indices"],
    difficulty: "intermediate",
    methodologyTags: ["smc", "order-flow"],
    rules: [
      "Establish HTF bias from Daily/Weekly before LTF entries",
      "Wait for liquidity sweep of clean high or low",
      "Confirm BOS or CHoCH with closed candle",
      "Enter at Order Block or FVG after displacement",
      "Only enter from premium (shorts) or discount (longs)",
      "SL below/above displacement origin, minimum 1:2 R:R",
    ],
  },
  {
    name: "London Breakout",
    summary: "Capitalize on the volatility spike during the London session open by trading breakouts of the Asian range.",
    category: "Breakout",
    marketFit: ["forex", "gold"],
    difficulty: "beginner",
    methodologyTags: ["breakout", "session"],
    rules: [
      "Mark Asian session high and low before London open",
      "Wait for London session to break Asian range",
      "Enter on first retest of broken level",
      "SL at opposite side of Asian range",
      "TP1 at 1:1 R:R, TP2 at 1:2 R:R",
      "No entries after 11:00 GMT",
    ],
  },
  {
    name: "EMA Crossover Trend Following",
    summary: "Simple trend-following system using EMA 9/21 crossovers confirmed by EMA 50 direction for entries on pullbacks.",
    category: "Trend Following",
    marketFit: ["forex", "indices", "crypto"],
    difficulty: "beginner",
    methodologyTags: ["indicators", "trend-following"],
    rules: [
      "EMA 9 crosses above EMA 21 = bullish signal",
      "EMA 9 crosses below EMA 21 = bearish signal",
      "Only trade in direction of EMA 50 slope",
      "Enter on pullback to EMA 21 after crossover",
      "SL below most recent swing low (longs) or high (shorts)",
      "Trail stop using EMA 21",
    ],
    backtest_dsl: {
      market: "XAUUSD",
      timeframe: "15m",
      entry: {
        direction: "long",
        conditions: [
          { type: "ema_cross", fast: 9, slow: 21 },
          { type: "rsi_above", period: 14, value: 50 },
        ],
      },
      exit: {
        stop_loss: { type: "fixed_pct", value: 0.5 },
        take_profit: { type: "rr", ratio: 2.0 },
      },
      filters: [],
      commission_pct: 0.07,
    },
  },
  {
    name: "RSI Divergence Reversals",
    summary: "Identify exhaustion and potential reversals using RSI divergence at key support/resistance levels.",
    category: "Indicators",
    marketFit: ["forex", "gold", "indices"],
    difficulty: "intermediate",
    methodologyTags: ["indicators", "reversal"],
    rules: [
      "Identify bullish divergence: price lower low, RSI higher low",
      "Identify bearish divergence: price higher high, RSI lower high",
      "Only trade divergence at key S/R or PDH/PDL levels",
      "Confirm with candlestick reversal pattern",
      "SL below/above the divergence swing point",
      "TP at next major S/R level",
    ],
    backtest_dsl: {
      market: "XAUUSD",
      timeframe: "15m",
      entry: {
        direction: "long",
        conditions: [
          { type: "rsi_below", period: 14, value: 35 },
          { type: "ema_cross", fast: 20, slow: 50 },
        ],
      },
      exit: {
        stop_loss: { type: "fixed_pct", value: 0.6 },
        take_profit: { type: "rr", ratio: 2.0 },
      },
      filters: [{ type: "session", sessions: ["london", "new_york"] }],
      commission_pct: 0.07,
    },
  },
  {
    name: "Supply & Demand Zone Trading",
    summary: "Trade reactions from fresh supply and demand zones identified from strong impulsive moves away from consolidation areas.",
    category: "Price Action",
    marketFit: ["forex", "gold", "indices", "futures"],
    difficulty: "intermediate",
    methodologyTags: ["price-action", "supply-demand"],
    rules: [
      "Identify demand zones: last consolidation before strong bullish move",
      "Identify supply zones: last consolidation before strong bearish move",
      "Only trade fresh (untested) zones",
      "Enter with limit order at zone edge",
      "SL a few pips beyond the zone",
      "TP at opposing zone or 1:3 R:R minimum",
    ],
  },
  {
    name: "1-Minute Scalping",
    summary: "Fast-paced scalping strategy on 1m chart using EMA 9/21 and RSI for quick entries during high-volume sessions.",
    category: "Scalping",
    marketFit: ["forex", "gold", "indices"],
    difficulty: "advanced",
    methodologyTags: ["scalping", "indicators"],
    rules: [
      "Trade only during London/NY overlap (13:00-17:00 UTC)",
      "Use EMA 9/21 for direction on 1m chart",
      "RSI below 30 or above 70 confirms entry",
      "Enter on EMA 9 touch after signal",
      "TP at 5-10 pips, SL at 3-5 pips",
      "Maximum 5 trades per session, stop after 2 consecutive losses",
    ],
    backtest_dsl: {
      market: "XAUUSD",
      timeframe: "1m",
      entry: {
        direction: "long",
        conditions: [
          { type: "ema_cross", fast: 9, slow: 21 },
          { type: "rsi_above", period: 14, value: 70 },
        ],
      },
      exit: {
        stop_loss: { type: "fixed_pct", value: 0.15 },
        take_profit: { type: "rr", ratio: 1.5 },
      },
      filters: [{ type: "session", sessions: ["london_ny_overlap"] }],
      commission_pct: 0.07,
    },
  },
  {
    name: "Swing Trading with Weekly Bias",
    summary: "Multi-day position strategy using weekly chart for bias and 4H for entries at key structural levels.",
    category: "Swing Trading",
    marketFit: ["forex", "gold", "indices", "futures"],
    difficulty: "intermediate",
    methodologyTags: ["swing-trading", "price-action"],
    rules: [
      "Determine bias from Weekly chart structure",
      "Identify entry zones on 4H chart (OB, FVG, or S/R)",
      "Wait for 4H BOS in direction of weekly bias",
      "Enter at 4H pullback into identified zone",
      "SL below/above 4H structure, TP at weekly target",
      "Hold position 2-5 days, check daily for invalidation",
    ],
  },
  {
    name: "Fibonacci Retracement Entries",
    summary: "Use Fibonacci retracement levels (38.2%, 50%, 61.8%) to enter pullbacks within established trends.",
    category: "Price Action",
    marketFit: ["forex", "gold", "indices", "crypto"],
    difficulty: "beginner",
    methodologyTags: ["price-action", "fibonacci"],
    rules: [
      "Identify a clear impulsive move in trend direction",
      "Draw Fibonacci from swing low to swing high (or vice versa)",
      "Wait for price to pull back to 50% or 61.8% level",
      "Confirm with bullish/bearish engulfing candle at fib level",
      "SL below 78.6% retracement level",
      "TP at previous swing high/low or 1.618 extension",
    ],
  },
  {
    name: "ICT Silver Bullet",
    summary: "Time-based entry model targeting the 10:00-11:00 AM and 2:00-3:00 PM EST windows for high-probability setups.",
    category: "SMC",
    marketFit: ["forex", "gold", "indices"],
    difficulty: "advanced",
    methodologyTags: ["smc", "session", "order-flow"],
    rules: [
      "Only enter during Silver Bullet windows: 10-11 AM or 2-3 PM EST",
      "Identify FVG or order block formed during the window",
      "Confirm with displacement and market structure shift",
      "Entry at OB/FVG mitigation within the time window",
      "SL behind the order block or FVG",
      "TP at opposing liquidity or session high/low",
    ],
  },
  {
    name: "Bollinger Band Mean Reversion",
    summary: "Trade price returning to the mean when it touches or exceeds Bollinger Bands in ranging market conditions.",
    category: "Indicators",
    marketFit: ["forex", "indices", "crypto"],
    difficulty: "beginner",
    methodologyTags: ["indicators", "mean-reversion"],
    rules: [
      "Identify ranging market (flat Bollinger Band middle line)",
      "Enter long when price touches lower band and shows rejection candle",
      "Enter short when price touches upper band and shows rejection candle",
      "Avoid during strong trends (bands expanding)",
      "SL beyond the band by 1 ATR",
      "TP at middle band (20 SMA)",
    ],
    backtest_dsl: {
      market: "XAUUSD",
      timeframe: "15m",
      entry: {
        direction: "long",
        conditions: [
          { type: "ema_cross", fast: 20, slow: 50 },
          { type: "rsi_below", period: 14, value: 30 },
        ],
      },
      exit: {
        stop_loss: { type: "fixed_pct", value: 0.4 },
        take_profit: { type: "rr", ratio: 1.5 },
      },
      filters: [{ type: "session", sessions: ["london", "new_york"] }],
      commission_pct: 0.07,
    },
  },
];
