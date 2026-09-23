-- Rappel de validation de séance : quand l'athlète confirme qu'il commence sa
-- séance, on programme un rappel push différé (durée estimée + marge). Le rappel
-- est annulé si la séance est validée avant l'échéance.

-- 1) File : livraison différée + clé de déduplication/annulation
alter table public.notification_queue
  add column if not exists deliver_after timestamptz,
  add column if not exists dedupe_ref text;

-- 2) La récupération ne sort que les notifs dues (deliver_after nul ou passé)
create or replace function public.claim_pending_notifications()
returns table (id uuid, endpoint text, p256dh text, auth text, title text, body text, url text)
language plpgsql
security definer
as $$
begin
  return query
  with claimed as (
    update public.notification_queue q
    set sent_at = now()
    where q.sent_at is null
      and (q.deliver_after is null or q.deliver_after <= now())
      and exists (select 1 from public.push_subscriptions s where s.user_id = q.user_id)
    returning q.id, q.user_id, q.title, q.body, q.url
  )
  select c.id, s.endpoint, s.p256dh, s.auth, c.title, c.body, c.url
  from claimed c
  join public.push_subscriptions s on s.user_id = c.user_id;
end;
$$;
revoke execute on function public.claim_pending_notifications() from anon, authenticated;
grant execute on function public.claim_pending_notifications() to service_role;

-- 3) Programmer un rappel de validation pour SOI-MÊME
create or replace function public.schedule_validation_reminder(
  p_session_id uuid,
  p_session_name text,
  p_delay_minutes integer,
  p_url text default '/sportif/seances'
)
returns void
language plpgsql
security definer
as $$
declare
  v_ref text := 'validate:' || p_session_id::text;
  v_delay integer := greatest(5, least(coalesce(p_delay_minutes, 60), 240)); -- 5 min..4 h
begin
  -- notifications globales activées ?
  if not exists (select 1 from public.notification_preferences np
                 where np.user_id = auth.uid() and np.enabled = true) then
    return;
  end if;
  -- on ne double pas un rappel déjà en attente pour cette séance
  delete from public.notification_queue
    where user_id = auth.uid() and dedupe_ref = v_ref and sent_at is null;

  insert into public.notification_queue (user_id, title, body, url, type, deliver_after, dedupe_ref)
  values (
    auth.uid(),
    'Pense à valider ta séance ✅',
    'Ta séance « ' || coalesce(p_session_name, 'du jour') || ' » est-elle terminée ? Valide-la pour l''enregistrer 💪',
    p_url,
    'session',
    now() + make_interval(mins => v_delay),
    v_ref
  );
end;
$$;
grant execute on function public.schedule_validation_reminder(uuid, text, integer, text) to authenticated;

-- 4) Annuler le rappel (séance validée avant l'échéance)
create or replace function public.cancel_validation_reminder(p_session_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  delete from public.notification_queue
    where user_id = auth.uid()
      and dedupe_ref = 'validate:' || p_session_id::text
      and sent_at is null;
end;
$$;
grant execute on function public.cancel_validation_reminder(uuid) to authenticated;
