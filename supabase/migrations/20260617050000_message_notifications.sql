-- Notifications de messages : à chaque nouveau message, on met une notif en file
-- pour le destinataire, s'il a activé les notifications ET le type 'message'.
-- Type événementiel (instantané) : pas de jour/heure, géré par trigger (pas par enqueue).

create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
as $$
declare
  sender_name text;
  is_coach boolean;
  target_url text;
  preview text;
  body_text text;
begin
  if NEW.sender_id = NEW.receiver_id then
    return NEW;
  end if;

  -- destinataire : notifications globales activées ?
  if not exists (
    select 1 from public.notification_preferences np
    where np.user_id = NEW.receiver_id and np.enabled = true
  ) then return NEW; end if;

  -- destinataire : type 'message' activé ?
  if not exists (
    select 1 from public.notification_rules r
    where r.user_id = NEW.receiver_id and r.type = 'message' and r.enabled = true
  ) then return NEW; end if;

  select coalesce(nullif(trim(coalesce(up.first_name, '') || ' ' || coalesce(up.last_name, '')), ''), 'Quelqu''un')
    into sender_name
  from public.user_profiles up
  where up.id = NEW.sender_id;

  -- rôle du destinataire → bonne page de messagerie
  is_coach := exists (select 1 from public.coach_athlete_relationships car where car.coach_id = NEW.receiver_id);
  -- côté coach : on cible la conversation de l'expéditeur ; côté athlète : un seul coach
  target_url := case when is_coach then '/coach/messagerie?u=' || NEW.sender_id else '/sportif/messagerie' end;

  preview := left(coalesce(NEW.content, ''), 80);
  body_text := case
    when preview = '' then coalesce(sender_name, 'Quelqu''un') || ' vous a envoyé un message'
    else sender_name || ' : ' || preview
  end;

  insert into public.notification_queue (user_id, title, body, url, type)
  values (NEW.receiver_id, 'Nouveau message', body_text, target_url, 'message');

  return NEW;
end;
$$;

drop trigger if exists trg_notify_on_message on public.messages;
create trigger trg_notify_on_message
  after insert on public.messages
  for each row execute function public.notify_on_message();
