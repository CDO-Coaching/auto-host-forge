-- Migration pour ajouter le coefficient de charge aux exercices
-- À exécuter sur votre Supabase auto-hébergé

-- Ajout de la colonne load_coefficient à la table exercise_library
ALTER TABLE exercise_library
ADD COLUMN IF NOT EXISTS load_coefficient DECIMAL(3,2) DEFAULT 1.0;

-- Commentaire pour documenter la colonne
COMMENT ON COLUMN exercise_library.load_coefficient IS 'Coefficient de charge pour le calcul du volume d''entraînement pondéré. Exemples: Squat/Deadlift = 1.5-2.0, Press/Bench = 1.2, Isolation = 0.5-0.7';

-- Index optionnel pour les requêtes sur le coefficient
CREATE INDEX IF NOT EXISTS idx_exercise_library_load_coefficient ON exercise_library(load_coefficient);
