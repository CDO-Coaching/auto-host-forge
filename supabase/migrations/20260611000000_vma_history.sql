-- Historique des VMA (manuelles vs issues du calibrage) pour le graphe d'évolution
create table if not exists public.vma_history (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null,
  vma numeric not null,
  source text not null,                 -- 'manual' | 'calibration'
  recorded_at timestamptz not null default now(),
  created_by uuid
);

alter table public.vma_history enable row level security;

-- Accès via fonctions SECURITY DEFINER uniquement (pas de policy directe).

-- Enregistre une valeur de VMA dans l'historique
create or replace function public.log_vma_history(
  p_athlete_id uuid,
  p_vma numeric,
  p_source text
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.vma_history (athlete_id, vma, source, created_by)
  values (p_athlete_id, p_vma, coalesce(p_source, 'manual'), auth.uid());
end;
$$;

-- Renvoie l'historique d'un athlète (trié par date croissante)
create or replace function public.get_vma_history(p_athlete_id uuid)
returns table (vma numeric, source text, recorded_at timestamptz)
language sql
security definer
stable
as $$
  select vma, source, recorded_at
  from public.vma_history
  where athlete_id = p_athlete_id
  order by recorded_at asc;
$$;

grant execute on function public.log_vma_history(uuid, numeric, text) to authenticated;
grant execute on function public.get_vma_history(uuid) to authenticated;
revoke execute on function public.log_vma_history(uuid, numeric, text) from anon;
revoke execute on function public.get_vma_history(uuid) from anon;
