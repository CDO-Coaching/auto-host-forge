-- Migration pour ajouter les fonctionnalités de programmation de séance par l'athlète
-- À exécuter dans votre Supabase auto-hébergé via l'interface SQL Editor

-- Ajouter une colonne pour la date programmée par l'athlète
ALTER TABLE public.training_sessions 
ADD COLUMN IF NOT EXISTS scheduled_date date;

-- Ajouter une colonne pour le nom personnalisé par l'athlète (optionnel)
ALTER TABLE public.training_sessions 
ADD COLUMN IF NOT EXISTS athlete_custom_name text;

-- Index pour les performances
CREATE INDEX IF NOT EXISTS training_sessions_scheduled_date_idx ON public.training_sessions(scheduled_date);

-- Commentaire sur les colonnes
COMMENT ON COLUMN public.training_sessions.scheduled_date IS 'Date à laquelle l''athlète a programmé la séance';
COMMENT ON COLUMN public.training_sessions.athlete_custom_name IS 'Nom personnalisé donné par l''athlète à la séance';

-- Policy pour permettre aux athlètes de mettre à jour scheduled_date et athlete_custom_name
CREATE POLICY "Athletes can update their session scheduling"
ON public.training_sessions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.training_weeks tw
    WHERE tw.id = training_sessions.week_id
    AND tw.athlete_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.training_weeks tw
    WHERE tw.id = training_sessions.week_id
    AND tw.athlete_id = auth.uid()
  )
);
