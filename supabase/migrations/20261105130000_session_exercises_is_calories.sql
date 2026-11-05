-- Unité "calories" (kcal) pour un exercice, au même titre que is_duration / is_distance.
alter table public.session_exercises
  add column if not exists is_calories boolean not null default false;
