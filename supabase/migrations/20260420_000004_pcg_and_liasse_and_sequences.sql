
-- ============================================================================
-- Paperasse Lot 0 - Migration 4/11
-- Tables référentielles globales (pas tenant_id) : PCG, liasse, sequences
-- ============================================================================

-- PCG ACCOUNTS (global, partagé par tous les tenants) -------------------------
CREATE TABLE compta.pcg_accounts (
  number              text PRIMARY KEY,
  label               text NOT NULL,
  system              text NOT NULL DEFAULT 'facultatif'
                      CHECK (system IN ('minimal','facultatif')),
  parent              text REFERENCES compta.pcg_accounts(number) ON DELETE SET NULL,
  pcg_version         int NOT NULL DEFAULT 2026,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE compta.pcg_accounts IS 'Paperasse - Plan Comptable Général 2026. 838 comptes seed depuis 04-PCG-2026.json. Global à tous les tenants (référentiel réglementaire, pas tenant-specific).';
COMMENT ON COLUMN compta.pcg_accounts.system IS 'minimal = obligatoire pour toutes entreprises, facultatif = optionnel selon besoins';

CREATE INDEX idx_pcg_parent ON compta.pcg_accounts (parent);
CREATE INDEX idx_pcg_system ON compta.pcg_accounts (system);

-- LIASSE CELLS 2033 (global) --------------------------------------------------
CREATE TABLE compta.liasse_cells_2033 (
  cell_id             text PRIMARY KEY,
  label               text NOT NULL,
  form                text NOT NULL,
  pcg_roots           text[],
  ordinal             smallint NOT NULL
);

COMMENT ON TABLE compta.liasse_cells_2033 IS 'Paperasse - Nomenclature des cases liasse fiscale 2033 (régime simplifié). 52 cases seed depuis 05nomenclatureliassefiscale2033.csv. form = ''2033-A'' à ''2033-G''.';

-- SEQUENCES -------------------------------------------------------------------
CREATE TABLE compta.sequences (
  id                  uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id           uuid NOT NULL REFERENCES compta.tenants(id) ON DELETE CASCADE,
  legal_entity_id     uuid NOT NULL REFERENCES compta.legal_entities(id) ON DELETE CASCADE,
  sequence_name       text NOT NULL,
  year                smallint NOT NULL,
  next_value          bigint NOT NULL DEFAULT 1 CHECK (next_value >= 1),
  prefix              text,
  separator           text NOT NULL DEFAULT '-',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (legal_entity_id, sequence_name, year)
);

COMMENT ON TABLE compta.sequences IS 'Paperasse - Séquences déterministes (factures, avoirs, pièces comptables). Reset au 1er janvier via création nouvelle ligne (legal_entity_id, sequence_name, nouvelle year).';

CREATE INDEX idx_sequences_legal_entity ON compta.sequences (legal_entity_id, sequence_name);

CREATE TRIGGER tg_sequences_touch_updated_at
  BEFORE UPDATE ON compta.sequences
  FOR EACH ROW EXECUTE FUNCTION compta.fn_touch_updated_at();

-- Fonction atomique pour obtenir le prochain numéro ---------------------------
CREATE OR REPLACE FUNCTION compta.fn_next_sequence(
  p_tenant_id uuid,
  p_legal_entity_id uuid,
  p_sequence_name text,
  p_year smallint
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = compta, public
AS $$
DECLARE
  v_next bigint;
BEGIN
  INSERT INTO compta.sequences (tenant_id, legal_entity_id, sequence_name, year, next_value)
  VALUES (p_tenant_id, p_legal_entity_id, p_sequence_name, p_year, 2)
  ON CONFLICT (legal_entity_id, sequence_name, year)
  DO UPDATE SET next_value = compta.sequences.next_value + 1,
                updated_at = now()
  RETURNING next_value - 1 INTO v_next;
  RETURN v_next;
END;
$$;

COMMENT ON FUNCTION compta.fn_next_sequence IS 'Paperasse - Atomique (ON CONFLICT UPDATE). Retourne le numéro à utiliser et incrémente le compteur. Usage: SELECT compta.fn_next_sequence(tenant_id, legal_entity_id, ''invoice'', 2026);';
