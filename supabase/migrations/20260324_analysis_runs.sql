-- Migration: analysis_runs
-- Stores SMC chart analysis history per user

create table if not exists analysis_runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  image_urls   jsonb not null default '[]',
  output_json  jsonb not null,
  bias         text not null check (bias in ('bullish', 'bearish', 'neutral')),
  no_trade     boolean not null default false,
  telegram_block text not null,
  created_at   timestamptz not null default now()
);

-- Row Level Security: users see only their own rows
alter table analysis_runs enable row level security;

create policy "Users can manage their own analysis runs"
  on analysis_runs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast per-user history queries
create index if not exists analysis_runs_user_created
  on analysis_runs (user_id, created_at desc);
