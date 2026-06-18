-- Notifications push pour l'administrateur :
--   - nouvelle demande d'accès (inscription en attente)
--   - nouvelle demande de contact
-- Envoyées au compte admin s'il a activé les notifications et possède un appareil.

-- ── Nouvelle demande d'accès ──
create or replace function public.notify_admin_new_access_request()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare admin_id uuid; nm text;
begin
  if NEW.access_status is distinct from 'pending' then return NEW; end if;
  select id into admin_id from auth.users where email = 'cdo.personaltrainer@gmail.com';
  if admin_id is null or admin_id = NEW.id then return NEW; end if;
  if not exists (select 1 from public.notification_preferences np where np.user_id = admin_id and np.enabled = true) then return NEW; end if;
  if not exists (select 1 from public.push_subscriptions s where s.user_id = admin_id) then return NEW; end if;

  nm := coalesce(nullif(trim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, '')), ''), coalesce(NEW.email, 'Quelqu''un'));
  insert into public.notification_queue (user_id, title, body, url, type)
  values (admin_id, 'Nouvelle demande d''accès', nm || ' souhaite accéder à l''application', '/coach/admin', 'admin_access');
  return NEW;
end;
$$;

drop trigger if exists trg_notify_admin_new_access on public.user_profiles;
create trigger trg_notify_admin_new_access
  after insert on public.user_profiles
  for each row execute function public.notify_admin_new_access_request();

-- ── Nouvelle demande de contact ──
create or replace function public.notify_admin_new_contact()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare admin_id uuid; nm text; preview text;
begin
  select id into admin_id from auth.users where email = 'cdo.personaltrainer@gmail.com';
  if admin_id is null then return NEW; end if;
  if not exists (select 1 from public.notification_preferences np where np.user_id = admin_id and np.enabled = true) then return NEW; end if;
  if not exists (select 1 from public.push_subscriptions s where s.user_id = admin_id) then return NEW; end if;

  nm := coalesce(nullif(trim(coalesce(NEW."prénom", '') || ' ' || coalesce(NEW.nom, '')), ''), 'Quelqu''un');
  preview := left(coalesce(NEW.message, ''), 80);
  insert into public.notification_queue (user_id, title, body, url, type)
  values (
    admin_id,
    'Nouvelle demande de contact',
    case when preview = '' then nm else nm || ' : ' || preview end,
    '/coach/admin',
    'admin_contact'
  );
  return NEW;
end;
$$;

drop trigger if exists trg_notify_admin_new_contact on public.prise_de_contact;
create trigger trg_notify_admin_new_contact
  after insert on public.prise_de_contact
  for each row execute function public.notify_admin_new_contact();
