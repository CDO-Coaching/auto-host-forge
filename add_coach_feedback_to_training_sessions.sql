-- Migration pour ajouter les champs de feedback coach aux training_sessions
-- À exécuter dans Supabase via l'éditeur SQL

-- Ajouter la colonne coach_liked
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS coach_liked boolean DEFAULT false;

-- Ajouter la colonne coach_feedback pour le commentaire du coach
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS coach_feedback text;

-- Ajouter la date du feedback
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS coach_feedback_at timestamp with time zone;

-- Créer un index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_training_sessions_coach_liked 
ON training_sessions(coach_liked) WHERE coach_liked = true;

-- Commenter les colonnes
COMMENT ON COLUMN training_sessions.coach_liked IS 
'Indique si le coach a aimé/validé la séance de l''athlète';

COMMENT ON COLUMN training_sessions.coach_feedback IS 
'Commentaire/feedback du coach sur la séance';

COMMENT ON COLUMN training_sessions.coach_feedback_at IS 
'Date à laquelle le coach a donné son feedback';
