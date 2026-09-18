-- Module « Prépa mentale » (vue coach) : bilans mentaux d'un athlète dans le temps.
-- Un bilan = un point dans le temps (le plus ancien = bilan initial).
-- 100 % côté coach : l'athlète n'y a AUCUN accès.

create table if not exists public.mental_assessments (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.user_profiles(id) on delete cascade,
  coach_id uuid not null default auth.uid(),
  assessment_date date not null default current_date,

  -- 4 questions ouvertes (mots du client)
  q_quete text,            -- ce qu'il vient vraiment chercher, au-delà du physique
  q_charge_lourde text,    -- sa tête face à une charge lourde / un exo qui fait peur
  q_echec text,            -- son discours interne quand il rate / régresse
  q_concentration text,    -- sa concentration (présent vs tête ailleurs)
  q_influence text,        -- comment le sport influence son moral / son énergie en ce moment

  -- 3 notes 1..10
  score_confiance integer check (score_confiance between 1 and 10),
  score_gestion_peur integer check (score_gestion_peur between 1 and 10),
  score_regularite integer check (score_regularite between 1 and 10),

  -- synthèse
  axe_prioritaire text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mental_assessments_athlete_idx
  on public.mental_assessments(athlete_id, assessment_date desc);

-- updated_at auto
create or replace function public.set_mental_assessments_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_mental_assessments_updated_at on public.mental_assessments;
create trigger trg_mental_assessments_updated_at
  before update on public.mental_assessments
  for each row execute function public.set_mental_assessments_updated_at();

-- RLS : seul le coach approuvé de l'athlète accède aux bilans. Aucun accès athlète.
alter table public.mental_assessments enable row level security;

drop policy if exists mental_assessments_coach_all on public.mental_assessments;
create policy mental_assessments_coach_all on public.mental_assessments
  for all
  using (exists (
    select 1 from public.coach_athlete_relationships car
    where car.coach_id = auth.uid()
      and car.athlete_id = mental_assessments.athlete_id
      and car.status = 'approved'
  ))
  with check (exists (
    select 1 from public.coach_athlete_relationships car
    where car.coach_id = auth.uid()
      and car.athlete_id = mental_assessments.athlete_id
      and car.status = 'approved'
  ));
