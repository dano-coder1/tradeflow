create table if not exists assistant_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  focus_completed_count integer not null default 0,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  last_completed_date date,
  updated_at timestamptz not null default now()
);

alter table assistant_stats enable row level security;

create policy "Users can manage their own assistant stats"
  on assistant_stats for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger assistant_stats_updated_at
  before update on assistant_stats
  for each row execute function update_updated_at();
