-- =============================================================================
-- ROLLBACK for: 20260511000000_security_rls_fixes.sql
-- Run this in the Supabase SQL editor ONLY if you need to undo the security fixes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Drop the new approve_athlete RPC
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.approve_athlete(uuid, boolean);

-- ---------------------------------------------------------------------------
-- Restore training_sessions — back to permissive (pre-fix) policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owner can view training sessions"  ON public.training_sessions;
DROP POLICY IF EXISTS "Coach can insert training sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "Coach can update training sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "Coach can delete training sessions" ON public.training_sessions;

-- Recreate the old permissive policy (USING (true) = all authenticated users)
CREATE POLICY "Allow all for authenticated"
  ON public.training_sessions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Restore session_exercises — back to permissive (pre-fix) policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owner can view session exercises"  ON public.session_exercises;
DROP POLICY IF EXISTS "Coach can insert session exercises" ON public.session_exercises;
DROP POLICY IF EXISTS "Coach can update session exercises" ON public.session_exercises;
DROP POLICY IF EXISTS "Coach can delete session exercises" ON public.session_exercises;

CREATE POLICY "Allow all for authenticated"
  ON public.session_exercises
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Restore user_profiles — drop the new narrow UPDATE policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

-- Recreate the original broad self-update policy (no role guard)
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
