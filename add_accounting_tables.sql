-- Table pour les clients externes (non inscrits dans l'app)
CREATE TABLE IF NOT EXISTS external_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table pour les entrées comptables mensuelles
CREATE TABLE IF NOT EXISTS accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  external_client_id UUID REFERENCES external_clients(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- Format YYYY-MM-01
  sessions_planned INTEGER DEFAULT 0,
  sessions_done INTEGER DEFAULT 0,
  sessions_paid INTEGER DEFAULT 0,
  payment_type TEXT CHECK (payment_type IN ('espèces', 'virement', 'mixte')),
  amount_cash DECIMAL(10,2) DEFAULT 0,
  amount_transfer DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_client_type CHECK (
    (client_id IS NOT NULL AND external_client_id IS NULL) OR
    (client_id IS NULL AND external_client_id IS NOT NULL)
  )
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_accounting_entries_coach_month ON accounting_entries(coach_id, month);
CREATE INDEX IF NOT EXISTS idx_external_clients_coach ON external_clients(coach_id);

-- RLS Policies pour external_clients
ALTER TABLE external_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view their own external clients"
  ON external_clients FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches can insert their own external clients"
  ON external_clients FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches can update their own external clients"
  ON external_clients FOR UPDATE
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches can delete their own external clients"
  ON external_clients FOR DELETE
  USING (auth.uid() = coach_id);

-- RLS Policies pour accounting_entries
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view their own accounting entries"
  ON accounting_entries FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Coaches can insert their own accounting entries"
  ON accounting_entries FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches can update their own accounting entries"
  ON accounting_entries FOR UPDATE
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches can delete their own accounting entries"
  ON accounting_entries FOR DELETE
  USING (auth.uid() = coach_id);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour accounting_entries
CREATE TRIGGER update_accounting_entries_updated_at
  BEFORE UPDATE ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE external_clients IS 'Clients externes non inscrits dans l''application';
COMMENT ON TABLE accounting_entries IS 'Entrées comptables mensuelles par client pour le suivi des revenus';
