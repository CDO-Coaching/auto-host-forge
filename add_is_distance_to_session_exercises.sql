-- Add is_distance column to session_exercises
-- Allows the coach to set a reps value as a distance (metres)
ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS is_distance boolean DEFAULT false;
