-- Drawings table for chart annotations
-- Run this in your Supabase SQL editor

create table if not exists public.drawings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  drawings jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table public.drawings enable row level security;

create policy "drawings_own" on public.drawings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
