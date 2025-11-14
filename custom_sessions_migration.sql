-- Migration pour ajouter les séances personnalisées des sportifs
-- À exécuter dans votre Supabase auto-hébergé via l'interface SQL Editor

-- Table pour les séances personnalisées créées par les sportifs
create table if not exists public.custom_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  session_name text not null,
  description text,
  duration_minutes integer not null,
  completed_at timestamptz default now() not null,
  created_at timestamptz default now() not null
);

-- RLS policies
alter table public.custom_sessions enable row level security;

-- Les sportifs peuvent voir et créer leurs propres séances
create policy "Users can view their own custom sessions"
  on public.custom_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own custom sessions"
  on public.custom_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own custom sessions"
  on public.custom_sessions
  for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete their own custom sessions"
  on public.custom_sessions
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Les coachs peuvent voir les séances de leurs athlètes
create policy "Coaches can view athlete custom sessions"
  on public.custom_sessions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.coach_athlete_relationships car
      where car.athlete_id = custom_sessions.user_id
        and car.coach_id = auth.uid()
        and car.status = 'approved'
    )
  );

-- Index pour les performances
create index if not exists custom_sessions_user_id_idx on public.custom_sessions(user_id);
create index if not exists custom_sessions_completed_at_idx on public.custom_sessions(completed_at desc);

-- Commentaire sur la table
comment on table public.custom_sessions is 'Séances supplémentaires créées par les sportifs en dehors de leur programme';
