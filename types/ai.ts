export interface ExtractTradeResponse {
  symbol: string | null;
  direction: "long" | "short" | null;
  entry: number | null;
  sl: number | null;
  tp: number | null;
  exit: number | null;
  timeframe: string | null;
  notes_from_chart: string | null;
  confidence: number;
  detected_elements: {
    position_tool: boolean;
    horizontal_levels: boolean;
    trendlines: boolean;
    labels: boolean;
  };
}

export interface ReviewTradeResponse {
  summary: string;
  setup_quality: number;
  entry_quality: number;
  risk_management: number;
  strengths: string[];
  mistakes: string[];
  detected_smc_elements: {
    bos: boolean;
    choch: boolean;
    liquidity_sweep: boolean;
    order_block: boolean;
    fvg: boolean;
    premium_discount_context: boolean;
    unclear_structure: boolean;
  };
  execution_feedback: {
    entry_was_late: boolean;
    sl_too_tight: boolean;
    tp_realistic: boolean;
    rr_good: boolean;
  };
  coach_note: string;
  // Autopsy fields — populated when a trader profile/strategy exists
  rule_adherence_score?: number;
  execution_score?: number;
  discipline_score?: number;
  mistake_tags?: string[];
  pattern_detection?: string[];
}

export interface SmcReasons {
  liquidity_sweep: boolean;
  bos: boolean;
  choch: boolean;
  order_block: boolean;
  fvg: boolean;
  htf_alignment: boolean;
}

export interface SmcNotes {
  liquidity_sweep?: string;
  bos?: string;
  choch?: string;
  order_block?: string;
  fvg?: string;
  htf_alignment?: string;
}

export interface ChartAnalysis {
  bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  decision_zone: string;
  long_scenario: string;
  short_scenario: string;
  sniper_entry: string;
  sl: string;
  tp1: string;
  tp2: string;
  tp3: string;
  no_trade: boolean;
  no_trade_condition: string;
  reason_if_no_trade?: string;
  reasoning?: string;
  smc_reasons: SmcReasons;
  smc_notes: SmcNotes;
  telegram_block: string;
  /** Populated by the API after saving to analysis_runs */
  analysisId?: string;
}
