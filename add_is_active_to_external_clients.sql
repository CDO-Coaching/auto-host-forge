-- Ajouter une colonne is_active pour gérer l'état actif/inactif des clients externes
ALTER TABLE external_clients 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Commenter la colonne
COMMENT ON COLUMN external_clients.is_active IS 'Indique si le client externe est actif (visible dans la comptabilité) ou inactif';

-- Index pour améliorer les performances des requêtes filtrant par is_active
CREATE INDEX IF NOT EXISTS idx_external_clients_is_active ON external_clients(is_active);
