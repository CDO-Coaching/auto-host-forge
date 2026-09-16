-- Rendre la comptabilité permanente : elle doit survivre à la suppression d'un compte.
-- 1) Snapshot du nom / adresse / téléphone du client dans chaque ligne de compta.
-- 2) Backfill des lignes existantes depuis les profils.
-- 3) Garde-fou : le lien vers le compte passe en ON DELETE SET NULL (jamais CASCADE),
--    donc supprimer un compte ne supprime plus ses lignes de compta.

-- 1) Colonnes snapshot
alter table public.accounting_entries add column if not exists client_name_snapshot   text;
alter table public.accounting_entries add column if not exists client_address_snapshot text;
alter table public.accounting_entries add column if not exists client_phone_snapshot   text;

-- 2) Backfill (nom depuis le profil ; adresse/téléphone depuis la relation coach-athlète si présents)
update public.accounting_entries e
set client_name_snapshot = nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '')
from public.user_profiles p
where e.client_id = p.id
  and (e.client_name_snapshot is null or e.client_name_snapshot = '');

update public.accounting_entries e
set client_address_snapshot = coalesce(e.client_address_snapshot, r.client_address),
    client_phone_snapshot   = coalesce(e.client_phone_snapshot,   r.client_phone)
from public.coach_athlete_relationships r
where e.client_id = r.athlete_id
  and (e.client_address_snapshot is null or e.client_phone_snapshot is null);

-- 3) Garde-fou ON DELETE SET NULL sur le lien client interne
alter table public.accounting_entries drop constraint if exists accounting_entries_client_id_fkey;
alter table public.accounting_entries
  add constraint accounting_entries_client_id_fkey
  foreign key (client_id) references public.user_profiles(id) on delete set null;

-- (Idem pour le lien client externe, si la contrainte existe sous ce nom)
alter table public.accounting_entries drop constraint if exists accounting_entries_external_client_id_fkey;
alter table public.accounting_entries
  add constraint accounting_entries_external_client_id_fkey
  foreign key (external_client_id) references public.external_clients(id) on delete set null;
