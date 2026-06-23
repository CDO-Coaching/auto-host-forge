-- FTP (Functional Threshold Power, en watts) — équivalent vélo de la VMA.
alter table public.user_profiles add column if not exists ftp integer default null;
alter table public.user_profiles add column if not exists ftp_updated_at timestamptz default null;

-- Étend la RPC physio pour enregistrer aussi la FTP (nouvelle signature à 6 args).
drop function if exists update_athlete_physio(uuid, numeric, integer, integer, text);

create or replace function update_athlete_physio(
  p_athlete_id uuid,
  p_vma numeric default null,
  p_fc_max integer default null,
  p_fc_repos integer default null,
  p_running_level text default null,
  p_ftp integer default null
)
returns void
language plpgsql
security definer
as $$
begin
  update user_profiles
  set
    vma                 = coalesce(p_vma, vma),
    fc_max              = coalesce(p_fc_max, fc_max),
    fc_repos            = coalesce(p_fc_repos, fc_repos),
    running_level       = coalesce(p_running_level, running_level),
    ftp                 = coalesce(p_ftp, ftp),
    fc_max_updated_at   = case when p_fc_max  is not null then now() else fc_max_updated_at  end,
    fc_repos_updated_at = case when p_fc_repos is not null then now() else fc_repos_updated_at end,
    ftp_updated_at      = case when p_ftp is not null then now() else ftp_updated_at end
  where id = p_athlete_id;
end;
$$;

grant execute on function update_athlete_physio(uuid, numeric, integer, integer, text, integer) to authenticated;
revoke execute on function update_athlete_physio(uuid, numeric, integer, integer, text, integer) from anon;
