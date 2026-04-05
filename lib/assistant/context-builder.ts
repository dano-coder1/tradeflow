/**
 * Fetches the user's trading context from Supabase for AI-driven coaching.
 * Returns structured data: stats, recent trades, mistakes, behavior patterns.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface TradeContext {
  symbol: string;
  direction: string;
  result: string | null;
  pnl: number | null;
  rr: number | null;
  tag: string | null;
  notes: string | null;
  trade_date: string | null;
}

export interface TradingStats {
  totalTrades: number;
  winRate: number;
  avgRR: number;
  bestStreak: number;
  worstStreak: number;
}

export interface Mistake {
  trade_date: string | null;
  symbol: string;
  key_mistake: string;
  behavior_tags: string[];
}

export interface BehaviorPattern {
  tag: string;
  count: number;
}

export interface TradingContext {
  stats: TradingStats;
  recentTrades: TradeContext[];
  mistakes: Mistake[];
  behaviorPatterns: BehaviorPattern[];
}

export async function buildTradingContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<TradingContext> {
  // Fetch last 20 trades
  const { data: trades } = await supabase
    .from("trades")
    .select("symbol, direction, result, pnl, rr, tag, notes, trade_date, ai_review_json")
    .eq("user_id", userId)
    .order("trade_date", { ascending: false })
    .limit(20);

  const tradeRows = (trades ?? []) as Array<TradeContext & { ai_review_json?: Record<string, unknown> | null }>;

  // Compute stats
  const closed = tradeRows.filter((t) => t.result === "win" || t.result === "loss");
  const wins = closed.filter((t) => t.result === "win").length;
  const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;

  const rrValues = tradeRows.map((t) => t.rr).filter((v): v is number => v != null);
  const avgRR = rrValues.length > 0
    ? Math.round((rrValues.reduce((a, b) => a + b, 0) / rrValues.length) * 100) / 100
    : 0;

  // Streak calculation
  let bestStreak = 0;
  let worstStreak = 0;
  let currentWin = 0;
  let currentLoss = 0;
  for (const t of closed) {
    if (t.result === "win") {
      currentWin++;
      currentLoss = 0;
      bestStreak = Math.max(bestStreak, currentWin);
    } else {
      currentLoss++;
      currentWin = 0;
      worstStreak = Math.max(worstStreak, currentLoss);
    }
  }

  const stats: TradingStats = {
    totalTrades: tradeRows.length,
    winRate,
    avgRR,
    bestStreak,
    worstStreak,
  };

  // Extract mistakes from AI reviews
  const mistakes: Mistake[] = [];
  const tagCounts = new Map<string, number>();

  for (const t of tradeRows) {
    const review = t.ai_review_json;
    if (review && typeof review === "object") {
      const keyMistake = review.key_mistake as string | undefined;
      const tags = review.behavior_tags as string[] | undefined;

      if (keyMistake) {
        mistakes.push({
          trade_date: t.trade_date,
          symbol: t.symbol,
          key_mistake: keyMistake,
          behavior_tags: tags ?? [],
        });
      }

      if (Array.isArray(tags)) {
        for (const tag of tags) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        }
      }
    }
  }

  // Build behavior patterns sorted by frequency
  const behaviorPatterns: BehaviorPattern[] = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Strip ai_review_json from the trade context sent to prompt
  const recentTrades: TradeContext[] = tradeRows.map(({ ai_review_json: _, ...rest }) => rest);

  return { stats, recentTrades, mistakes, behaviorPatterns };
}
