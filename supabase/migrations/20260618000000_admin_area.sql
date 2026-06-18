-- Espace d'administration réservé au compte coach principal.
-- Toutes les fonctions vérifient l'email de l'appelant côté serveur.
-- (RLS reste en place ; ces RPC SECURITY DEFINER sont le seul point d'accès admin.)

-- Marqueur "traité" pour les demandes de contact
alter table public.prise_de_contact add column if not exists traite boolean not null default false;

-- Statut d'accès pour distinguer une NOUVELLE demande d'un accès révoqué.
-- 'pending' = nouvelle inscription à traiter | 'approved' = accès accordé | 'revoked' = accès coupé (compte conservé)
alter table public.user_profiles add column if not exists access_status text not null default 'pending';
-- Backfill : les comptes déjà approuvés -> 'approved' ; les autres existants -> 'revoked'
-- (ils n'apparaîtront donc PAS comme nouvelles demandes). Les futures inscriptions
-- prendront le défaut 'pending'.
update public.user_profiles
  set access_status = case when coalesce(approved, false) then 'approved' else 'revoked' end
  where access_status = 'pending';

-- Email de l'administrateur autorisé
-- (si tu changes d'adresse, remplace-la dans CHAQUE fonction ci-dessous)

-- Garde-fou réutilisable
create or replace function public.is_app_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select (select u.email from auth.users u where u.id = auth.uid()) = 'cdo.personaltrainer@gmail.com';
$$;

-- ── Demandes d'accès (comptes non approuvés) ──
create or replace function public.admin_list_pending_users()
returns table (id uuid, first_name text, last_name text, email text, role text, created_at text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'not authorized'; end if;
  return query
  select p.id, p.first_name, p.last_name, p.email, p.role, p.created_at::text
  from public.user_profiles p
  where p.access_status = 'pending'
  order by p.created_at desc;
end; $$;

create or replace function public.admin_approve_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'not authorized'; end if;
  update public.user_profiles set approved = true, access_status = 'approved' where id = p_user_id;
end; $$;

-- "Refuser" = couper l'accès SANS supprimer le compte
create or replace function public.admin_refuse_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'not authorized'; end if;
  update public.user_profiles set approved = false, access_status = 'revoked' where id = p_user_id;
end; $$;

-- ── Demandes de contact ──
create or replace function public.admin_list_contacts()
returns table (id text, prenom text, nom text, email text, telephone text, message text, mode_de_contact text, traite boolean, created_at text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'not authorized'; end if;
  return query
  select c.id::text, c."prénom", c.nom, c.email, c.telephone, c.message, c.mode_de_contact, c.traite, c.created_at::text
  from public.prise_de_contact c
  order by c.created_at desc;
end; $$;

create or replace function public.admin_mark_contact(p_id text, p_traite boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'not authorized'; end if;
  update public.prise_de_contact set traite = p_traite where id::text = p_id;
end; $$;

grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.admin_list_pending_users() to authenticated;
grant execute on function public.admin_approve_user(uuid) to authenticated;
grant execute on function public.admin_refuse_user(uuid) to authenticated;
grant execute on function public.admin_list_contacts() to authenticated;
grant execute on function public.admin_mark_contact(text, boolean) to authenticated;
