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
