-- Add leverage to demo_accounts
alter table demo_accounts
  add column if not exists leverage integer not null default 100;

-- Add contract_size to demo_positions so PnL calc is self-contained
alter table demo_positions
  add column if not exists contract_size numeric(18, 5) not null default 100000;

-- Add contract_size to demo_trades for historical accuracy
alter table demo_trades
  add column if not exists contract_size numeric(18, 5) not null default 100000;
