-- Archiver un macrocycle terminé : il quitte la vue courante (qui repart vierge)
-- et se range dans l'historique. NULL = macrocycle actif.
alter table public.macrocycles
  add column if not exists archived_at timestamptz;

-- Accélère le filtre "macro actif" (archived_at IS NULL) par athlète.
create index if not exists macrocycles_active_idx
  on public.macrocycles (athlete_id)
  where archived_at is null;
