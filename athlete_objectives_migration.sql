-- Migration pour créer les tables de gestion des objectifs des athlètes
-- À exécuter dans l'éditeur SQL de Supabase

-- Table pour les objectifs principaux et secondaires
CREATE TABLE IF NOT EXISTS public.athlete_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  main_objective TEXT,
  main_objective_deadline DATE,
  secondary_objective TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(athlete_id)
);

-- Table pour les dates d'objectifs (milestones)
CREATE TABLE IF NOT EXISTS public.objective_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  target_date DATE NOT NULL,
  notes TEXT,
  completed BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Activer RLS sur les deux tables
ALTER TABLE public.athlete_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objective_milestones ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour athlete_objectives

-- Les coachs peuvent voir et modifier les objectifs de leurs athlètes
CREATE POLICY "Coaches can view athlete objectives"
  ON public.athlete_objectives
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = athlete_objectives.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Coaches can insert athlete objectives"
  ON public.athlete_objectives
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = coach_id
    AND EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = athlete_objectives.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Coaches can update athlete objectives"
  ON public.athlete_objectives
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = athlete_objectives.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Coaches can delete athlete objectives"
  ON public.athlete_objectives
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = athlete_objectives.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

-- Les athlètes peuvent voir leurs propres objectifs
CREATE POLICY "Athletes can view their own objectives"
  ON public.athlete_objectives
  FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id);

-- Politiques RLS pour objective_milestones

-- Les coachs peuvent voir et modifier les milestones de leurs athlètes
CREATE POLICY "Coaches can view athlete milestones"
  ON public.objective_milestones
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = objective_milestones.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Coaches can insert athlete milestones"
  ON public.objective_milestones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = coach_id
    AND EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = objective_milestones.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Coaches can update athlete milestones"
  ON public.objective_milestones
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = objective_milestones.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Coaches can delete athlete milestones"
  ON public.objective_milestones
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = objective_milestones.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

-- Les athlètes peuvent voir leurs propres milestones
CREATE POLICY "Athletes can view their own milestones"
  ON public.objective_milestones
  FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_athlete_objectives_athlete_id 
  ON public.athlete_objectives(athlete_id);

CREATE INDEX IF NOT EXISTS idx_objective_milestones_athlete_id 
  ON public.objective_milestones(athlete_id);

CREATE INDEX IF NOT EXISTS idx_objective_milestones_target_date 
  ON public.objective_milestones(target_date);

-- Commentaires
COMMENT ON TABLE public.athlete_objectives IS 'Objectifs principaux et secondaires des athlètes définis par leurs coachs';
COMMENT ON TABLE public.objective_milestones IS 'Dates d''objectifs et jalons importants pour les athlètes';
