-- Migration: Create coach_notes table
-- Table pour stocker les notes des coachs sur leurs clients

-- 1. Créer la table
CREATE TABLE IF NOT EXISTS public.coach_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Activer RLS
ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;

-- 3. Créer les policies RLS

-- Les coachs peuvent voir leurs propres notes
CREATE POLICY "Coaches can view own notes"
ON public.coach_notes
FOR SELECT
TO authenticated
USING (coach_id = auth.uid());

-- Les coachs peuvent créer des notes
CREATE POLICY "Coaches can insert own notes"
ON public.coach_notes
FOR INSERT
TO authenticated
WITH CHECK (coach_id = auth.uid());

-- Les coachs peuvent supprimer leurs propres notes
CREATE POLICY "Coaches can delete own notes"
ON public.coach_notes
FOR DELETE
TO authenticated
USING (coach_id = auth.uid());

-- Les coachs peuvent modifier leurs propres notes
CREATE POLICY "Coaches can update own notes"
ON public.coach_notes
FOR UPDATE
TO authenticated
USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());

-- 4. Créer des index pour les performances
CREATE INDEX IF NOT EXISTS idx_coach_notes_coach_id 
ON public.coach_notes(coach_id);

CREATE INDEX IF NOT EXISTS idx_coach_notes_athlete_id 
ON public.coach_notes(athlete_id);

CREATE INDEX IF NOT EXISTS idx_coach_notes_created_at 
ON public.coach_notes(created_at DESC);
