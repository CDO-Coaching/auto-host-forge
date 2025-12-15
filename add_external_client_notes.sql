-- Migration: Allow notes for external clients
-- Modification de la table coach_notes pour supporter les clients externes

-- 1. Rendre athlete_id nullable
ALTER TABLE public.coach_notes 
ALTER COLUMN athlete_id DROP NOT NULL;

-- 2. Ajouter la colonne external_client_id
ALTER TABLE public.coach_notes 
ADD COLUMN external_client_id UUID REFERENCES public.external_clients(id) ON DELETE CASCADE;

-- 3. Ajouter une contrainte pour s'assurer qu'une note est liée soit à un athlète soit à un client externe
ALTER TABLE public.coach_notes
ADD CONSTRAINT check_client_type CHECK (
    (athlete_id IS NOT NULL AND external_client_id IS NULL) OR
    (athlete_id IS NULL AND external_client_id IS NOT NULL)
);

-- 4. Créer un index pour les performances
CREATE INDEX IF NOT EXISTS idx_coach_notes_external_client_id 
ON public.coach_notes(external_client_id);
