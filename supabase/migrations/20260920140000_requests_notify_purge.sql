-- Demandes athlète : notification au sportif quand sa demande est traitée,
-- + purge des demandes traitées de plus d'une semaine.

-- 1) Notifier l'athlète au passage open → done
create or replace function public.notify_athlete_request_done()
returns trigger
language plpgsql
security definer
as $$
begin
  if OLD.status = 'open' and NEW.status = 'done' then
    -- athlète : notifications globales activées ?
    if exists (select 1 from public.notification_preferences np
               where np.user_id = NEW.athlete_id and np.enabled = true) then
      insert into public.notification_queue (user_id, title, body, url, type)
      values (
        NEW.athlete_id,
        'Demande traitée ✅',
        'Ton coach a traité ta demande : ' || left(coalesce(NEW.content,''), 80),
        '/sportif/messagerie',
        'message'
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_athlete_request_done on public.athlete_requests;
create trigger trg_notify_athlete_request_done
  after update on public.athlete_requests
  for each row execute function public.notify_athlete_request_done();

-- 2) Purge : supprime les demandes traitées il y a plus de 7 jours.
--    Appelable par le coach (best-effort) ; SECURITY DEFINER pour contourner la RLS
--    tout en ne supprimant que ses propres demandes traitées et anciennes.
create or replace function public.purge_old_done_requests()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.athlete_requests
  where status = 'done'
    and resolved_at is not null
    and resolved_at < now() - interval '7 days'
    and coach_id = auth.uid();
end;
$$;

grant execute on function public.purge_old_done_requests() to authenticated;
