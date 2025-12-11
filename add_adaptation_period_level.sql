-- Add adaptation_period_level column to user_profiles table
-- Replaces the old menstrual_period_active boolean with a level indicator
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS adaptation_period_level text;

-- Optional: Migrate existing data (if menstrual_period_active was true, set to "moyenne")
-- UPDATE user_profiles SET adaptation_period_level = 'moyenne' WHERE menstrual_period_active = true;

-- Optional: Drop the old column after migration
-- ALTER TABLE user_profiles DROP COLUMN IF EXISTS menstrual_period_active;
