create table if not exists playbook_setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  strategy_id uuid,
  name text not null,
  description text not null default '',
  entry_rules text not null default '',
  invalidation_rules text not null default '',
  target_rules text not null default '',
  risk_reward_min float,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table playbook_setups enable row level security;

create policy "Users can manage their own playbooks"
  on playbook_setups for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_playbook_setups_user on playbook_setups(user_id, is_active);

create trigger playbook_setups_updated_at
  before update on playbook_setups
  for each row execute function update_updated_at();
