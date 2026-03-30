export interface PlaybookSetup {
  id: string;
  user_id: string;
  strategy_id: string | null;
  name: string;
  description: string;
  entry_rules: string;
  invalidation_rules: string;
  target_rules: string;
  risk_reward_min: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
