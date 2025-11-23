-- Migration pour ajouter le statut "paused" aux relations coach-athlète
-- À exécuter dans Supabase via l'éditeur SQL

-- Si le champ status utilise une contrainte CHECK, on la modifie
ALTER TABLE coach_athlete_relationships 
DROP CONSTRAINT IF EXISTS coach_athlete_relationships_status_check;

ALTER TABLE coach_athlete_relationships
ADD CONSTRAINT coach_athlete_relationships_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'paused'));

-- Créer un index pour améliorer les performances des requêtes filtrant par statut
CREATE INDEX IF NOT EXISTS idx_coach_athlete_relationships_status 
ON coach_athlete_relationships(status);

-- Commentaire pour documenter le nouveau statut
COMMENT ON COLUMN coach_athlete_relationships.status IS 
'Statut de la relation: pending (en attente), approved (approuvé), rejected (refusé), paused (en pause)';
