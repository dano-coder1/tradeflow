export type TradeDirection = "long" | "short";
export type TradeStatus = "open" | "closed" | "cancelled";
export type TradeResult = "win" | "loss" | "breakeven" | null;
export type AIReviewStatus = "none" | "processing" | "done" | "failed";

export interface Trade {
  id: string;
  user_id: string;
  journal_id: string | null;
  symbol: string;
  direction: TradeDirection;
  entry: number | null;
  exit: number | null;
  sl: number | null;
  tp: number | null;
  size: number | null;
  risk_amount: number | null;
  pnl: number | null;
  rr: number | null;
  status: TradeStatus;
  result: TradeResult;
  tag: string | null;
  notes: string | null;
  timeframe: string | null;
  trade_date: string;
  mt5_ticket: string | null;
  screenshot_url: string | null;
  ai_extracted: boolean;
  ai_review_status: AIReviewStatus;
  ai_review_summary: string | null;
  ai_review_json: Record<string, unknown> | null;
  autopsy_json: AutopsyResult | null;
  created_at: string;
  updated_at: string;
}

export interface AutopsyResult {
  verdict: string;
  confidence: "high" | "medium" | "low";
  what_went_well: string[];
  what_went_wrong: string[];
  key_mistake: string | null;
  improvement_tip: string;
  behavior_tags: string[];
  generated_at: string;
}