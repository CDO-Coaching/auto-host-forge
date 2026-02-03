// Client Supabase personnalisé pour le Supabase auto-hébergé CDO Coaching
// On désactive les types stricts pour éviter les erreurs de build sur Lovable
// car le fichier de types auto-généré ne contient pas le schéma complet
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Client Supabase sans types stricts pour compatibilité avec le Supabase auto-hébergé
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
