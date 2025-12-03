-- Migration: Add is_duration column to session_exercises
-- This allows coaches to toggle between reps and duration (in seconds) for exercises

ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS is_duration BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN session_exercises.is_duration IS 'When true, the reps field represents duration in seconds instead of repetitions';
