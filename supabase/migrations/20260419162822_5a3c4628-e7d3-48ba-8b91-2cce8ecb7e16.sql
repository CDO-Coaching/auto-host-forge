-- =========================================
-- Système de facturation URSSAF (micro-entrepreneur)
-- =========================================

-- 1. Compteur de factures par coach et par année (numérotation chronologique sans rupture, obligation légale)
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, year)
);

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches manage own counters"
  ON public.invoice_counters
  FOR ALL
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- 2. Table des factures émises (archive légale - inaltérables)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  invoice_number TEXT NOT NULL, -- ex: FACT-2026-0001
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  service_period_start DATE NOT NULL,
  service_period_end DATE NOT NULL,

  -- Émetteur (figé au moment de l'émission)
  coach_name TEXT NOT NULL,
  coach_address TEXT,
  coach_siret TEXT,
  coach_phone TEXT,
  coach_email TEXT,

  -- Destinataire (figé au moment de l'émission)
  client_id UUID,
  external_client_id UUID,
  client_name TEXT NOT NULL,
  client_address TEXT,

  -- Montants (en euros, micro-entrepreneur => TVA non applicable)
  sessions_count INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(10,2),
  total_amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('especes', 'virement')),
  payment_date DATE,

  -- Statut
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),

  -- Données complémentaires (snapshot écritures comptables)
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS invoices_coach_period_idx ON public.invoices (coach_id, service_period_start);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches view own invoices"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches insert own invoices"
  ON public.invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid());

-- Pas d'UPDATE/DELETE => factures inaltérables (obligation légale).
-- L'annulation se fait par création d'une facture d'avoir.

-- 3. Fonction atomique pour réserver le prochain numéro de facture (concurrence-safe)
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_coach_id UUID, p_year INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  IF auth.uid() <> p_coach_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.invoice_counters (coach_id, year, last_number)
  VALUES (p_coach_id, p_year, 1)
  ON CONFLICT (coach_id, year)
  DO UPDATE SET last_number = invoice_counters.last_number + 1,
                updated_at = now()
  RETURNING last_number INTO v_next;

  RETURN v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_invoice_number(UUID, INTEGER) TO authenticated;