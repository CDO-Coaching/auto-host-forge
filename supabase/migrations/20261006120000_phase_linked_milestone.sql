-- Rattacher une phase d'entraînement à un sous-objectif (facultatif).
alter table public.mesocycles
  add column if not exists linked_milestone_id uuid references public.objective_milestones(id) on delete set null;
