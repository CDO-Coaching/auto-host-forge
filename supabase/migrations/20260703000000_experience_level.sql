-- Niveau d'expérience de l'athlète (adapte les consignes des tests de la carte coureur)
alter table public.user_profiles add column if not exists experience_level text;

create or replace function public.set_athlete_experience_level(p_athlete_id uuid, p_level text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_level not in ('debutant','novice','amateur','experimente','semipro','pro') then
    raise exception 'Niveau invalide';
  end if;
  if p_athlete_id <> auth.uid() and not exists (
    select 1 from public.coach_athlete_relationships r
    where r.athlete_id = p_athlete_id
      and r.coach_id = auth.uid()
      and r.status = 'approved'
  ) then
    raise exception 'Accès refusé';
  end if;
  update public.user_profiles set experience_level = p_level where id = p_athlete_id;
end;
$$;

grant execute on function public.set_athlete_experience_level(uuid, text) to authenticated;
notify pgrst, 'reload schema';
