-- Add serie_rpe_details column to store per-serie RPE from athlete
-- Format: [{"rpe": 6}, {"rpe": 7}, {"rpe": 8}]
ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS serie_rpe_details jsonb;
