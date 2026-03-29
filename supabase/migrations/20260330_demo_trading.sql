-- Paper Trading Engine: demo accounts, positions, trades
-- Also adds `source` column to main trades table for separation

-- ── 1. Add source column to existing trades table ───────────────────────────
alter table trades
  add column if not exists source text not null default 'manual';

alter table trades
  add constraint trades_source_check check (source in ('manual', 'csv', 'screenshot', 'sim'));

-- Back-fill: mark AI-extracted trades as screenshot source
update trades set source = 'screenshot' where ai_extracted = true and source = 'manual';

-- ── 2. Demo accounts ────────────────────────────────────────────────────────
create table if not exists demo_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Demo Account',
  currency text not null default 'USD',
  starting_balance numeric(18, 2) not null default 10000,
  balance numeric(18, 2) not null default 10000,
  equity numeric(18, 2) not null default 10000,
  created_at timestamptz not null default now()
);

alter table demo_accounts enable row level security;

create policy "Users can manage their own demo accounts"
  on demo_accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 3. Demo positions (open) ────────────────────────────────────────────────
create table if not exists demo_positions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references demo_accounts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  symbol text not null,
  direction text not null check (direction in ('buy', 'sell')),
  size numeric(18, 5) not null,
  entry_price numeric(18, 5) not null,
  sl numeric(18, 5),
  tp numeric(18, 5),
  opened_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open'))
);

alter table demo_positions enable row level security;

create policy "Users can manage their own demo positions"
  on demo_positions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── 4. Demo trades (closed) ────────────────────────────────────────────────
create table if not exists demo_trades (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references demo_accounts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  symbol text not null,
  direction text not null,
  size numeric(18, 5) not null,
  entry_price numeric(18, 5) not null,
  exit_price numeric(18, 5) not null,
  sl numeric(18, 5),
  tp numeric(18, 5),
  pnl numeric(18, 2) not null,
  opened_at timestamptz not null,
  closed_at timestamptz not null default now(),
  close_reason text not null default 'manual' check (close_reason in ('manual', 'sl', 'tp'))
);

alter table demo_trades enable row level security;

create policy "Users can manage their own demo trades"
  on demo_trades for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes
create index if not exists idx_demo_positions_account on demo_positions(account_id) where status = 'open';
create index if not exists idx_demo_trades_account on demo_trades(account_id, closed_at desc);
create index if not exists idx_trades_source on trades(user_id, source);
