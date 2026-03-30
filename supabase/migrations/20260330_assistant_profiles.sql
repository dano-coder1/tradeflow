create table if not exists assistant_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  experience_level text not null default 'beginner',
  primary_goal text not null default '',
  biggest_problem text not null default '',
  communication_style text not null default '',
  focus_area text not null default '',
  assistant_mode text not null default 'beginner_coach',
  onboarding_completed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table assistant_profiles enable row level security;

create policy "Users can manage their own assistant profile"
  on assistant_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger assistant_profiles_updated_at
  before update on assistant_profiles
  for each row execute function update_updated_at();
