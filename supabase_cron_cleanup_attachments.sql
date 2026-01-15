-- Migration pour configurer le nettoyage automatique des pièces jointes RGPD
-- À exécuter dans l'éditeur SQL de Supabase

-- Étape 1: Activer les extensions nécessaires (si pas déjà fait)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Étape 2: Créer une fonction qui appelle l'edge function
CREATE OR REPLACE FUNCTION public.trigger_cleanup_old_attachments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Récupérer l'URL du projet depuis les variables d'environnement
  -- Note: Remplacez par votre URL Supabase réelle
  supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- Appeler l'edge function via pg_net
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/cleanup-old-attachments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  
  RAISE NOTICE 'Cleanup old attachments triggered at %', now();
END;
$$;

-- Étape 3: Planifier le cron job pour s'exécuter le 1er de chaque mois à 3h du matin
SELECT cron.schedule(
  'cleanup-old-attachments-monthly',  -- Nom unique du job
  '0 3 1 * *',                        -- Cron expression: 3h00 le 1er de chaque mois
  $$SELECT public.trigger_cleanup_old_attachments()$$
);

-- Pour vérifier les jobs programmés:
-- SELECT * FROM cron.job;

-- Pour voir l'historique d'exécution:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Pour supprimer le job si nécessaire:
-- SELECT cron.unschedule('cleanup-old-attachments-monthly');

-- ============================================================
-- ALTERNATIVE PLUS SIMPLE (recommandée)
-- Si pg_net n'est pas disponible, utilisez cette approche:
-- ============================================================

-- Cette fonction supprime directement les anciennes pièces jointes
-- sans passer par l'edge function

CREATE OR REPLACE FUNCTION public.cleanup_old_attachments_direct()
RETURNS TABLE(deleted_count INTEGER, error_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff_date TIMESTAMPTZ;
  msg RECORD;
  file_path TEXT;
  v_deleted_count INTEGER := 0;
  v_error_count INTEGER := 0;
BEGIN
  -- Calculer la date limite (6 mois)
  cutoff_date := now() - INTERVAL '6 months';
  
  RAISE NOTICE 'Cleaning up attachments older than %', cutoff_date;
  
  -- Mettre à jour les messages avec des pièces jointes expirées
  UPDATE messages
  SET 
    attachment_url = NULL,
    attachment_type = NULL,
    content = CASE 
      WHEN content LIKE '%📹%' OR content LIKE '%📷%' 
      THEN content || ' [Pièce jointe supprimée après 6 mois - RGPD]'
      ELSE '[Pièce jointe supprimée après 6 mois - RGPD]'
    END
  WHERE 
    attachment_url IS NOT NULL 
    AND created_at < cutoff_date;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Updated % messages', v_deleted_count;
  
  -- Note: La suppression des fichiers du storage doit être faite
  -- via l'edge function car pg ne peut pas directement supprimer
  -- du storage. Les URLs seront cassées mais les fichiers restent.
  -- L'edge function est recommandée pour une suppression complète.
  
  RETURN QUERY SELECT v_deleted_count, v_error_count;
END;
$$;

-- Planifier le nettoyage direct (alternative sans edge function)
-- Décommentez si vous préférez cette approche:
/*
SELECT cron.schedule(
  'cleanup-old-attachments-direct',
  '0 3 1 * *',
  $$SELECT * FROM public.cleanup_old_attachments_direct()$$
);
*/

-- ============================================================
-- INSTRUCTIONS D'INSTALLATION
-- ============================================================
-- 
-- 1. Allez dans le Dashboard Supabase > SQL Editor
-- 2. Copiez et exécutez ce script
-- 3. Vérifiez que le job est créé: SELECT * FROM cron.job;
-- 
-- Pour la méthode avec edge function (recommandée):
-- - Vous devez configurer les variables app.settings dans Supabase
-- - Ou utiliser la méthode "direct" qui est plus simple
--
-- La méthode "direct" met à jour les messages mais ne supprime pas
-- les fichiers du storage. Pour une suppression complète des fichiers,
-- utilisez l'edge function manuellement ou via un service externe.
