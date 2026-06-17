-- File d'attente des notifications (outbox) : chaque ligne = une notif à envoyer
-- avec son propre texte et son lien. Les événements (nouvelle semaine, message…)
-- insèrent une ligne ; les rappels conditionnels (Hooper, pesée…) aussi.
-- n8n vide la file (chiffre le payload + envoie).

create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  url text not null default '/',
  type text not null,                  -- 'hooper' | 'weight' | 'session' | 'new_week' | 'coach_reply' | 'athlete_message'
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists notification_queue_pending_idx
  on public.notification_queue (created_at) where sent_at is null;

alter table public.notification_queue enable row level security;
-- Pas de policy : alimentée via RPC SECURITY DEFINER / service_role uniquement.

-- ───────── Vidage de la file (appelé par n8n) ─────────
-- Marque les notifs non envoyées comme envoyées et renvoie de quoi les pousser.
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
    returning q.id, q.user_id, q.title, q.body, q.url
  )
  select c.id, s.endpoint, s.p256dh, s.auth, c.title, c.body, c.url
  from claimed c
  join public.push_subscriptions s on s.user_id = c.user_id;
end;
$$;

revoke execute on function public.claim_pending_notifications() from anon, authenticated;
grant execute on function public.claim_pending_notifications() to service_role;

-- ───────── Rappels conditionnels → insertion dans la file (appelé par n8n) ─────────
-- À l'heure choisie (une fois/jour, garde-fou last_sent_at), on insère un rappel
-- PAR TYPE activé dans p.types, si la condition correspondante est encore non remplie.
--   types.hooper (défaut true)  : questionnaire de forme non rempli aujourd'hui
--   types.weight (défaut false) : pas de pesée enregistrée aujourd'hui
create or replace function public.enqueue_due_reminders()
returns void
language plpgsql
security definer
as $$
begin
  with due as (
    update public.notification_preferences p
    set last_sent_at = now()
    where p.enabled = true
      and (now() at time zone p.timezone)::time >= p.reminder_time
      and (
        p.last_sent_at is null
        or (p.last_sent_at at time zone p.timezone)::date < (now() at time zone p.timezone)::date
      )
    returning p.user_id, p.timezone, p.types
  )
  insert into public.notification_queue (user_id, title, body, url, type)
  -- Questionnaire de forme (Hooper)
  select d.user_id,
         'Questionnaire du jour',
         'Pense à remplir ton questionnaire de forme 💪',
         '/sportif/fatigue',
         'hooper'
  from due d
  where coalesce((d.types->>'hooper')::boolean, true)
    and not exists (
      select 1 from public.daily_fatigue_log f
      where f.user_id = d.user_id
        and f.date = (now() at time zone d.timezone)::date
    )
  union all
  -- Pesée
  select d.user_id,
         'Pesée du jour',
         'Pense à te peser 📊',
         '/sportif/poids',
         'weight'
  from due d
  where coalesce((d.types->>'weight')::boolean, false)
    and not exists (
      select 1 from public.weight_tracking w
      where w.user_id = d.user_id
        and (w.recorded_at at time zone d.timezone)::date = (now() at time zone d.timezone)::date
    );
end;
$$;

revoke execute on function public.enqueue_due_reminders() from anon, authenticated;
grant execute on function public.enqueue_due_reminders() to service_role;
