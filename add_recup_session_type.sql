-- Add 'recup' as a new session type to the training_sessions table
-- This migration adds support for recovery/mobility sessions

-- First, add the new enum value if the column uses an enum type
-- If session_type is a text column with a check constraint, we need to update the constraint

-- Check if there's an enum type first
DO $$ 
BEGIN
  -- Try to add the enum value if it exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_type_enum') THEN
    ALTER TYPE session_type_enum ADD VALUE IF NOT EXISTS 'recup';
  END IF;
END $$;

-- If session_type is a text column with check constraint, update it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'training_sessions' 
    AND column_name = 'session_type'
    AND data_type = 'text'
  ) THEN
    -- Drop the old constraint if it exists
    ALTER TABLE training_sessions 
    DROP CONSTRAINT IF EXISTS training_sessions_session_type_check;
    
    -- Add new constraint with 'recup' included
    ALTER TABLE training_sessions
    ADD CONSTRAINT training_sessions_session_type_check 
    CHECK (session_type IN ('renfo', 'cardio', 'recup'));
  END IF;
END $$;

-- Add comment to document the new session type
COMMENT ON COLUMN training_sessions.session_type IS 'Type of training session: renfo (strength), cardio (cardiovascular), or recup (recovery/mobility)';
