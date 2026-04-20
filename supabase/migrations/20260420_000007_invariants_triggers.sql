
-- ============================================================================
-- Paperasse Lot 0 - Migration 7/11
-- Triggers d'invariants du socle comptable non négociable
--   - Partie double stricte (équilibre D=C au post)
--   - Immutabilité des écritures posted (interdit UPDATE/DELETE sur lines si parent immuable)
--   - Verrouillage période (locked persisté D001) : propagation au changement d'accounting_period.status
-- ============================================================================

-- 1) ÉQUILIBRE DEBIT = CREDIT au passage en status=posted -----------------------
CREATE OR REPLACE FUNCTION compta.fn_assert_balanced(p_entry_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_total_debit numeric(18,2);
  v_total_credit numeric(18,2);
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
    INTO v_total_debit, v_total_credit
    FROM compta.journal_entry_lines
    WHERE journal_entry_id = p_entry_id;
  RETURN v_total_debit = v_total_credit AND v_total_debit > 0;
END;
$$;

COMMENT ON FUNCTION compta.fn_assert_balanced IS 'Paperasse - Vérifie l''équilibre D=C > 0 sur les lignes d''une journal_entry. Appelée par trigger BEFORE UPDATE quand status passe à posted.';

CREATE OR REPLACE FUNCTION compta.fn_enforce_balanced_on_post()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Lors d'un INSERT status=posted ou UPDATE vers status=posted, vérifier équilibre
  IF (TG_OP = 'INSERT' AND NEW.status = 'posted') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'posted' AND (OLD.status IS DISTINCT FROM 'posted')) THEN
    IF NOT compta.fn_assert_balanced(NEW.id) THEN
      RAISE EXCEPTION 'Journal entry % is not balanced (debit != credit or both zero)', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger attaché AFTER INSERT/UPDATE (pour avoir les lignes déjà insérées)
-- Note: en pratique l'insertion d'une écriture posted se fait en transaction
-- avec ses lignes, donc BEFORE UPDATE fonctionne. Pour INSERT posted direct,
-- il faut que les lignes soient insérées D'ABORD, puis UPDATE status.
-- Pattern recommandé au Lot 2/3 : INSERT status='draft' + lignes + UPDATE status='posted'.

CREATE CONSTRAINT TRIGGER tg_journal_entries_balanced
  AFTER INSERT OR UPDATE OF status ON compta.journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION compta.fn_enforce_balanced_on_post();

-- 2) IMMUTABILITÉ DES ÉCRITURES posted/locked/reversed -------------------------
CREATE OR REPLACE FUNCTION compta.fn_enforce_immutability_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- UPDATE: seules les transitions autorisées sur status sont permises
  IF TG_OP = 'UPDATE' THEN
    -- Autorisation du changement de status: posted -> {locked, reversed}, locked -> posted (réouverture platform_admin)
    IF OLD.status = 'posted' AND NEW.status NOT IN ('posted','locked','reversed') THEN
      RAISE EXCEPTION 'Cannot change journal_entry % status from posted to %: only locked or reversed allowed', OLD.id, NEW.status
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF OLD.status = 'locked' AND NEW.status NOT IN ('locked','posted') THEN
      RAISE EXCEPTION 'Cannot change journal_entry % status from locked to %: only posted (reopened) allowed', OLD.id, NEW.status
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF OLD.status = 'reversed' AND NEW.status != 'reversed' THEN
      RAISE EXCEPTION 'Cannot change journal_entry % status from reversed (terminal)', OLD.id
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    -- Pas d'édition des montants / compte / période une fois posted
    -- (le status peut changer selon les transitions ci-dessus, le reste est immuable)
    IF OLD.status IN ('posted','locked','reversed') THEN
      IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id OR
         OLD.legal_entity_id IS DISTINCT FROM NEW.legal_entity_id OR
         OLD.fiscal_year_id IS DISTINCT FROM NEW.fiscal_year_id OR
         OLD.accounting_period_id IS DISTINCT FROM NEW.accounting_period_id OR
         OLD.journal_id IS DISTINCT FROM NEW.journal_id OR
         OLD.entry_date IS DISTINCT FROM NEW.entry_date OR
         OLD.source_event_id IS DISTINCT FROM NEW.source_event_id THEN
        RAISE EXCEPTION 'Journal entry % is immutable once %: cannot modify core fields', OLD.id, OLD.status
          USING ERRCODE = 'invalid_parameter_value';
      END IF;
    END IF;
  END IF;
  -- DELETE interdit une fois posted
  IF TG_OP = 'DELETE' AND OLD.status IN ('posted','locked','reversed') THEN
    RAISE EXCEPTION 'Cannot delete journal_entry % in status %: use reversed instead', OLD.id, OLD.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER tg_journal_entries_immutability
  BEFORE UPDATE OR DELETE ON compta.journal_entries
  FOR EACH ROW EXECUTE FUNCTION compta.fn_enforce_immutability_entry();

-- 3) IMMUTABILITÉ DES LIGNES quand parent est posted/locked/reversed -----------
CREATE OR REPLACE FUNCTION compta.fn_enforce_immutability_line()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_status text;
BEGIN
  SELECT status INTO v_parent_status
    FROM compta.journal_entries
    WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  IF v_parent_status IN ('posted','locked','reversed') THEN
    -- Autoriser INSERT uniquement si le parent vient tout juste d'être créé posted
    -- (les lignes doivent pouvoir être insérées en même transaction que l'entry)
    -- On ne bloque pas INSERT, on bloque UPDATE et DELETE
    IF TG_OP IN ('UPDATE','DELETE') THEN
      RAISE EXCEPTION 'Cannot modify journal_entry_lines of a % entry', v_parent_status
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER tg_journal_entry_lines_immutability
  BEFORE UPDATE OR DELETE ON compta.journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION compta.fn_enforce_immutability_line();

-- 4) LOCKED PERSISTÉ (D001) : propagation accounting_period → journal_entries --
CREATE OR REPLACE FUNCTION compta.fn_propagate_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Période passe de open/reopened → locked : propager à toutes les entries
  IF OLD.status IN ('open','reopened') AND NEW.status = 'locked' THEN
    UPDATE compta.journal_entries
      SET status = 'locked',
          locked_at = NEW.locked_at,
          locked_by = NEW.locked_by
      WHERE accounting_period_id = NEW.id
        AND status = 'posted';
  -- Période passe de locked → reopened : re-ouvrir les entries locked
  ELSIF OLD.status = 'locked' AND NEW.status = 'reopened' THEN
    UPDATE compta.journal_entries
      SET status = 'posted',
          locked_at = NULL,
          locked_by = NULL
      WHERE accounting_period_id = NEW.id
        AND status = 'locked';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_accounting_periods_propagate_lock
  AFTER UPDATE OF status ON compta.accounting_periods
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION compta.fn_propagate_period_lock();

-- 5) EMPÊCHER CRÉATION D'ENTRIES DANS UNE PÉRIODE LOCKED -----------------------
CREATE OR REPLACE FUNCTION compta.fn_prevent_entry_in_locked_period()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_period_status text;
BEGIN
  SELECT status INTO v_period_status
    FROM compta.accounting_periods
    WHERE id = NEW.accounting_period_id;
  IF v_period_status = 'locked' THEN
    RAISE EXCEPTION 'Cannot insert journal_entry into locked accounting_period %', NEW.accounting_period_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_journal_entries_prevent_locked_period
  BEFORE INSERT ON compta.journal_entries
  FOR EACH ROW EXECUTE FUNCTION compta.fn_prevent_entry_in_locked_period();
