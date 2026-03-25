-- Migration: add symbol column to analysis_runs for instrument-folder grouping
alter table analysis_runs add column if not exists symbol text;

create index if not exists analysis_runs_user_symbol
  on analysis_runs (user_id, symbol);
