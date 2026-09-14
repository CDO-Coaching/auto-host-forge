-- Rappel hebdomadaire : le dimanche à 17h, notifier chaque sportif dont les séances
-- de la semaine en cours ne sont PAS toutes remplies (au moins une completed_at IS NULL).
-- La file (notification_queue) est ensuite vidée par n8n comme les autres notifs.
--
-- Déclenchement : à câbler dans n8n → planification "dimanche 17:00 Europe/Paris",
-- appeler cette fonction (RPC service_role) PUIS le vidage habituel de la file.

create or replace function public.enqueue_unfinished_session_reminders(
  p_week integer default null,
  p_year integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week  integer := coalesce(p_week, extract(week   from (now() at time zone 'Europe/Paris'))::int);
  v_year  integer := coalesce(p_year, extract(isoyear from (now() at time zone 'Europe/Paris'))::int);
  v_count integer;
begin
  with athletes_due as (
    -- Sportifs ayant au moins une séance non terminée sur la semaine visée
    select distinct tw.athlete_id as user_id
    from public.training_weeks tw
    join public.training_sessions ts on ts.week_id = tw.id
    where tw.week_number = v_week
      and tw.year = v_year
      and ts.completed_at is null
  )
  insert into public.notification_queue (user_id, title, body, url, type)
  select a.user_id,
         'Termine tes séances',
         'Il te reste des séances à remplir cette semaine — prends 2 min pour les compléter 📋',
         '/sportif/seances',
         'session'
  from athletes_due a
  -- Ne pas empiler : rien si un rappel "session" est déjà en attente d'envoi
  where not exists (
    select 1 from public.notification_queue q
    where q.user_id = a.user_id
      and q.type = 'session'
      and q.sent_at is null
  );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.enqueue_unfinished_session_reminders(integer, integer) from anon, authenticated;
grant  execute on function public.enqueue_unfinished_session_reminders(integer, integer) to service_role;
