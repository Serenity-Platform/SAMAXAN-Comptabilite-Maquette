// Paperasse — Types partagés côté UI onboarding

export type Address = {
  line1: string;
  postal_code: string;
  city: string;
  country: string;
};

export type President = {
  name: string;
  role: string;
};

export type SireneResult = {
  name: string;
  legal_form: string;
  siren: string;
  siret: string;
  rcs: string | null;
  naf: string | null;
  address: Address;
  president: President | null;
  active: boolean;
  date_creation: string | null;
  categorie_entreprise: string | null;
  nombre_etablissements: number | null;
  _sirene_raw: {
    nature_juridique: string;
    activite_principale: string;
    date_mise_a_jour: string | null;
  };
};

export type SireneApiResponse =
  | { ok: true; data: SireneResult; warnings: string[] }
  | { error: string; message?: string; upstream_status?: number; suggested?: SireneResult };

export type RegimeTVA = "franchise" | "reel_simplifie" | "reel_normal";
export type RegimeIS = "micro_entreprise" | "reel_simplifie" | "reel_normal" | "is_non_assujetti";
export type LegalForm = "SAS" | "SASU" | "SARL" | "EURL" | "SA" | "SCI" | "SNC" | "SELARL" | "SCP" | "AUTRE";

export type OnboardingState = {
  // Step 1 — Identité
  siren: string;
  name: string;
  legal_form: LegalForm;
  siret: string;
  naf: string;
  rcs: string;
  capital_amount: number;
  address: Address;
  president: President;
  active: boolean;
  date_creation: string | null;
  categorie_entreprise: string | null;
  sirenePreviewLoaded: boolean;
  // Step 2 — Fiscal
  regime_tva: RegimeTVA;
  regime_is: RegimeIS;
  fiscal_year_start: string; // ISO YYYY-MM-DD
  fiscal_year_end: string;
  // Step 3 — Facturation
  invoicing_prefix: string;
  invoicing_avoir_prefix: string;
  invoicing_next_number: number;
  // Step 4 — Équipe
  team_emails: string[];
  // Step 5 — Serenity
  link_serenity_user: boolean;
  serenity_user_id: string | null;
};

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  siren: "",
  name: "",
  legal_form: "SAS",
  siret: "",
  naf: "",
  rcs: "",
  capital_amount: 0,
  address: { line1: "", postal_code: "", city: "", country: "FR" },
  president: { name: "", role: "" },
  active: true,
  date_creation: null,
  categorie_entreprise: null,
  sirenePreviewLoaded: false,
  regime_tva: "franchise",
  regime_is: "reel_simplifie",
  fiscal_year_start: `${new Date().getFullYear()}-01-01`,
  fiscal_year_end: `${new Date().getFullYear()}-12-31`,
  invoicing_prefix: "F",
  invoicing_avoir_prefix: "AV",
  invoicing_next_number: 1,
  team_emails: [],
  link_serenity_user: false,
  serenity_user_id: null,
};
