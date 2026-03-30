create table if not exists assistant_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  current_focus_index integer not null default 0,
  last_completed_at timestamptz,
  cycle_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table assistant_progress enable row level security;

create policy "Users can manage their own assistant progress"
  on assistant_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger assistant_progress_updated_at
  before update on assistant_progress
  for each row execute function update_updated_at();
