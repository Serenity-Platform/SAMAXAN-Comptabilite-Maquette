// Paperasse - Types partagés alignés sur le GLOSSAIRE CANONIQUE
// Ces types reflètent exactement les entités DB compta.* et leurs statuts.
// Les libellés UI francophones sont gérés ailleurs (UX_PRODUCT_BLUEPRINT.md).

export type Uuid = string;
export type Iso8601 = string;
export type IsoDate = string;

// ----- Statuts (verrouillés) ---------------------------------------------

export type AccountingProposalStatus =
  | "draft"
  | "review_required"
  | "reviewed"
  | "rejected"
  | "ready_to_post";

export type JournalEntryStatus = "posted" | "locked" | "reversed";
// D014 : pas de 'draft' — les drafts vivent dans accounting_proposals.

export type AccountingPeriodStatus = "open" | "locked" | "reopened";
export type FiscalYearStatus = "open" | "closing" | "closed";
export type TaxPeriodStatus = "open" | "declared" | "paid" | "locked";

export type Role = "platform_admin" | "tenant_owner" | "accountant" | "viewer";
export type ScopeType = "tenant" | "legal_entity" | "module";

export type LegalForm =
  | "SAS" | "SASU" | "SARL" | "EURL" | "SA" | "SNC" | "SCI" | "SELARL" | "SCP" | "AUTRE";

export type RegimeTva = "franchise" | "reel_simplifie" | "reel_normal" | "mini_reel";
export type RegimeIs = "reel_simplifie" | "reel_normal" | "ir_transparent";

export type ConfidenceLevel = "low" | "medium" | "high";

// ----- Entités (subset pour Lot 0 — étoffées Lot 1+) --------------------

export interface Tenant {
  id: Uuid;
  name: string;
  status: "active" | "suspended" | "archived";
  settings: TenantSettings;
  created_by: Uuid;
  created_at: Iso8601;
  updated_at: Iso8601;
}

export interface TenantSettings {
  confidence_thresholds: { low: number; high: number };
  auto_post_amount_cap: number;
  auto_post_legal_entity_age_days_min: number;
}

export interface Address {
  line1: string;
  line2?: string;
  postal_code: string;
  city: string;
  country: string;
}

export interface President {
  name: string;
  role: string;
}

export interface LegalEntity {
  id: Uuid;
  tenant_id: Uuid;
  name: string;
  legal_form: LegalForm;
  siren: string;
  siret: string;
  rcs?: string | null;
  naf?: string | null;
  capital_amount: number;
  capital_currency: string;
  address: Address;
  president?: President | null;
  regime_tva: RegimeTva;
  regime_is: RegimeIs;
  fiscal_year_start_day: number;
  fiscal_year_start_month: number;
  invoicing_config: InvoicingConfig;
  serenity_user_id?: Uuid | null;
  status: "active" | "inactive" | "archived";
  created_at: Iso8601;
  updated_at: Iso8601;
}

export interface InvoicingConfig {
  prefix: string;
  separator: string;
  year_format: "YYYY" | "YY";
  avoir_prefix: string;
  next_numbers: Record<string, number>;
}

export interface ProposedLine {
  account_pcg: string;
  debit: number;
  credit: number;
  label?: string;
  analytical_code?: string;
}

export interface RuleApplication {
  rule_id: Uuid;
  rule_code: string;
  rule_version: string;
  context_snapshot: Record<string, unknown>;
  result: Record<string, unknown>;
  applied_at: Iso8601;
}

export interface AccountingProposal {
  id: Uuid;
  tenant_id: Uuid;
  legal_entity_id: Uuid;
  fiscal_year_id?: Uuid | null;
  accounting_period_id?: Uuid | null;
  journal_id?: Uuid | null;
  source_event_id: Uuid;
  source_document_id?: Uuid | null;
  status: AccountingProposalStatus;
  proposed_lines: ProposedLine[];
  confidence_score?: number | null;
  confidence_level?: ConfidenceLevel | null;
  rule_applications: RuleApplication[];
  created_at: Iso8601;
  updated_at: Iso8601;
}

export interface JournalEntry {
  id: Uuid;
  tenant_id: Uuid;
  legal_entity_id: Uuid;
  fiscal_year_id: Uuid;
  accounting_period_id: Uuid;
  journal_id: Uuid;
  accounting_proposal_id?: Uuid | null;
  source_event_id: Uuid;
  source_document_id?: Uuid | null;
  entry_date: IsoDate;
  piece_reference: string;
  description?: string | null;
  status: JournalEntryStatus;
  locked_at?: Iso8601 | null;
  locked_by?: Uuid | null;
  reverses_id?: Uuid | null;
  reversed_by_id?: Uuid | null;
  rule_applications: RuleApplication[];
  posted_by: Uuid;
  posted_at: Iso8601;
  created_at: Iso8601;
  updated_at: Iso8601;
}

export interface JournalEntryLine {
  id: Uuid;
  journal_entry_id: Uuid;
  tenant_id: Uuid;
  legal_entity_id: Uuid;
  account_pcg: string;
  account_label?: string | null;
  debit: number;
  credit: number;
  label?: string | null;
  analytical_code?: string | null;
  position: number;
  created_at: Iso8601;
}
