-- L'athlète peut marquer une séance entière comme « non faite » (pas réalisée).
-- completed_at reste null ; skipped=true distingue « non faite volontairement »
-- de « pas encore faite ».
alter table public.training_sessions
  add column if not exists skipped boolean not null default false,
  add column if not exists skipped_at timestamptz;
