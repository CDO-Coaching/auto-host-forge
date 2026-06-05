-- Ajoute la date de dernière saisie de FC max et FC repos dans user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS fc_max_updated_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fc_repos_updated_at timestamptz DEFAULT NULL;

-- Met à jour la fonction RPC update_athlete_physio pour enregistrer la date
CREATE OR REPLACE FUNCTION update_athlete_physio(
  p_athlete_id uuid,
  p_vma numeric DEFAULT NULL,
  p_fc_max integer DEFAULT NULL,
  p_fc_repos integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_profiles
  SET
    vma             = COALESCE(p_vma,     vma),
    fc_max          = COALESCE(p_fc_max,  fc_max),
    fc_repos        = COALESCE(p_fc_repos, fc_repos),
    fc_max_updated_at  = CASE WHEN p_fc_max  IS NOT NULL THEN now() ELSE fc_max_updated_at  END,
    fc_repos_updated_at = CASE WHEN p_fc_repos IS NOT NULL THEN now() ELSE fc_repos_updated_at END
  WHERE id = p_athlete_id;
END;
$$;
