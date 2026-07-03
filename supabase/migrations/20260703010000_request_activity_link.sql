-- Le coach peut demander le lien Garmin/Strava d'une séance cardio
alter table public.session_exercises add column if not exists request_activity_link boolean not null default false;
notify pgrst, 'reload schema';
