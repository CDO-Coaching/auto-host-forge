-- Migration pour ajouter les métriques cardio calculées à la table training_sessions
-- À exécuter manuellement dans l'éditeur SQL de Supabase

-- Ajouter les colonnes pour stocker les métriques cardio calculées
ALTER TABLE training_sessions
ADD COLUMN IF NOT EXISTS cardio_total_distance_km DECIMAL(6,2) CHECK (cardio_total_distance_km IS NULL OR cardio_total_distance_km >= 0),
ADD COLUMN IF NOT EXISTS cardio_total_duration_minutes DECIMAL(8,2) CHECK (cardio_total_duration_minutes IS NULL OR cardio_total_duration_minutes >= 0),
ADD COLUMN IF NOT EXISTS cardio_average_intensity DECIMAL(5,2) CHECK (cardio_average_intensity IS NULL OR (cardio_average_intensity >= 0 AND cardio_average_intensity <= 100));

-- Ajouter des commentaires pour documenter les colonnes
COMMENT ON COLUMN training_sessions.cardio_total_distance_km IS 'Distance totale calculée pour les séances de cardio (en km)';
COMMENT ON COLUMN training_sessions.cardio_total_duration_minutes IS 'Durée totale calculée pour les séances de cardio (en minutes)';
COMMENT ON COLUMN training_sessions.cardio_average_intensity IS 'Intensité moyenne calculée pour les séances de cardio (en % de VMA)';

-- Créer un index pour optimiser les requêtes sur les séances cardio
CREATE INDEX IF NOT EXISTS idx_training_sessions_cardio_metrics 
ON training_sessions(week_id, cardio_total_distance_km) 
WHERE cardio_total_distance_km IS NOT NULL;
