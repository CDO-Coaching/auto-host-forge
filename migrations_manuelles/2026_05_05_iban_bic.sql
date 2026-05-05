-- À EXÉCUTER MANUELLEMENT sur l'instance Supabase self-hostée (Coolify)
-- Ajoute les champs IBAN/BIC au profil coach et snapshot sur les factures.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS bic text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS coach_iban text,
  ADD COLUMN IF NOT EXISTS coach_bic text;

NOTIFY pgrst, 'reload schema';
