-- Migration pour ajouter la colonne commentaire aux exercices de session
-- Cette colonne permettra de stocker un commentaire global pour les séances cardio

-- Ajouter la colonne commentaire si elle n'existe pas
ALTER TABLE session_exercises 
ADD COLUMN IF NOT EXISTS commentaire TEXT;

-- Ajouter un commentaire sur la colonne pour documenter son usage
COMMENT ON COLUMN session_exercises.commentaire IS 'Commentaire général pour la séance, particulièrement utilisé pour les séances cardio';
