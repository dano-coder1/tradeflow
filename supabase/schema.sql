-- TradeFlow database schema
-- Run this in your Supabase SQL editor

create extension if not exists "uuid-ossp";

create table if not exists trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  journal_id uuid,
  symbol text not null,
  direction text not null check (direction in ('long', 'short')),
  entry numeric(18, 5),
  exit numeric(18, 5),
  sl numeric(18, 5),
  tp numeric(18, 5),
  size numeric(18, 5),
  risk_amount numeric(18, 2),
  pnl numeric(18, 2),
  rr numeric(10, 2),
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  result text check (result in ('win', 'loss', 'breakeven')),
  tag text,
  notes text,
  timeframe text,
  trade_date date not null default current_date,
  mt5_ticket text,
  screenshot_url text,
  ai_extracted boolean not null default false,
  ai_review_status text not null default 'none' check (ai_review_status in ('none', 'processing', 'done', 'failed')),
  ai_review_summary text,
  ai_review_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security
alter table trades enable row level security;

create policy "Users can manage their own trades"
  on trades for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Storage bucket for trade screenshots
insert into storage.buckets (id, name, public)
values ('trade-screenshots', 'trade-screenshots', false)
on conflict (id) do nothing;

create policy "Users can upload their own screenshots"
  on storage.objects for insert
  with check (bucket_id = 'trade-screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read their own screenshots"
  on storage.objects for select
  using (bucket_id = 'trade-screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete their own screenshots"
  on storage.objects for delete
  using (bucket_id = 'trade-screenshots' and auth.uid()::text = (storage.foldername(name))[1]);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trades_updated_at
  before update on trades
  for each row execute function update_updated_at();
