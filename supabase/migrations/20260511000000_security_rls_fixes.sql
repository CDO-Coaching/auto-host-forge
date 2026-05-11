-- =============================================================================
-- Security fix: RLS hardening
-- Date: 2026-05-11
-- Issues addressed:
--   H-6 : user_profiles UPDATE policy allowed coaches to modify any column
--          (including role, iban_number) on any row.
--   M-3 : training_sessions / session_exercises used USING (true), giving
--          every authenticated user read/write access to all rows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- H-6 : user_profiles
-- ---------------------------------------------------------------------------

-- Drop existing broad UPDATE policies (names may vary — use IF EXISTS)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Coaches can update athlete profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated users can update profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow update for coaches and own profile" ON public.user_profiles;

-- 1. Athletes (and coaches) can update their OWN profile.
--    WITH CHECK prevents self-elevation of `role`.
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Block self-promotion: role must stay the same as the existing DB value
    AND role = (SELECT role FROM public.user_profiles WHERE id = auth.uid())
  );

-- 2. Coaches can update ONLY the `approved` field of athletes they coach.
--    We achieve column-level restriction through a separate RPC function
--    (see note below), but we also add a row-level guard here so that
--    coaches cannot touch athlete rows via direct UPDATE at all —
--    the application must call the approve_athlete() function instead.
--    (This policy is intentionally narrow; the RPC runs as SECURITY DEFINER.)
-- No direct-UPDATE policy for coaches on other athletes' rows.

-- ---------------------------------------------------------------------------
-- M-3 : training_sessions
-- ---------------------------------------------------------------------------

-- Drop existing overly-permissive policies
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.training_sessions;
DROP POLICY IF EXISTS "Authenticated users can view sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "Authenticated users can update sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "Authenticated users can insert sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "Authenticated users can delete sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "Users can view training sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "Users can manage training sessions" ON public.training_sessions;

-- Proper SELECT: athlete or coach of the parent week
CREATE POLICY "Owner can view training sessions"
  ON public.training_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.training_weeks tw
      WHERE tw.id = training_sessions.week_id
        AND (tw.athlete_id = auth.uid() OR tw.coach_id = auth.uid())
    )
  );

-- Proper INSERT: only the coach of the week may add sessions
CREATE POLICY "Coach can insert training sessions"
  ON public.training_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_weeks tw
      WHERE tw.id = training_sessions.week_id
        AND tw.coach_id = auth.uid()
    )
  );

-- Proper UPDATE: only the coach of the week may modify sessions
CREATE POLICY "Coach can update training sessions"
  ON public.training_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.training_weeks tw
      WHERE tw.id = training_sessions.week_id
        AND tw.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_weeks tw
      WHERE tw.id = training_sessions.week_id
        AND tw.coach_id = auth.uid()
    )
  );

-- Proper DELETE: only the coach of the week may delete sessions
CREATE POLICY "Coach can delete training sessions"
  ON public.training_sessions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.training_weeks tw
      WHERE tw.id = training_sessions.week_id
        AND tw.coach_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- M-3 : session_exercises
-- ---------------------------------------------------------------------------

-- Drop existing overly-permissive policies
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.session_exercises;
DROP POLICY IF EXISTS "Authenticated users can view exercises" ON public.session_exercises;
DROP POLICY IF EXISTS "Authenticated users can update exercises" ON public.session_exercises;
DROP POLICY IF EXISTS "Authenticated users can insert exercises" ON public.session_exercises;
DROP POLICY IF EXISTS "Authenticated users can delete exercises" ON public.session_exercises;
DROP POLICY IF EXISTS "Users can view session exercises" ON public.session_exercises;
DROP POLICY IF EXISTS "Users can manage session exercises" ON public.session_exercises;

-- Helper CTE reused across policies: check ownership via training_weeks
CREATE POLICY "Owner can view session exercises"
  ON public.session_exercises
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.training_weeks tw ON tw.id = ts.week_id
      WHERE ts.id = session_exercises.session_id
        AND (tw.athlete_id = auth.uid() OR tw.coach_id = auth.uid())
    )
  );

CREATE POLICY "Coach can insert session exercises"
  ON public.session_exercises
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.training_weeks tw ON tw.id = ts.week_id
      WHERE ts.id = session_exercises.session_id
        AND tw.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coach can update session exercises"
  ON public.session_exercises
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.training_weeks tw ON tw.id = ts.week_id
      WHERE ts.id = session_exercises.session_id
        AND tw.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.training_weeks tw ON tw.id = ts.week_id
      WHERE ts.id = session_exercises.session_id
        AND tw.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coach can delete session exercises"
  ON public.session_exercises
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.training_weeks tw ON tw.id = ts.week_id
      WHERE ts.id = session_exercises.session_id
        AND tw.coach_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Helper RPC: approve_athlete (SECURITY DEFINER — bypasses RLS safely)
-- Coaches call this instead of updating user_profiles directly.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_athlete(
  p_athlete_id uuid,
  p_approved    boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id uuid := auth.uid();
BEGIN
  -- Verify the caller is actually the athlete's coach
  IF NOT EXISTS (
    SELECT 1 FROM public.coach_athlete_relationships
    WHERE coach_id = v_coach_id
      AND athlete_id = p_athlete_id
  ) THEN
    RAISE EXCEPTION 'Forbidden: you are not the coach of this athlete';
  END IF;

  UPDATE public.user_profiles
     SET approved = p_approved
   WHERE id = p_athlete_id;
END;
$$;

-- Grant execute to authenticated users (the function itself enforces coach check)
GRANT EXECUTE ON FUNCTION public.approve_athlete(uuid, boolean) TO authenticated;
