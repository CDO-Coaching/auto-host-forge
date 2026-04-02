
-- Enum for methodology themes
CREATE TYPE public.methodology_theme AS ENUM ('endurance', 'force', 'hypertrophie', 'rehabilitation', 'mobilite', 'explosivite');

-- Main methodologies table
CREATE TABLE public.coaching_methodologies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Junction table for many-to-many relationship with themes
CREATE TABLE public.methodology_themes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  methodology_id UUID NOT NULL REFERENCES public.coaching_methodologies(id) ON DELETE CASCADE,
  theme methodology_theme NOT NULL,
  UNIQUE(methodology_id, theme)
);

-- RLS
ALTER TABLE public.coaching_methodologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own methodologies" ON public.coaching_methodologies FOR SELECT TO authenticated USING (coach_id = auth.uid());
CREATE POLICY "Coaches can insert own methodologies" ON public.coaching_methodologies FOR INSERT TO authenticated WITH CHECK (coach_id = auth.uid());
CREATE POLICY "Coaches can update own methodologies" ON public.coaching_methodologies FOR UPDATE TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
CREATE POLICY "Coaches can delete own methodologies" ON public.coaching_methodologies FOR DELETE TO authenticated USING (coach_id = auth.uid());

CREATE POLICY "Coaches can view methodology themes" ON public.methodology_themes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.coaching_methodologies m WHERE m.id = methodology_id AND m.coach_id = auth.uid()));
CREATE POLICY "Coaches can insert methodology themes" ON public.methodology_themes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.coaching_methodologies m WHERE m.id = methodology_id AND m.coach_id = auth.uid()));
CREATE POLICY "Coaches can delete methodology themes" ON public.methodology_themes FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.coaching_methodologies m WHERE m.id = methodology_id AND m.coach_id = auth.uid()));
