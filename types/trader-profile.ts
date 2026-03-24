export interface StrategyProfile {
  entry_rules: string[];
  exit_rules: string[];
  confirmation_rules: string[];
  risk_management: string[];
  /** Non-negotiable rules — stored inside strategy_json, not as a separate column */
  non_negotiables: string[];
}

export type TradingStyle = "smc" | "breakout" | "scalping" | "custom";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export interface TraderProfile {
  id: string;
  user_id: string;
  style: TradingStyle;
  experience_level: ExperienceLevel;
  /** Stored as jsonb column `strategy_json` in the database */
  strategy_json: StrategyProfile;
  common_mistakes: string[];
  /** Stored as text column `strategy_text` in the database */
  strategy_text: string | null;
  created_at: string;
  updated_at: string;
}
