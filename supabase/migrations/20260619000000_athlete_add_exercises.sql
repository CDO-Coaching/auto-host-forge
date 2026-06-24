-- Autorisation (par athlète, persistante) : le sportif peut ajouter des exercices
-- réalisés dans ses séances. Coché/décoché par le coach ; reste actif tant que
-- le coach ne le décoche pas.
alter table public.user_profiles add column if not exists allow_athlete_add_exercises boolean not null default false;

-- Marque les exercices ajoutés par le sportif (pour distinction côté coach)
alter table public.session_exercises add column if not exists added_by_athlete boolean not null default false;

-- Le coach (de l'athlète) active/désactive l'autorisation
create or replace function public.set_athlete_can_add_exercises(p_athlete_id uuid, p_allowed boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.coach_athlete_relationships car
    where car.coach_id = auth.uid() and car.athlete_id = p_athlete_id and car.status = 'approved'
  ) then raise exception 'not authorized'; end if;
  update public.user_profiles set allow_athlete_add_exercises = p_allowed where id = p_athlete_id;
end; $$;

-- Le sportif ajoute un exercice réalisé dans une de SES séances (si autorisé)
create or replace function public.athlete_add_exercise(
  p_session_id uuid,
  p_exercice text,
  p_series text default null,
  p_reps text default null,
  p_charge text default null,
  p_rpe text default null,
  p_commentaire text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare v_athlete uuid; v_allowed boolean; v_order int;
begin
  select tw.athlete_id into v_athlete
  from public.training_sessions ts
  join public.training_weeks tw on tw.id = ts.week_id
  where ts.id = p_session_id;

  if v_athlete is null or v_athlete <> auth.uid() then raise exception 'not authorized'; end if;

  select coalesce(allow_athlete_add_exercises, false) into v_allowed from public.user_profiles where id = auth.uid();
  if not v_allowed then raise exception 'not allowed'; end if;

  select coalesce(max(exercise_order), 0) + 1 into v_order from public.session_exercises where session_id = p_session_id;

  insert into public.session_exercises (session_id, exercise_order, exercice, series, reps, charge, rpe, commentaire, added_by_athlete)
  values (p_session_id, v_order, p_exercice, p_series, p_reps, p_charge, p_rpe, p_commentaire, true);
end; $$;

grant execute on function public.set_athlete_can_add_exercises(uuid, boolean) to authenticated;
grant execute on function public.athlete_add_exercise(uuid, text, text, text, text, text, text) to authenticated;
