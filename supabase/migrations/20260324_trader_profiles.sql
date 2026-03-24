-- ============================================================
-- trader_profiles table
--
-- Supabase does NOT auto-run migration files.
-- Copy everything below and run it in:
--   Supabase Dashboard → SQL Editor → New Query → Run
-- It is fully idempotent — safe to run more than once.
-- ============================================================

-- Trigger function (shared with trades table — safe to recreate)
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── strategy_json default includes non_negotiables (no separate rules column) ──
-- Non-negotiable rules live inside the strategy_json jsonb, not as a raw text[].
-- Schema:
--   strategy_json = {
--     entry_rules:        string[],
--     exit_rules:         string[],
--     confirmation_rules: string[],
--     risk_management:    string[],
--     non_negotiables:    string[]   ← replaces the old top-level rules column
--   }

-- Main table (fresh install)
create table if not exists trader_profiles (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        references auth.users(id) on delete cascade not null unique,
  style            text        not null default 'custom'
                               check (style in ('smc', 'breakout', 'scalping', 'custom')),
  experience_level text        not null default 'beginner'
                               check (experience_level in ('beginner', 'intermediate', 'advanced')),
  strategy_json    jsonb       not null default '{"entry_rules":[],"exit_rules":[],"confirmation_rules":[],"risk_management":[],"non_negotiables":[]}',
  common_mistakes  text[]      not null default '{}',
  strategy_text    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── Idempotent fixes for tables created from older migrations ──────────────────

-- 1. Rename 'strategy' → 'strategy_json' if the table was created with the old column name
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'trader_profiles'
      and column_name  = 'strategy'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'trader_profiles'
      and column_name  = 'strategy_json'
  ) then
    alter table trader_profiles rename column strategy to strategy_json;
  end if;
end $$;

-- 2. Ensure strategy_json exists (covers any table created without it)
alter table trader_profiles
  add column if not exists strategy_json jsonb not null
  default '{"entry_rules":[],"exit_rules":[],"confirmation_rules":[],"risk_management":[],"non_negotiables":[]}';

-- 3. Migrate the old standalone 'rules' column into strategy_json->non_negotiables, then drop it
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'trader_profiles'
      and column_name  = 'rules'
  ) then
    -- Migrate any existing data
    update trader_profiles
    set strategy_json = strategy_json || jsonb_build_object('non_negotiables', to_jsonb(rules))
    where rules is not null and array_length(rules, 1) > 0;

    alter table trader_profiles drop column rules;
  end if;
end $$;

-- 4. Backfill non_negotiables key for rows that predate this migration
update trader_profiles
set strategy_json = strategy_json || '{"non_negotiables":[]}'::jsonb
where not (strategy_json ? 'non_negotiables');

-- 5. Ensure remaining columns exist
alter table trader_profiles add column if not exists common_mistakes text[] not null default '{}';
alter table trader_profiles add column if not exists strategy_text text;

-- ── Row Level Security ─────────────────────────────────────────────────────────
alter table trader_profiles enable row level security;

drop policy if exists "Users can manage their own profile" on trader_profiles;
create policy "Users can manage their own profile"
  on trader_profiles for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Auto-update trigger ────────────────────────────────────────────────────────
drop trigger if exists trader_profiles_updated_at on trader_profiles;
create trigger trader_profiles_updated_at
  before update on trader_profiles
  for each row execute function update_updated_at();
