-- 1. athlete_methodology_maxes : public -> authenticated
DROP POLICY IF EXISTS "Coaches can view own methodology maxes" ON public.athlete_methodology_maxes;
DROP POLICY IF EXISTS "Coaches can insert own methodology maxes" ON public.athlete_methodology_maxes;
DROP POLICY IF EXISTS "Coaches can update own methodology maxes" ON public.athlete_methodology_maxes;
DROP POLICY IF EXISTS "Coaches can delete own methodology maxes" ON public.athlete_methodology_maxes;

CREATE POLICY "Coaches can view own methodology maxes"
  ON public.athlete_methodology_maxes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.athlete_methodology_assignments a
    WHERE a.id = athlete_methodology_maxes.assignment_id AND a.coach_id = auth.uid()
  ));

CREATE POLICY "Coaches can insert own methodology maxes"
  ON public.athlete_methodology_maxes FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.athlete_methodology_assignments a
    WHERE a.id = athlete_methodology_maxes.assignment_id AND a.coach_id = auth.uid()
  ));

CREATE POLICY "Coaches can update own methodology maxes"
  ON public.athlete_methodology_maxes FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.athlete_methodology_assignments a
    WHERE a.id = athlete_methodology_maxes.assignment_id AND a.coach_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.athlete_methodology_assignments a
    WHERE a.id = athlete_methodology_maxes.assignment_id AND a.coach_id = auth.uid()
  ));

CREATE POLICY "Coaches can delete own methodology maxes"
  ON public.athlete_methodology_maxes FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.athlete_methodology_assignments a
    WHERE a.id = athlete_methodology_maxes.assignment_id AND a.coach_id = auth.uid()
  ));

-- 2. athlete_subscriptions : public -> authenticated + DELETE policy
DROP POLICY IF EXISTS "Athletes can view their own subscriptions" ON public.athlete_subscriptions;
DROP POLICY IF EXISTS "Athletes can insert their own subscriptions" ON public.athlete_subscriptions;
DROP POLICY IF EXISTS "Athletes can update their own subscriptions" ON public.athlete_subscriptions;

CREATE POLICY "Athletes can view their own subscriptions"
  ON public.athlete_subscriptions FOR SELECT
  TO authenticated
  USING (athlete_id = auth.uid());

CREATE POLICY "Athletes can insert their own subscriptions"
  ON public.athlete_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "Athletes can update their own subscriptions"
  ON public.athlete_subscriptions FOR UPDATE
  TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "Athletes can delete their own subscriptions"
  ON public.athlete_subscriptions FOR DELETE
  TO authenticated
  USING (athlete_id = auth.uid());

-- 3. athlete_methodology_assignments : athletes peuvent voir leurs assignations
CREATE POLICY "Athletes can view own assignments"
  ON public.athlete_methodology_assignments FOR SELECT
  TO authenticated
  USING (athlete_id = auth.uid());

-- 4. methodology_themes : UPDATE pour coachs
CREATE POLICY "Coaches can update methodology themes"
  ON public.methodology_themes FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coaching_methodologies m
    WHERE m.id = methodology_themes.methodology_id AND m.coach_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.coaching_methodologies m
    WHERE m.id = methodology_themes.methodology_id AND m.coach_id = auth.uid()
  ));

-- 5. methodology_exercises : UPDATE pour coachs
CREATE POLICY "Coaches can update methodology exercises"
  ON public.methodology_exercises FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coaching_methodologies m
    WHERE m.id = methodology_exercises.methodology_id AND m.coach_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.coaching_methodologies m
    WHERE m.id = methodology_exercises.methodology_id AND m.coach_id = auth.uid()
  ));

NOTIFY pgrst, 'reload schema';