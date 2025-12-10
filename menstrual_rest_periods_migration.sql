-- Migration: Create menstrual_rest_periods table
-- This table stores rest period requests from female athletes for their coaches

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.menstrual_rest_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    notes TEXT,
    dismissed_by_coach BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Constraint: end_date must be >= start_date
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- 2. Enable Row Level Security
ALTER TABLE public.menstrual_rest_periods ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies

-- Athletes can view their own periods
CREATE POLICY "Athletes can view own menstrual rest periods"
ON public.menstrual_rest_periods
FOR SELECT
TO authenticated
USING (athlete_id = auth.uid());

-- Athletes can insert their own periods
CREATE POLICY "Athletes can insert own menstrual rest periods"
ON public.menstrual_rest_periods
FOR INSERT
TO authenticated
WITH CHECK (athlete_id = auth.uid());

-- Athletes can delete their own periods
CREATE POLICY "Athletes can delete own menstrual rest periods"
ON public.menstrual_rest_periods
FOR DELETE
TO authenticated
USING (athlete_id = auth.uid());

-- Athletes can update their own periods
CREATE POLICY "Athletes can update own menstrual rest periods"
ON public.menstrual_rest_periods
FOR UPDATE
TO authenticated
USING (athlete_id = auth.uid())
WITH CHECK (athlete_id = auth.uid());

-- Coaches can view periods of their athletes (via coach_athlete relationship)
CREATE POLICY "Coaches can view athlete menstrual rest periods"
ON public.menstrual_rest_periods
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.coach_athlete_relationships
        WHERE coach_id = auth.uid()
        AND athlete_id = menstrual_rest_periods.athlete_id
        AND status = 'approved'
    )
);

-- Coaches can update dismissed_by_coach for their athletes
CREATE POLICY "Coaches can update dismissed status"
ON public.menstrual_rest_periods
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.coach_athlete_relationships
        WHERE coach_id = auth.uid()
        AND athlete_id = menstrual_rest_periods.athlete_id
        AND status = 'approved'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.coach_athlete_relationships
        WHERE coach_id = auth.uid()
        AND athlete_id = menstrual_rest_periods.athlete_id
        AND status = 'approved'
    )
);

-- 4. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_menstrual_rest_periods_athlete_id 
ON public.menstrual_rest_periods(athlete_id);

CREATE INDEX IF NOT EXISTS idx_menstrual_rest_periods_dates 
ON public.menstrual_rest_periods(start_date, end_date);

-- 5. Add comment for documentation
COMMENT ON TABLE public.menstrual_rest_periods IS 'Stores menstrual rest period requests from female athletes. Coaches are notified to reduce training intensity during these periods.';
