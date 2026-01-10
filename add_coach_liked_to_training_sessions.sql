-- Migration pour ajouter le champ coach_liked aux training_sessions
-- À exécuter dans Supabase via l'éditeur SQL

-- Ajouter la colonne coach_liked
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS coach_liked boolean DEFAULT false;

-- Ajouter un index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_training_sessions_coach_liked 
ON training_sessions(coach_liked) WHERE coach_liked = true;

-- Commenter la colonne
COMMENT ON COLUMN training_sessions.coach_liked IS 
'Indique si le coach a aimé/validé la séance de l''athlète';
