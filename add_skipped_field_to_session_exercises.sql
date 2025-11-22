-- Add skipped field to session_exercises table to track exercises not completed when session is ended early
ALTER TABLE session_exercises
ADD COLUMN skipped BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN session_exercises.skipped IS 'Indicates if the exercise was skipped/not done when the athlete ended the session early';
