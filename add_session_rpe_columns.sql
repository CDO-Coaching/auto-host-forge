-- Add session_rpe and session_comment columns to training_sessions table
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS session_rpe integer;
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS session_comment text;
