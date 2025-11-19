-- Script pour recalculer les métriques cardio pour les séances existantes
-- À exécuter après avoir appliqué la migration add_cardio_metrics_to_training_sessions.sql

-- Fonction helper pour calculer les métriques d'une séance cardio
CREATE OR REPLACE FUNCTION calculate_cardio_metrics(
  cardio_content_json TEXT,
  athlete_vma DECIMAL
)
RETURNS TABLE (
  total_distance_km DECIMAL,
  total_duration_minutes DECIMAL,
  average_intensity DECIMAL
) AS $$
DECLARE
  cardio_data JSON;
  steps JSON;
  blocks JSON;
  step JSON;
  block JSON;
  block_steps JSON;
  total_distance_m DECIMAL := 0;
  total_duration_s DECIMAL := 0;
  total_intensity_weighted DECIMAL := 0;
  total_running_duration DECIMAL := 0;
  step_duration DECIMAL;
  step_distance DECIMAL;
  speed_kmh DECIMAL;
  walking_speed_kmh DECIMAL := 4;
  repetitions INT;
BEGIN
  -- Parser le JSON
  cardio_data := cardio_content_json::JSON;
  steps := cardio_data->'steps';
  blocks := cardio_data->'blocks';

  -- Traiter les blocs
  IF blocks IS NOT NULL THEN
    FOR block IN SELECT * FROM json_array_elements(blocks)
    LOOP
      repetitions := (block->>'repetitions')::INT;
      
      -- Traiter chaque step du bloc
      FOR step IN 
        SELECT * FROM json_array_elements(steps)
        WHERE (value->>'block_id') = (block->>'id')
      LOOP
        step_duration := 0;
        step_distance := 0;
        
        -- Calculer selon le type d'effort
        IF (step->>'effort_type') = 'duration' THEN
          step_duration := (step->>'duration')::DECIMAL;
          
          -- Calculer la distance
          IF (step->>'movement_type') = 'marche' THEN
            step_distance := (walking_speed_kmh * (step_duration / 3600)) * 1000;
          ELSIF athlete_vma IS NOT NULL AND (step->>'vma_percentage') IS NOT NULL THEN
            speed_kmh := athlete_vma * ((step->>'vma_percentage')::DECIMAL / 100);
            step_distance := (speed_kmh * (step_duration / 3600)) * 1000;
          END IF;
        ELSIF (step->>'effort_type') = 'distance' THEN
          step_distance := (step->>'distance')::DECIMAL;
          
          -- Calculer la durée
          IF (step->>'movement_type') = 'marche' THEN
            step_duration := (step_distance / 1000 / walking_speed_kmh) * 3600;
          ELSIF athlete_vma IS NOT NULL AND (step->>'vma_percentage') IS NOT NULL THEN
            speed_kmh := athlete_vma * ((step->>'vma_percentage')::DECIMAL / 100);
            step_duration := (step_distance / 1000 / speed_kmh) * 3600;
          END IF;
        END IF;
        
        -- Ajouter à l'intensité pondérée (seulement pour la course)
        IF (step->>'movement_type') <> 'marche' AND (step->>'vma_percentage') IS NOT NULL THEN
          total_intensity_weighted := total_intensity_weighted + ((step->>'vma_percentage')::DECIMAL * step_duration * repetitions);
          total_running_duration := total_running_duration + (step_duration * repetitions);
        END IF;
        
        -- Multiplier par les répétitions
        total_duration_s := total_duration_s + (step_duration * repetitions);
        total_distance_m := total_distance_m + (step_distance * repetitions);
      END LOOP;
    END LOOP;
  END IF;

  -- Traiter les steps individuels (sans bloc)
  IF steps IS NOT NULL THEN
    FOR step IN 
      SELECT * FROM json_array_elements(steps)
      WHERE (value->>'block_id') IS NULL
    LOOP
      step_duration := 0;
      step_distance := 0;
      
      -- Calculer selon le type d'effort
      IF (step->>'effort_type') = 'duration' THEN
        step_duration := (step->>'duration')::DECIMAL;
        
        -- Calculer la distance
        IF (step->>'movement_type') = 'marche' THEN
          step_distance := (walking_speed_kmh * (step_duration / 3600)) * 1000;
        ELSIF athlete_vma IS NOT NULL AND (step->>'vma_percentage') IS NOT NULL THEN
          speed_kmh := athlete_vma * ((step->>'vma_percentage')::DECIMAL / 100);
          step_distance := (speed_kmh * (step_duration / 3600)) * 1000;
        END IF;
      ELSIF (step->>'effort_type') = 'distance' THEN
        step_distance := (step->>'distance')::DECIMAL;
        
        -- Calculer la durée
        IF (step->>'movement_type') = 'marche' THEN
          step_duration := (step_distance / 1000 / walking_speed_kmh) * 3600;
        ELSIF athlete_vma IS NOT NULL AND (step->>'vma_percentage') IS NOT NULL THEN
          speed_kmh := athlete_vma * ((step->>'vma_percentage')::DECIMAL / 100);
          step_duration := (step_distance / 1000 / speed_kmh) * 3600;
        END IF;
      END IF;
      
      -- Ajouter à l'intensité pondérée (seulement pour la course)
      IF (step->>'movement_type') <> 'marche' AND (step->>'vma_percentage') IS NOT NULL THEN
        total_intensity_weighted := total_intensity_weighted + ((step->>'vma_percentage')::DECIMAL * step_duration);
        total_running_duration := total_running_duration + step_duration;
      END IF;
      
      total_duration_s := total_duration_s + step_duration;
      total_distance_m := total_distance_m + step_distance;
    END LOOP;
  END IF;

  -- Retourner les résultats
  RETURN QUERY SELECT
    ROUND((total_distance_m / 1000)::NUMERIC, 2) as total_distance_km,
    ROUND((total_duration_s / 60)::NUMERIC, 2) as total_duration_minutes,
    CASE 
      WHEN total_running_duration > 0 THEN ROUND((total_intensity_weighted / total_running_duration)::NUMERIC, 2)
      ELSE 0
    END as average_intensity;
END;
$$ LANGUAGE plpgsql;

-- Mettre à jour toutes les séances cardio existantes qui n'ont pas encore de métriques calculées
UPDATE training_sessions ts
SET 
  cardio_total_distance_km = metrics.total_distance_km,
  cardio_total_duration_minutes = metrics.total_duration_minutes,
  cardio_average_intensity = metrics.average_intensity
FROM (
  SELECT 
    ts.id,
    (calculate_cardio_metrics(se.cardio_content, up.vma)).*
  FROM training_sessions ts
  INNER JOIN session_exercises se ON se.session_id = ts.id
  INNER JOIN training_weeks tw ON tw.id = ts.week_id
  INNER JOIN user_profiles up ON up.id = tw.athlete_id
  WHERE se.cardio_content IS NOT NULL
    AND se.cardio_sport = 'course'
    AND ts.cardio_total_distance_km IS NULL
) AS metrics
WHERE ts.id = metrics.id;

-- Nettoyer la fonction helper
DROP FUNCTION calculate_cardio_metrics(TEXT, DECIMAL);

-- Afficher le nombre de séances mises à jour
SELECT COUNT(*) as "Séances mises à jour"
FROM training_sessions
WHERE cardio_total_distance_km IS NOT NULL;
