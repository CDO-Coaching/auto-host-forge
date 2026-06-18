-- Quand l'admin approuve un accès, on confirme aussi l'email du compte
-- (sinon GoTrue refuse la connexion avec "Email not confirmed").
create or replace function public.admin_approve_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'not authorized'; end if;
  update public.user_profiles set approved = true, access_status = 'approved' where id = p_user_id;
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = p_user_id;
end; $$;
