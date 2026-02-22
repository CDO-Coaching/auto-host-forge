import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://supabasekong.cdocoaching.com';
const SUPABASE_ANON_KEY = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc1ODUzMDc2MCwiZXhwIjo0OTE0MjA0MzYwLCJyb2xlIjoiYW5vbiJ9.pJHSOerGt6DBqFOaS_fP9esFcxHKGC5U6dik4h06FBQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'sb-cdo-auth-token',
  }
});
