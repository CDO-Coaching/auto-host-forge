
CREATE TABLE IF NOT EXISTS public.coach_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    athlete_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    external_client_id UUID,
    content TEXT NOT NULL,
    target_date DATE DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_client_type CHECK (
        (athlete_id IS NOT NULL AND external_client_id IS NULL) OR
        (athlete_id IS NULL AND external_client_id IS NOT NULL)
    )
);

ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own notes"
ON public.coach_notes FOR SELECT TO authenticated
USING (coach_id = auth.uid());

CREATE POLICY "Coaches can insert own notes"
ON public.coach_notes FOR INSERT TO authenticated
WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update own notes"
ON public.coach_notes FOR UPDATE TO authenticated
USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can delete own notes"
ON public.coach_notes FOR DELETE TO authenticated
USING (coach_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_coach_notes_coach_id ON public.coach_notes(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_notes_athlete_id ON public.coach_notes(athlete_id);
CREATE INDEX IF NOT EXISTS idx_coach_notes_external_client_id ON public.coach_notes(external_client_id);
CREATE INDEX IF NOT EXISTS idx_coach_notes_created_at ON public.coach_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_notes_target_date ON public.coach_notes(target_date);
