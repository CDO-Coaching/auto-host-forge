-- Add weekly baseline tracking columns to accounting_entries
ALTER TABLE accounting_entries
ADD COLUMN IF NOT EXISTS weekly_baseline_sessions_done INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_baseline_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN accounting_entries.weekly_baseline_sessions_done IS 'Baseline number of completed sessions from the start of the current week (Monday), used to calculate weekly difference badge';
COMMENT ON COLUMN accounting_entries.weekly_baseline_updated_at IS 'Timestamp when the weekly baseline was last updated (reset every Monday)';
