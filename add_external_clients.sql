-- Migration pour ajouter les clients externes (présentiels)
-- Ces clients n'utilisent pas l'application mais apparaissent dans la comptabilité

-- Créer la table des clients externes
CREATE TABLE IF NOT EXISTS external_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Modifier la table accounting_entries pour supporter les clients externes
ALTER TABLE accounting_entries 
ADD COLUMN IF NOT EXISTS external_client_id UUID REFERENCES external_clients(id) ON DELETE CASCADE;

-- Ajouter une contrainte pour s'assurer qu'une entrée est liée soit à un client soit à un client externe (mais pas les deux)
ALTER TABLE accounting_entries
DROP CONSTRAINT IF EXISTS check_client_type;

ALTER TABLE accounting_entries
ADD CONSTRAINT check_client_type CHECK (
  (client_id IS NOT NULL AND external_client_id IS NULL) OR
  (client_id IS NULL AND external_client_id IS NOT NULL)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_external_clients_coach_id ON external_clients(coach_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_external_client_id ON accounting_entries(external_client_id);

-- RLS pour external_clients
ALTER TABLE external_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view their own external clients" ON external_clients
FOR SELECT USING (auth.uid() = coach_id);

CREATE POLICY "Coaches can insert their own external clients" ON external_clients
FOR INSERT WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches can update their own external clients" ON external_clients
FOR UPDATE USING (auth.uid() = coach_id);

CREATE POLICY "Coaches can delete their own external clients" ON external_clients
FOR DELETE USING (auth.uid() = coach_id);

-- Commenter les colonnes
COMMENT ON TABLE external_clients IS 'Clients présentiels qui n''utilisent pas l''application mais sont suivis pour la comptabilité';
COMMENT ON COLUMN external_clients.coach_id IS 'ID du coach qui gère ce client externe';
COMMENT ON COLUMN external_clients.first_name IS 'Prénom du client externe';
COMMENT ON COLUMN external_clients.last_name IS 'Nom du client externe';
COMMENT ON COLUMN external_clients.email IS 'Email du client externe (optionnel)';
COMMENT ON COLUMN accounting_entries.external_client_id IS 'Référence au client externe (présentiel) si applicable';
