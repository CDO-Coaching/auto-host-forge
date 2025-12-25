-- Migration pour créer la table des mésocycles
-- À exécuter dans l'éditeur SQL de Supabase

-- Table pour les mésocycles (cycles de renforcement)
CREATE TABLE IF NOT EXISTS public.mesocycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT mesocycle_dates_check CHECK (end_date >= start_date)
);

-- Activer RLS sur la table
ALTER TABLE public.mesocycles ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour mesocycles

-- Les coachs peuvent voir les mésocycles de leurs athlètes
CREATE POLICY "Coaches can view athlete mesocycles"
  ON public.mesocycles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = mesocycles.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Coaches can insert athlete mesocycles"
  ON public.mesocycles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = coach_id
    AND EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = mesocycles.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Coaches can update athlete mesocycles"
  ON public.mesocycles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = mesocycles.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Coaches can delete athlete mesocycles"
  ON public.mesocycles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = mesocycles.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

-- Les athlètes peuvent voir leurs propres mésocycles
CREATE POLICY "Athletes can view their own mesocycles"
  ON public.mesocycles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_mesocycles_athlete_id 
  ON public.mesocycles(athlete_id);

CREATE INDEX IF NOT EXISTS idx_mesocycles_dates 
  ON public.mesocycles(start_date, end_date);

-- Commentaire
COMMENT ON TABLE public.mesocycles IS 'Cycles de renforcement/mésocycles pour les athlètes définis par leurs coachs';
