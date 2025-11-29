-- Migration pour ajouter les données cardio réelles saisies par le sportif
-- À exécuter manuellement dans l'éditeur SQL de Supabase

-- Ajouter les colonnes pour stocker les données cardio réelles saisies par l'athlète
ALTER TABLE session_exercises
ADD COLUMN IF NOT EXISTS actual_distance_km DECIMAL(6,2) CHECK (actual_distance_km IS NULL OR actual_distance_km >= 0),
ADD COLUMN IF NOT EXISTS actual_duration_minutes DECIMAL(8,2) CHECK (actual_duration_minutes IS NULL OR actual_duration_minutes >= 0),
ADD COLUMN IF NOT EXISTS actual_pace_min_per_km TEXT,
ADD COLUMN IF NOT EXISTS actual_avg_heart_rate INTEGER CHECK (actual_avg_heart_rate IS NULL OR (actual_avg_heart_rate > 0 AND actual_avg_heart_rate < 250));

-- Ajouter des commentaires pour documenter les colonnes
COMMENT ON COLUMN session_exercises.actual_distance_km IS 'Distance réelle parcourue par l''athlète lors de la séance cardio (en km)';
COMMENT ON COLUMN session_exercises.actual_duration_minutes IS 'Durée réelle de la séance cardio saisie par l''athlète (en minutes)';
COMMENT ON COLUMN session_exercises.actual_pace_min_per_km IS 'Allure moyenne réelle de l''athlète (format: min:sec/km, ex: 5:30)';
COMMENT ON COLUMN session_exercises.actual_avg_heart_rate IS 'Fréquence cardiaque moyenne pendant la séance (en bpm)';
