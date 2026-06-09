-- Supprime l'ancienne version à 4 arguments (sinon surcharge ambiguë sur GRANT/REVOKE)
DROP FUNCTION IF EXISTS update_athlete_physio(uuid, numeric, integer, integer);

-- Ajoute le niveau de course de l'athlète (utilisé pour les estimations de chrono)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS running_level text DEFAULT NULL;

-- Met à jour la fonction RPC update_athlete_physio pour enregistrer aussi le niveau
CREATE OR REPLACE FUNCTION update_athlete_physio(
  p_athlete_id uuid,
  p_vma numeric DEFAULT NULL,
  p_fc_max integer DEFAULT NULL,
  p_fc_repos integer DEFAULT NULL,
  p_running_level text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_profiles
  SET
    vma                 = COALESCE(p_vma,     vma),
    fc_max              = COALESCE(p_fc_max,  fc_max),
    fc_repos            = COALESCE(p_fc_repos, fc_repos),
    running_level       = COALESCE(p_running_level, running_level),
    fc_max_updated_at   = CASE WHEN p_fc_max  IS NOT NULL THEN now() ELSE fc_max_updated_at  END,
    fc_repos_updated_at = CASE WHEN p_fc_repos IS NOT NULL THEN now() ELSE fc_repos_updated_at END
  WHERE id = p_athlete_id;
END;
$$;

-- Accorder les permissions d'exécution aux utilisateurs authentifiés (signature qualifiée)
GRANT EXECUTE ON FUNCTION update_athlete_physio(uuid, numeric, integer, integer, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION update_athlete_physio(uuid, numeric, integer, integer, text) FROM anon;
