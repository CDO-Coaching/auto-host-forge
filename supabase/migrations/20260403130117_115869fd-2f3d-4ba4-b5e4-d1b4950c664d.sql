
-- Drop and recreate methodology_exercises without foreign key to exercises
-- (exercises table exists only on self-hosted Supabase)
DROP TABLE IF EXISTS public.methodology_exercises;

CREATE TABLE public.methodology_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  methodology_id uuid NOT NULL REFERENCES public.coaching_methodologies(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.methodology_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view methodology exercises"
  ON public.methodology_exercises FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coaching_methodologies m 
    WHERE m.id = methodology_exercises.methodology_id AND m.coach_id = auth.uid()
  ));

CREATE POLICY "Coaches can insert methodology exercises"
  ON public.methodology_exercises FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.coaching_methodologies m 
    WHERE m.id = methodology_exercises.methodology_id AND m.coach_id = auth.uid()
  ));

CREATE POLICY "Coaches can delete methodology exercises"
  ON public.methodology_exercises FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coaching_methodologies m 
    WHERE m.id = methodology_exercises.methodology_id AND m.coach_id = auth.uid()
  ));
