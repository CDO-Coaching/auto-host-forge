-- Migration: Allow athletes to manage their own milestones
-- This allows athletes to add, update, and delete their own objective milestones
-- while keeping coach access intact

-- Athletes can insert their own milestones
CREATE POLICY "Athletes can insert their own milestones"
  ON public.objective_milestones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = athlete_id
  );

-- Athletes can update their own milestones
CREATE POLICY "Athletes can update their own milestones"
  ON public.objective_milestones
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = athlete_id);

-- Athletes can delete their own milestones
CREATE POLICY "Athletes can delete their own milestones"
  ON public.objective_milestones
  FOR DELETE
  TO authenticated
  USING (auth.uid() = athlete_id);
