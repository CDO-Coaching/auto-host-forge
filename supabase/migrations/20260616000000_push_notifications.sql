-- Notifications push (Web Push / VAPID)
-- Deux tables isolées : abonnements par appareil + préférences par utilisateur.

-- ───────────────────────── Abonnements push (un par appareil) ─────────────────────────
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,         -- identifiant unique de l'abonnement navigateur
  p256dh text not null,                  -- clé publique du client (chiffrement payload)
  auth text not null,                    -- secret d'authentification du client
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- L'utilisateur ne gère que ses propres abonnements.
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- ───────────────────────── Préférences de notification (une par utilisateur) ─────────────────────────
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  reminder_time time not null default '19:00',     -- heure locale choisie
  timezone text not null default 'Europe/Paris',   -- fuseau de l'utilisateur
  types jsonb not null default '{"daily":true}'::jsonb, -- extensible (hooper, séance, ...)
  last_sent_at timestamptz,                          -- anti-doublon pour l'envoyeur
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences
  for select using (auth.uid() = user_id);

drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own on public.notification_preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
