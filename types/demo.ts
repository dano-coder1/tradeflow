export interface DemoAccount {
  id: string;
  user_id: string;
  name: string;
  currency: string;
  starting_balance: number;
  balance: number;
  equity: number;
  created_at: string;
}

export interface DemoPosition {
  id: string;
  account_id: string;
  user_id: string;
  symbol: string;
  direction: "buy" | "sell";
  size: number;
  entry_price: number;
  sl: number | null;
  tp: number | null;
  opened_at: string;
  status: "open";
  /** Client-side only: live unrealized PnL */
  unrealized_pnl?: number;
}

export interface DemoTrade {
  id: string;
  account_id: string;
  user_id: string;
  symbol: string;
  direction: string;
  size: number;
  entry_price: number;
  exit_price: number;
  sl: number | null;
  tp: number | null;
  pnl: number;
  opened_at: string;
  closed_at: string;
  close_reason: "manual" | "sl" | "tp";
}
