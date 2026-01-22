-- Migration pour créer les tables macrocycles et microcycles
-- Structure hiérarchique: Macrocycle → Mésocycle → Microcycle
-- À exécuter dans l'éditeur SQL de Supabase

-- =====================================================
-- MACROCYCLES (niveau supérieur)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.macrocycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#8B5CF6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT macrocycle_dates_check CHECK (end_date >= start_date)
);

-- Activer RLS sur macrocycles
ALTER TABLE public.macrocycles ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour macrocycles (identiques aux mésocycles)
CREATE POLICY "Coaches can view athlete macrocycles"
  ON public.macrocycles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = macrocycles.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Coaches can insert athlete macrocycles"
  ON public.macrocycles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = coach_id
    AND EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = macrocycles.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Coaches can update athlete macrocycles"
  ON public.macrocycles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = macrocycles.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Coaches can delete athlete macrocycles"
  ON public.macrocycles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = macrocycles.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Athletes can view their own macrocycles"
  ON public.macrocycles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id);

-- Index pour macrocycles
CREATE INDEX IF NOT EXISTS idx_macrocycles_athlete_id 
  ON public.macrocycles(athlete_id);

CREATE INDEX IF NOT EXISTS idx_macrocycles_dates 
  ON public.macrocycles(start_date, end_date);

COMMENT ON TABLE public.macrocycles IS 'Grands cycles de planification (ex: saison complète, préparation olympique)';

-- =====================================================
-- Ajouter macrocycle_id aux mésocycles existants
-- =====================================================
ALTER TABLE public.mesocycles 
ADD COLUMN IF NOT EXISTS macrocycle_id UUID REFERENCES public.macrocycles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mesocycles_macrocycle_id 
  ON public.mesocycles(macrocycle_id);

-- =====================================================
-- MICROCYCLES (niveau inférieur, sous les mésocycles)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.microcycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mesocycle_id UUID REFERENCES public.mesocycles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#06B6D4',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  CONSTRAINT microcycle_dates_check CHECK (end_date >= start_date)
);

-- Activer RLS sur microcycles
ALTER TABLE public.microcycles ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour microcycles
CREATE POLICY "Coaches can view athlete microcycles"
  ON public.microcycles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = microcycles.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Coaches can insert athlete microcycles"
  ON public.microcycles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = coach_id
    AND EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = microcycles.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Coaches can update athlete microcycles"
  ON public.microcycles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = microcycles.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Coaches can delete athlete microcycles"
  ON public.microcycles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.coach_athlete_relationships car
      WHERE car.athlete_id = microcycles.athlete_id
        AND car.coach_id = auth.uid()
        AND car.status = 'approved'
    )
  );

CREATE POLICY "Athletes can view their own microcycles"
  ON public.microcycles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id);

-- Index pour microcycles
CREATE INDEX IF NOT EXISTS idx_microcycles_athlete_id 
  ON public.microcycles(athlete_id);

CREATE INDEX IF NOT EXISTS idx_microcycles_mesocycle_id 
  ON public.microcycles(mesocycle_id);

CREATE INDEX IF NOT EXISTS idx_microcycles_dates 
  ON public.microcycles(start_date, end_date);

COMMENT ON TABLE public.microcycles IS 'Cycles courts (semaines types) imbriqués dans les mésocycles';
