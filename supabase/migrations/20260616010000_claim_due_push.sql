-- RPC appelée par n8n : sélectionne les utilisateurs "dûs" pour un rappel,
-- les marque comme envoyés (anti-doublon) et renvoie leurs abonnements push.
-- Tout est atomique (UPDATE ... RETURNING) → pas de course entre lecture et marquage.
--
-- "Dû" = notifications activées, l'heure locale a atteint l'heure de rappel,
-- et aucun envoi n'a déjà eu lieu aujourd'hui (dans le fuseau de l'utilisateur).

create or replace function public.claim_due_push_subscriptions()
returns table (endpoint text, p256dh text, auth text, user_id uuid)
language plpgsql
security definer
as $$
begin
  return query
  with due as (
    update public.notification_preferences p
    set last_sent_at = now()
    where p.enabled = true
      and (now() at time zone p.timezone)::time >= p.reminder_time
      and (
        p.last_sent_at is null
        or (p.last_sent_at at time zone p.timezone)::date < (now() at time zone p.timezone)::date
      )
      -- Pas de rappel si le questionnaire du jour est déjà rempli.
      and not exists (
        select 1 from public.daily_fatigue_log f
        where f.user_id = p.user_id
          and f.date = (now() at time zone p.timezone)::date
      )
    returning p.user_id
  )
  select s.endpoint, s.p256dh, s.auth, s.user_id
  from due d
  join public.push_subscriptions s on s.user_id = d.user_id;
end;
$$;

-- Seul le service_role (clé serveur utilisée par n8n) peut déclencher l'envoi.
revoke execute on function public.claim_due_push_subscriptions() from anon, authenticated;
grant execute on function public.claim_due_push_subscriptions() to service_role;
