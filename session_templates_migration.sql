-- Migration pour ajouter les séances programmées (templates de séances)
-- À exécuter dans votre Supabase auto-hébergé via l'interface SQL Editor

-- Table pour les templates de séances créés par les coachs
CREATE TABLE IF NOT EXISTS public.session_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  session_type text NOT NULL CHECK (session_type IN ('renfo', 'cardio', 'recup')),
  cardio_sport text CHECK (cardio_sport IN ('course', 'velo', 'natation') OR cardio_sport IS NULL),
  description text,
  cardio_total_distance_km decimal(6,2),
  cardio_total_duration_minutes decimal(8,2),
  cardio_average_intensity decimal(5,2),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Table pour les exercices des templates de séances
CREATE TABLE IF NOT EXISTS public.session_template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.session_templates(id) ON DELETE CASCADE NOT NULL,
  exercice text NOT NULL,
  series text,
  reps text,
  charge text,
  recuperation text,
  rpe text,
  tempo text,
  commentaire text,
  ordre integer NOT NULL DEFAULT 0,
  is_duration boolean DEFAULT false,
  per_side boolean DEFAULT false,
  load_coefficient decimal(4,2),
  cardio_content jsonb,
  cardio_sport text,
  cardio_pace text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- RLS policies pour session_templates
ALTER TABLE public.session_templates ENABLE ROW LEVEL SECURITY;

-- Les coachs peuvent voir leurs propres templates
CREATE POLICY "Coaches can view their own templates"
  ON public.session_templates
  FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id);

-- Les coachs peuvent créer leurs propres templates
CREATE POLICY "Coaches can create their own templates"
  ON public.session_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

-- Les coachs peuvent modifier leurs propres templates
CREATE POLICY "Coaches can update their own templates"
  ON public.session_templates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id);

-- Les coachs peuvent supprimer leurs propres templates
CREATE POLICY "Coaches can delete their own templates"
  ON public.session_templates
  FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- RLS policies pour session_template_exercises
ALTER TABLE public.session_template_exercises ENABLE ROW LEVEL SECURITY;

-- Les coachs peuvent voir les exercices de leurs templates
CREATE POLICY "Coaches can view their template exercises"
  ON public.session_template_exercises
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_templates st
      WHERE st.id = session_template_exercises.template_id
      AND st.coach_id = auth.uid()
    )
  );

-- Les coachs peuvent créer des exercices dans leurs templates
CREATE POLICY "Coaches can create template exercises"
  ON public.session_template_exercises
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.session_templates st
      WHERE st.id = session_template_exercises.template_id
      AND st.coach_id = auth.uid()
    )
  );

-- Les coachs peuvent modifier les exercices de leurs templates
CREATE POLICY "Coaches can update template exercises"
  ON public.session_template_exercises
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_templates st
      WHERE st.id = session_template_exercises.template_id
      AND st.coach_id = auth.uid()
    )
  );

-- Les coachs peuvent supprimer les exercices de leurs templates
CREATE POLICY "Coaches can delete template exercises"
  ON public.session_template_exercises
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.session_templates st
      WHERE st.id = session_template_exercises.template_id
      AND st.coach_id = auth.uid()
    )
  );

-- Index pour les performances
CREATE INDEX IF NOT EXISTS session_templates_coach_id_idx ON public.session_templates(coach_id);
CREATE INDEX IF NOT EXISTS session_templates_session_type_idx ON public.session_templates(session_type);
CREATE INDEX IF NOT EXISTS session_template_exercises_template_id_idx ON public.session_template_exercises(template_id);

-- Commentaires sur les tables
COMMENT ON TABLE public.session_templates IS 'Templates de séances préprogrammées créés par les coachs';
COMMENT ON TABLE public.session_template_exercises IS 'Exercices des templates de séances';
