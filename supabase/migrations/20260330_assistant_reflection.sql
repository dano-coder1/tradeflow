create table if not exists assistant_reflection (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  followed boolean not null,
  reason text,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);

alter table assistant_reflection enable row level security;

create policy "Users can manage their own reflections"
  on assistant_reflection for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table assistant_stats
  add column if not exists honest_completions integer not null default 0;

alter table assistant_stats
  add column if not exists total_reflections integer not null default 0;
