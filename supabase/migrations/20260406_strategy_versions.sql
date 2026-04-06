-- Strategy version history

create table if not exists public.strategy_versions (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid references public.strategies on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  version_number int not null default 1,
  name text not null,
  dsl jsonb not null,
  change_summary jsonb,
  source_type text not null default 'original',
  created_at timestamptz default now(),

  unique (strategy_id, version_number)
);

alter table public.strategy_versions enable row level security;

create policy "Users can view own strategy versions"
  on public.strategy_versions for select
  using (auth.uid() = user_id);

create policy "Users can insert own strategy versions"
  on public.strategy_versions for insert
  with check (auth.uid() = user_id);

create index if not exists idx_strategy_versions_strategy
  on public.strategy_versions (strategy_id, version_number);
