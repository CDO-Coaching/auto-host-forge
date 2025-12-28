-- Migration pour ajouter les dossiers aux séances programmées
-- À exécuter dans votre Supabase auto-hébergé via l'interface SQL Editor

-- Table pour les dossiers de séances programmées
CREATE TABLE IF NOT EXISTS public.session_template_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('renfo', 'course', 'velo', 'natation')),
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Ajouter la colonne folder_id à session_templates
ALTER TABLE public.session_templates
ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.session_template_folders(id) ON DELETE SET NULL;

-- RLS policies pour session_template_folders
ALTER TABLE public.session_template_folders ENABLE ROW LEVEL SECURITY;

-- Les coachs peuvent voir leurs propres dossiers
CREATE POLICY "Coaches can view their own folders"
  ON public.session_template_folders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = coach_id);

-- Les coachs peuvent créer leurs propres dossiers
CREATE POLICY "Coaches can create their own folders"
  ON public.session_template_folders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id);

-- Les coachs peuvent modifier leurs propres dossiers
CREATE POLICY "Coaches can update their own folders"
  ON public.session_template_folders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = coach_id);

-- Les coachs peuvent supprimer leurs propres dossiers
CREATE POLICY "Coaches can delete their own folders"
  ON public.session_template_folders
  FOR DELETE
  TO authenticated
  USING (auth.uid() = coach_id);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS session_template_folders_coach_id_idx ON public.session_template_folders(coach_id);
CREATE INDEX IF NOT EXISTS session_template_folders_category_idx ON public.session_template_folders(category);
CREATE INDEX IF NOT EXISTS session_templates_folder_id_idx ON public.session_templates(folder_id);

-- Commentaires sur les tables
COMMENT ON TABLE public.session_template_folders IS 'Dossiers pour organiser les templates de séances';
COMMENT ON COLUMN public.session_templates.folder_id IS 'Dossier parent du template (optionnel)';
