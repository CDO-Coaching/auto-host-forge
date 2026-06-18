-- Sécurise tous les triggers de notification : une notification ne doit JAMAIS
-- empêcher l'écriture principale (inscription, message, contact, questionnaire).
-- Chaque corps est enveloppé dans un bloc EXCEPTION qui avale toute erreur.

-- garantir la colonne (idempotent, au cas où elle n'aurait pas été créée)
alter table public.user_profiles add column if not exists access_status text not null default 'pending';

-- ── Admin : nouvelle demande d'accès (à l'inscription) ──
create or replace function public.notify_admin_new_access_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare admin_id uuid; nm text;
begin
  begin
    if NEW.access_status is distinct from 'pending' then return NEW; end if;
    select id into admin_id from auth.users where email = 'cdo.personaltrainer@gmail.com';
    if admin_id is null or admin_id = NEW.id then return NEW; end if;
    if not exists (select 1 from public.notification_preferences np where np.user_id = admin_id and np.enabled = true) then return NEW; end if;
    if not exists (select 1 from public.push_subscriptions s where s.user_id = admin_id) then return NEW; end if;
    nm := coalesce(nullif(trim(coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,'')), ''), coalesce(NEW.email,'Quelqu''un'));
    insert into public.notification_queue (user_id, title, body, url, type)
    values (admin_id, 'Nouvelle demande d''accès', nm || ' souhaite accéder à l''application', '/coach/admin', 'admin_access');
  exception when others then return NEW;
  end;
  return NEW;
end; $$;

-- ── Admin : nouvelle demande de contact ──
create or replace function public.notify_admin_new_contact()
returns trigger language plpgsql security definer set search_path = public as $$
declare admin_id uuid; nm text; preview text;
begin
  begin
    select id into admin_id from auth.users where email = 'cdo.personaltrainer@gmail.com';
    if admin_id is null then return NEW; end if;
    if not exists (select 1 from public.notification_preferences np where np.user_id = admin_id and np.enabled = true) then return NEW; end if;
    if not exists (select 1 from public.push_subscriptions s where s.user_id = admin_id) then return NEW; end if;
    nm := coalesce(nullif(trim(coalesce(NEW."prénom",'') || ' ' || coalesce(NEW.nom,'')), ''), 'Quelqu''un');
    preview := left(coalesce(NEW.message,''), 80);
    insert into public.notification_queue (user_id, title, body, url, type)
    values (admin_id, 'Nouvelle demande de contact', case when preview = '' then nm else nm || ' : ' || preview end, '/coach/admin', 'admin_contact');
  exception when others then return NEW;
  end;
  return NEW;
end; $$;

-- ── Messages ──
create or replace function public.notify_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare sender_name text; is_coach boolean; target_url text; preview text; body_text text;
begin
  begin
    if NEW.sender_id = NEW.receiver_id then return NEW; end if;
    if not exists (select 1 from public.notification_preferences np where np.user_id = NEW.receiver_id and np.enabled = true) then return NEW; end if;
    if not exists (select 1 from public.notification_rules r where r.user_id = NEW.receiver_id and r.type = 'message' and r.enabled = true) then return NEW; end if;
    select coalesce(nullif(trim(coalesce(up.first_name,'') || ' ' || coalesce(up.last_name,'')), ''), 'Quelqu''un') into sender_name
      from public.user_profiles up where up.id = NEW.sender_id;
    is_coach := exists (select 1 from public.coach_athlete_relationships car where car.coach_id = NEW.receiver_id);
    target_url := case when is_coach then '/coach/messagerie?u=' || NEW.sender_id else '/sportif/messagerie' end;
    preview := left(coalesce(NEW.content,''), 80);
    body_text := case when preview = '' then coalesce(sender_name,'Quelqu''un') || ' vous a envoyé un message' else sender_name || ' : ' || preview end;
    insert into public.notification_queue (user_id, title, body, url, type)
    values (NEW.receiver_id, 'Nouveau message', body_text, target_url, 'message');
  exception when others then return NEW;
  end;
  return NEW;
end; $$;

-- ── SFMS : demande envoyée ──
create or replace function public.notify_on_sfms_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if NEW.status is distinct from 'pending' then return NEW; end if;
    if not exists (select 1 from public.notification_preferences np where np.user_id = NEW.athlete_id and np.enabled = true) then return NEW; end if;
    if not exists (select 1 from public.notification_rules r where r.user_id = NEW.athlete_id and r.type = 'sfms_request' and r.enabled = true) then return NEW; end if;
    insert into public.notification_queue (user_id, title, body, url, type)
    values (NEW.athlete_id, 'Questionnaire à remplir', 'Ton coach t''a envoyé un questionnaire de surentraînement 📝', '/sportif/questionnaire-surentrainement', 'sfms_request');
  exception when others then return NEW;
  end;
  return NEW;
end; $$;

-- ── SFMS : questionnaire terminé ──
create or replace function public.notify_on_sfms_result()
returns trigger language plpgsql security definer set search_path = public as $$
declare athlete_name text;
begin
  begin
    select coalesce(nullif(trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')), ''), 'Un athlète') into athlete_name
      from public.user_profiles where id = NEW.athlete_id;
    insert into public.notification_queue (user_id, title, body, url, type)
    select car.coach_id, 'Questionnaire terminé',
           athlete_name || ' a terminé son questionnaire (score ' || NEW.total_score || '/54)',
           '/coach/client/' || NEW.athlete_id, 'sfms_result'
    from public.coach_athlete_relationships car
    where car.athlete_id = NEW.athlete_id and car.status = 'approved'
      and exists (select 1 from public.notification_preferences np where np.user_id = car.coach_id and np.enabled = true)
      and exists (select 1 from public.notification_rules r where r.user_id = car.coach_id and r.type = 'sfms_result' and r.enabled = true);
  exception when others then return NEW;
  end;
  return NEW;
end; $$;
