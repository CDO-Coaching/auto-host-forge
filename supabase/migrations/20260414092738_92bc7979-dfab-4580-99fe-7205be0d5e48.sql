
CREATE TABLE public.athlete_methodology_maxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.athlete_methodology_assignments(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  reference_max NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, exercise_id)
);

ALTER TABLE public.athlete_methodology_maxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own methodology maxes"
ON public.athlete_methodology_maxes
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.athlete_methodology_assignments a
  WHERE a.id = athlete_methodology_maxes.assignment_id AND a.coach_id = auth.uid()
));

CREATE POLICY "Coaches can insert own methodology maxes"
ON public.athlete_methodology_maxes
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.athlete_methodology_assignments a
  WHERE a.id = athlete_methodology_maxes.assignment_id AND a.coach_id = auth.uid()
));

CREATE POLICY "Coaches can update own methodology maxes"
ON public.athlete_methodology_maxes
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.athlete_methodology_assignments a
  WHERE a.id = athlete_methodology_maxes.assignment_id AND a.coach_id = auth.uid()
));

CREATE POLICY "Coaches can delete own methodology maxes"
ON public.athlete_methodology_maxes
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.athlete_methodology_assignments a
  WHERE a.id = athlete_methodology_maxes.assignment_id AND a.coach_id = auth.uid()
));
