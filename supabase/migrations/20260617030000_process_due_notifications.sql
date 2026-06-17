-- RPC combinée appelée par n8n (un seul appel) :
-- 1) insère les rappels dus (enqueue_due_reminders)
-- 2) renvoie + marque envoyées les notifs en attente (claim_pending_notifications)
-- Simplifie le workflow n8n à un unique nœud HTTP Request.
create or replace function public.process_due_notifications()
returns table (id uuid, endpoint text, p256dh text, auth text, title text, body text, url text)
language plpgsql
security definer
as $$
begin
  perform public.enqueue_due_reminders();
  return query select * from public.claim_pending_notifications();
end;
$$;

revoke execute on function public.process_due_notifications() from anon, authenticated;
grant execute on function public.process_due_notifications() to service_role;
