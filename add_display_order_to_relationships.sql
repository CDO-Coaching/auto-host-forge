-- Migration pour ajouter le champ display_order aux relations coach-athlète
-- À exécuter dans Supabase via l'éditeur SQL

ALTER TABLE coach_athlete_relationships 
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Index pour optimiser le tri
CREATE INDEX IF NOT EXISTS idx_coach_athlete_relationships_display_order 
ON coach_athlete_relationships(coach_id, display_order);
