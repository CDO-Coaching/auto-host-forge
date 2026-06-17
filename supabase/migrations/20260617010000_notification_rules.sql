-- Règles de notification par type, avec jours de la semaine + heure.
-- notification_preferences garde le rôle de "master switch" + fuseau + abonnement.
-- Une règle = un type de rappel configurable (jours + heure).

create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,                              -- 'hooper' | 'weight' | 'programmation' | 'paiements' | ...
  enabled boolean not null default true,
  days int[] not null default '{0,1,2,3,4,5,6}',   -- jours (dow Postgres : 0=dimanche .. 6=samedi)
  reminder_time time not null default '19:00',
  updated_at timestamptz not null default now(),
  unique (user_id, type)
);
create index if not exists notification_rules_user_idx on public.notification_rules(user_id);

alter table public.notification_rules enable row level security;

drop policy if exists notification_rules_select_own on public.notification_rules;
create policy notification_rules_select_own on public.notification_rules
  for select using (auth.uid() = user_id);
drop policy if exists notification_rules_insert_own on public.notification_rules;
create policy notification_rules_insert_own on public.notification_rules
  for insert with check (auth.uid() = user_id);
drop policy if exists notification_rules_update_own on public.notification_rules;
create policy notification_rules_update_own on public.notification_rules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists notification_rules_delete_own on public.notification_rules;
create policy notification_rules_delete_own on public.notification_rules
  for delete using (auth.uid() = user_id);

-- ───────── Alimente la file selon les règles (appelé par n8n chaque minute) ─────────
create or replace function public.enqueue_due_reminders()
returns void
language plpgsql
security definer
as $$
declare
  r record;
  tz text;
  d date;
  dow int;
  t time;
begin
  for r in
    select nr.user_id, nr.type, nr.days, nr.reminder_time, np.timezone
    from public.notification_rules nr
    join public.notification_preferences np on np.user_id = nr.user_id
    where nr.enabled = true and np.enabled = true
  loop
    tz  := coalesce(r.timezone, 'Europe/Paris');
    d   := (now() at time zone tz)::date;
    dow := extract(dow from (now() at time zone tz))::int;
    t   := (now() at time zone tz)::time;

    -- jour programmé ? heure atteinte ?
    if not (dow = any(r.days)) then continue; end if;
    if t < r.reminder_time then continue; end if;

    -- déjà mis en file aujourd'hui pour ce type ? (anti-doublon)
    if exists (
      select 1 from public.notification_queue q
      where q.user_id = r.user_id and q.type = r.type
        and (q.created_at at time zone tz)::date = d
    ) then continue; end if;

    -- conditions + contenu par type
    if r.type = 'hooper' then
      if exists (select 1 from public.daily_fatigue_log f where f.user_id = r.user_id and f.date = d) then continue; end if;
      insert into public.notification_queue (user_id, title, body, url, type)
      values (r.user_id, 'Questionnaire du jour', 'Pense à remplir ton questionnaire de forme 💪', '/sportif/fatigue', 'hooper');

    elsif r.type = 'weight' then
      if exists (select 1 from public.weight_tracking w where w.user_id = r.user_id and (w.recorded_at at time zone tz)::date = d) then continue; end if;
      insert into public.notification_queue (user_id, title, body, url, type)
      values (r.user_id, 'Pesée du jour', 'Pense à te peser 📊', '/sportif/poids', 'weight');

    elsif r.type = 'programmation' then
      insert into public.notification_queue (user_id, title, body, url, type)
      values (r.user_id, 'Programmation', 'Pense à programmer les semaines de tes athlètes 📅', '/coach/mes-clients', 'programmation');

    elsif r.type = 'paiements' then
      insert into public.notification_queue (user_id, title, body, url, type)
      values (r.user_id, 'Paiements', 'Vérifie les paiements et impayés 💶', '/coach/comptabilite', 'paiements');
    end if;
  end loop;
end;
$$;

revoke execute on function public.enqueue_due_reminders() from anon, authenticated;
grant execute on function public.enqueue_due_reminders() to service_role;
