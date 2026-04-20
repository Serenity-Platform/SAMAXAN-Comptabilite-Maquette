// Paperasse — Client Edge Function compta-onboarding-submit (Lot 1.3)
import { config } from "./config";
import { getSupabase } from "./supabaseClient";
import type { OnboardingState } from "./types";

export type OnboardingSuccessData = {
  tenant_id: string;
  legal_entity_id: string;
  fiscal_year_id: string;
  journals_count: number;
  periods_count: number;
  fiscal_year_start: string;
  fiscal_year_end: string;
};

export type OnboardingSubmitResult =
  | { ok: true; data: OnboardingSuccessData }
  | {
      ok: false;
      error: string;
      message?: string;
      details?: string[];
      status?: number;
    };

export async function submitOnboarding(state: OnboardingState): Promise<OnboardingSubmitResult> {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return { ok: false, error: "unauthorized", message: "Session expirée, reconnectez-vous" };
  }

  const year = new Date().getFullYear();
  const payload = {
    tenant_name: state.name,
    legal_entity: {
      name: state.name,
      legal_form: state.legal_form,
      siren: state.siren,
      siret: state.siret,
      rcs: state.rcs || null,
      naf: state.naf,
      capital_amount: state.capital_amount,
      address: state.address,
      president: state.president,
      regime_tva: state.regime_tva,
      regime_is: state.regime_is,
      invoicing_config: {
        prefix: state.invoicing_prefix,
        avoir_prefix: state.invoicing_avoir_prefix,
        separator: "-",
        year_format: "YYYY",
        next_numbers: { [String(year)]: state.invoicing_next_number },
      },
      serenity_user_id: state.serenity_user_id,
    },
    fiscal_year_start: state.fiscal_year_start,
    fiscal_year_end: state.fiscal_year_end,
  };

  try {
    const resp = await fetch(config.endpoints.onboardingSubmit, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: config.supabase.anonKey,
      },
      body: JSON.stringify(payload),
    });

    const json = await resp.json();

    if (resp.ok && json && json.ok === true && json.data) {
      return { ok: true, data: json.data as OnboardingSuccessData };
    }
    return {
      ok: false,
      error: String(json?.error ?? "unknown_error"),
      message: typeof json?.message === "string" ? json.message : undefined,
      details: Array.isArray(json?.details) ? (json.details as string[]) : undefined,
      status: resp.status,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: "network_error", message: msg };
  }
}
