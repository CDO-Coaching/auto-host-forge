-- Compteur pour le badge du menu Administration :
-- demandes d'accès en attente + demandes de contact non traitées.
create or replace function public.admin_pending_count()
returns integer
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if not public.is_app_admin() then return 0; end if;
  select (select count(*) from public.user_profiles where access_status = 'pending')
       + (select count(*) from public.prise_de_contact where coalesce(traite, false) = false)
  into n;
  return coalesce(n, 0);
end; $$;

grant execute on function public.admin_pending_count() to authenticated;
