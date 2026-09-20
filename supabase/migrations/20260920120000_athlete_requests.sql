-- Demandes d'action des athlètes (« mode demande » de la messagerie).
-- Un athlète crée une demande (ex. modifier sa prog) ; le coach la voit à l'arrivée
-- et la « marque traitée » → elle disparaît de sa liste (conservée en historique).

create table if not exists public.athlete_requests (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.user_profiles(id) on delete cascade,
  coach_id uuid not null,
  category text not null default 'question'
    check (category in ('programmation','planning','question','autre')),
  content text not null,
  status text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

create index if not exists athlete_requests_coach_open_idx
  on public.athlete_requests(coach_id, status, created_at desc);
create index if not exists athlete_requests_athlete_idx
  on public.athlete_requests(athlete_id, created_at desc);

alter table public.athlete_requests enable row level security;

-- L'athlète : crée et consulte SES demandes.
drop policy if exists athlete_requests_athlete_select on public.athlete_requests;
create policy athlete_requests_athlete_select on public.athlete_requests
  for select using (athlete_id = auth.uid());

drop policy if exists athlete_requests_athlete_insert on public.athlete_requests;
create policy athlete_requests_athlete_insert on public.athlete_requests
  for insert with check (
    athlete_id = auth.uid()
    and exists (select 1 from public.coach_athlete_relationships car
                where car.athlete_id = auth.uid() and car.coach_id = athlete_requests.coach_id
                  and car.status = 'approved')
  );

-- Le coach : voit et met à jour (marque traité) les demandes de ses athlètes approuvés.
drop policy if exists athlete_requests_coach_select on public.athlete_requests;
create policy athlete_requests_coach_select on public.athlete_requests
  for select using (exists (
    select 1 from public.coach_athlete_relationships car
    where car.coach_id = auth.uid() and car.athlete_id = athlete_requests.athlete_id
      and car.status = 'approved'
  ));

drop policy if exists athlete_requests_coach_update on public.athlete_requests;
create policy athlete_requests_coach_update on public.athlete_requests
  for update using (exists (
    select 1 from public.coach_athlete_relationships car
    where car.coach_id = auth.uid() and car.athlete_id = athlete_requests.athlete_id
      and car.status = 'approved'
  ));

-- Realtime
alter publication supabase_realtime add table public.athlete_requests;
