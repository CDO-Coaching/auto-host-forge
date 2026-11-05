-- Note de coaching : version reconstruite au propre (IA) + statut de lecture.
-- structured_content : compte-rendu structuré généré à l'enregistrement.
-- read_at : null = non lue par le coach ; sinon date de lecture.
alter table public.coach_notes
  add column if not exists structured_content text,
  add column if not exists read_at timestamptz;

create index if not exists idx_coach_notes_read_at on public.coach_notes(read_at);
