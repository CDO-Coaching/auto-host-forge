-- Une phase peut aussi « préparer » l'objectif principal (pas seulement un sous-objectif).
alter table public.mesocycles
  add column if not exists prepares_main_objective boolean not null default false;
