-- Add per_side column to session_exercises table
ALTER TABLE session_exercises
ADD COLUMN per_side BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN session_exercises.per_side IS 'Indicates if the repetitions are per side for unilateral exercises';
