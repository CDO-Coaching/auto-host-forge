-- Jour du mois (1-31) à partir duquel le client doit payer (compta)
alter table public.coach_athlete_relationships add column if not exists billing_start_day integer not null default 1;
alter table public.external_clients add column if not exists billing_start_day integer not null default 1;
alter table public.coach_athlete_relationships add constraint billing_day_range check (billing_start_day between 1 and 31);
alter table public.external_clients add constraint billing_day_range_ext check (billing_start_day between 1 and 31);
notify pgrst, 'reload schema';
