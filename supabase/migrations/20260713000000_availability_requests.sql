-- Demandes de disponibilités : le coach sélectionne les semaines concernées.
-- L'athlète ne voit la demande qu'à partir de visible_from (mercredi de la
-- semaine précédant la 1re semaine demandée) et doit y répondre.

create table if not exists public.availability_requests (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_weeks jsonb not null default '[]'::jsonb,  -- [{"week":33,"year":2026}, ...]
  visible_from date not null default current_date,
  message text,
  created_at timestamptz not null default now()
);
alter table public.availability_requests enable row level security;

drop policy if exists availability_requests_coach_all on public.availability_requests;
create policy availability_requests_coach_all on public.availability_requests
  for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

drop policy if exists availability_requests_athlete_read on public.availability_requests;
create policy availability_requests_athlete_read on public.availability_requests
  for select using (
    exists (
      select 1 from public.coach_athlete_relationships r
      where r.coach_id = availability_requests.coach_id
        and r.athlete_id = auth.uid()
        and r.status = 'approved'
    )
  );

create table if not exists public.availability_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.availability_requests(id) on delete cascade,
  athlete_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  renfo_count int not null default 0,
  course_count int not null default 0,
  natation_count int not null default 0,
  velo_count int not null default 0,
  comment text,
  created_at timestamptz not null default now(),
  unique (request_id, athlete_id)
);
alter table public.availability_responses enable row level security;

drop policy if exists availability_responses_athlete on public.availability_responses;
create policy availability_responses_athlete on public.availability_responses
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

drop policy if exists availability_responses_coach_read on public.availability_responses;
create policy availability_responses_coach_read on public.availability_responses
  for select using (
    exists (
      select 1 from public.availability_requests req
      where req.id = availability_responses.request_id
        and req.coach_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
