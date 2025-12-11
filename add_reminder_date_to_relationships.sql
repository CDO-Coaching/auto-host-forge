-- Migration pour ajouter la colonne reminder_date aux relations coach-athlète
-- À exécuter dans Supabase via l'éditeur SQL

-- Ajouter la colonne reminder_date pour les rappels de recontact
ALTER TABLE public.coach_athlete_relationships
ADD COLUMN IF NOT EXISTS reminder_date DATE;

-- Créer un index pour améliorer les performances des requêtes de rappel
CREATE INDEX IF NOT EXISTS idx_coach_athlete_relationships_reminder_date 
ON public.coach_athlete_relationships(reminder_date)
WHERE reminder_date IS NOT NULL;

-- Commentaire pour documenter la colonne
COMMENT ON COLUMN public.coach_athlete_relationships.reminder_date IS 
'Date à laquelle le coach souhaite être rappelé de recontacter cet athlète en pause';
