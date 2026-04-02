-- Add structured fields to coaching_methodologies
ALTER TABLE coaching_methodologies 
  ADD COLUMN IF NOT EXISTS duration_weeks_min integer,
  ADD COLUMN IF NOT EXISTS duration_weeks_max integer,
  ADD COLUMN IF NOT EXISTS rpe_target_min numeric(3,1),
  ADD COLUMN IF NOT EXISTS rpe_target_max numeric(3,1),
  ADD COLUMN IF NOT EXISTS progression_summary text,
  ADD COLUMN IF NOT EXISTS full_description text;

-- Table for assigning a methodology to an athlete
CREATE TABLE public.athlete_methodology_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  athlete_id uuid NOT NULL,
  methodology_id uuid NOT NULL REFERENCES coaching_methodologies(id) ON DELETE CASCADE,
  total_weeks integer NOT NULL DEFAULT 4,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE athlete_methodology_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own assignments" ON athlete_methodology_assignments FOR SELECT TO authenticated USING (coach_id = auth.uid());
CREATE POLICY "Coaches can insert own assignments" ON athlete_methodology_assignments FOR INSERT TO authenticated WITH CHECK (coach_id = auth.uid());
CREATE POLICY "Coaches can update own assignments" ON athlete_methodology_assignments FOR UPDATE TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
CREATE POLICY "Coaches can delete own assignments" ON athlete_methodology_assignments FOR DELETE TO authenticated USING (coach_id = auth.uid());

-- Table for tracking each week's progress
CREATE TABLE public.athlete_methodology_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES athlete_methodology_assignments(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  observed_rpe numeric(3,1),
  coach_notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE athlete_methodology_weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own week tracking" ON athlete_methodology_weeks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM athlete_methodology_assignments a WHERE a.id = athlete_methodology_weeks.assignment_id AND a.coach_id = auth.uid()));
CREATE POLICY "Coaches can insert own week tracking" ON athlete_methodology_weeks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM athlete_methodology_assignments a WHERE a.id = athlete_methodology_weeks.assignment_id AND a.coach_id = auth.uid()));
CREATE POLICY "Coaches can update own week tracking" ON athlete_methodology_weeks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM athlete_methodology_assignments a WHERE a.id = athlete_methodology_weeks.assignment_id AND a.coach_id = auth.uid()));
CREATE POLICY "Coaches can delete own week tracking" ON athlete_methodology_weeks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM athlete_methodology_assignments a WHERE a.id = athlete_methodology_weeks.assignment_id AND a.coach_id = auth.uid()));