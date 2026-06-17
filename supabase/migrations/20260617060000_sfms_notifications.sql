-- Notifications questionnaire de surentraînement (SFMS)
-- 1) Le coach envoie un questionnaire → notif à l'athlète (ouvre le questionnaire)
-- 2) L'athlète termine → notif au(x) coach(s) (ouvre la fiche/résumé de l'athlète)
-- Types : 'sfms_request' (athlète) et 'sfms_result' (coach), activables dans les préférences.

-- ── 1. Demande envoyée → athlète ──
create or replace function public.notify_on_sfms_request()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.status is distinct from 'pending' then return NEW; end if;
  if not exists (select 1 from public.notification_preferences np where np.user_id = NEW.athlete_id and np.enabled = true) then return NEW; end if;
  if not exists (select 1 from public.notification_rules r where r.user_id = NEW.athlete_id and r.type = 'sfms_request' and r.enabled = true) then return NEW; end if;

  insert into public.notification_queue (user_id, title, body, url, type)
  values (
    NEW.athlete_id,
    'Questionnaire à remplir',
    'Ton coach t''a envoyé un questionnaire de surentraînement 📝',
    '/sportif/questionnaire-surentrainement',
    'sfms_request'
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_on_sfms_request on public.sfms_questionnaire_requests;
create trigger trg_notify_on_sfms_request
  after insert on public.sfms_questionnaire_requests
  for each row execute function public.notify_on_sfms_request();

-- ── 2. Questionnaire terminé → coach(s) ──
create or replace function public.notify_on_sfms_result()
returns trigger
language plpgsql
security definer
as $$
declare
  athlete_name text;
begin
  select coalesce(nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'Un athlète')
    into athlete_name
  from public.user_profiles
  where id = NEW.athlete_id;

  insert into public.notification_queue (user_id, title, body, url, type)
  select
    car.coach_id,
    'Questionnaire terminé',
    athlete_name || ' a terminé son questionnaire (score ' || NEW.total_score || '/54)',
    '/coach/client/' || NEW.athlete_id,
    'sfms_result'
  from public.coach_athlete_relationships car
  where car.athlete_id = NEW.athlete_id
    and car.status = 'approved'
    and exists (select 1 from public.notification_preferences np where np.user_id = car.coach_id and np.enabled = true)
    and exists (select 1 from public.notification_rules r where r.user_id = car.coach_id and r.type = 'sfms_result' and r.enabled = true);
  return NEW;
end;
$$;

drop trigger if exists trg_notify_on_sfms_result on public.sfms_questionnaire_results;
create trigger trg_notify_on_sfms_result
  after insert on public.sfms_questionnaire_results
  for each row execute function public.notify_on_sfms_result();
