-- Carte athlète "Coureur" : objectif, tests terrain, snapshots calculés.
-- Athlètes = user_profiles (id = user auth). Accès réservé au coach de l'athlète.

-- Objectif actif de l'athlète (distance + ambition)
create table if not exists public.athlete_objectives (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.user_profiles(id) on delete cascade,
  distance text not null check (distance in ('5k','10k','half','marathon')),
  ambition text not null check (ambition in ('finisher','progression','perf')),
  target_race_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists athlete_objectives_athlete_idx on public.athlete_objectives(athlete_id);

-- Tests terrain saisis par le coach (valeurs relevées, ex. Garmin)
--   vma   : km/h
--   t12   : distance en mètres (test 12 min)
--   t30   : distance en mètres (test 30 min)
--   drift : dérive cardiaque en % (test endurance FC constante) → ECO
--   fade  : perte d'allure en % (1re vs 2e moitié sortie longue) → MUS
create table if not exists public.profile_tests (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.user_profiles(id) on delete cascade,
  test_type text not null check (test_type in ('vma','t12','t30','drift','fade')),
  test_date date not null default current_date,
  value numeric not null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists profile_tests_athlete_idx on public.profile_tests(athlete_id);

-- Snapshot du profil calculé (historisé)
create table if not exists public.profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.user_profiles(id) on delete cascade,
  objective_id uuid references public.athlete_objectives(id) on delete set null,
  computed_at timestamptz not null default now(),
  overall_score int not null,
  scores jsonb not null,
  raw_measures jsonb not null,
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  recommendation text not null,
  data_quality jsonb
);
create index if not exists profile_snapshots_athlete_idx on public.profile_snapshots(athlete_id, computed_at desc);

alter table public.athlete_objectives enable row level security;
alter table public.profile_tests enable row level security;
alter table public.profile_snapshots enable row level security;

-- Accès : uniquement le coach approuvé de l'athlète (lecture + écriture).
do $$
declare t text;
begin
  foreach t in array array['athlete_objectives','profile_tests','profile_snapshots'] loop
    execute format('drop policy if exists %I_coach_all on public.%I', t, t);
    execute format($f$
      create policy %I_coach_all on public.%I
        for all
        using (exists (select 1 from public.coach_athlete_relationships car
                       where car.coach_id = auth.uid() and car.athlete_id = %I.athlete_id and car.status = 'approved'))
        with check (exists (select 1 from public.coach_athlete_relationships car
                       where car.coach_id = auth.uid() and car.athlete_id = %I.athlete_id and car.status = 'approved'))
    $f$, t, t, t, t);
  end loop;
end $$;
