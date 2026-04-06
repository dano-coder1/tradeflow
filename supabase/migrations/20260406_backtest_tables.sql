-- Backtest module tables

create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  dsl jsonb not null,
  created_at timestamptz default now()
);

alter table public.strategies enable row level security;

create policy "Users can view own strategies"
  on public.strategies for select
  using (auth.uid() = user_id);

create policy "Users can insert own strategies"
  on public.strategies for insert
  with check (auth.uid() = user_id);

create policy "Users can update own strategies"
  on public.strategies for update
  using (auth.uid() = user_id);

create policy "Users can delete own strategies"
  on public.strategies for delete
  using (auth.uid() = user_id);


create table if not exists public.backtest_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  strategy_id uuid references public.strategies on delete cascade not null,
  status text not null default 'pending',
  config jsonb,
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.backtest_jobs enable row level security;

create policy "Users can view own backtest jobs"
  on public.backtest_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert own backtest jobs"
  on public.backtest_jobs for insert
  with check (auth.uid() = user_id);


create table if not exists public.backtest_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.backtest_jobs on delete cascade unique not null,
  metrics jsonb not null,
  equity_curve jsonb not null,
  trades jsonb not null,
  summary text,
  created_at timestamptz default now()
);

alter table public.backtest_results enable row level security;

create policy "Users can view own backtest results"
  on public.backtest_results for select
  using (
    exists (
      select 1 from public.backtest_jobs
      where backtest_jobs.id = backtest_results.job_id
        and backtest_jobs.user_id = auth.uid()
    )
  );

-- Service role bypasses RLS, so the worker can read/write all rows.
-- Index for the worker polling query.
create index if not exists idx_backtest_jobs_pending
  on public.backtest_jobs (created_at)
  where status = 'pending';
