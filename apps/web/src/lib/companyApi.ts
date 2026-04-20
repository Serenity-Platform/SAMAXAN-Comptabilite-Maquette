// Paperasse — Client pour édition legal_entity via wrapper public.fn_update_legal_entity
import { getSupabase } from "./supabaseClient";

export type LegalEntityPatch = Partial<{
  name: string;
  legal_form: string;
  rcs: string;
  naf: string;
  capital_amount: number;
  capital_currency: string;
  address: { line1: string; line2?: string; postal_code: string; city: string; country: string };
  president: { name: string; role: string };
  regime_tva: "franchise" | "reel_simplifie" | "reel_normal" | "mini_reel";
  regime_is: "reel_simplifie" | "reel_normal" | "ir_transparent";
  fiscal_year_start_day: number;
  fiscal_year_start_month: number;
  invoicing_config: Record<string, unknown>;
  payment_config: Record<string, unknown>;
  einvoicing_config: Record<string, unknown>;
  banks: Record<string, unknown>;
}>;

export type UpdateLegalEntityResult =
  | { ok: true; data: { legal_entity_id: string; updated_fields: string[]; updated_at: string } }
  | { ok: false; error: string; message?: string };

export async function updateLegalEntity(
  legalEntityId: string,
  patch: LegalEntityPatch,
): Promise<UpdateLegalEntityResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("fn_update_legal_entity", {
    p_legal_entity_id: legalEntityId,
    p_patch: patch,
  });
  if (error) {
    const code = error.code ?? "";
    let kind = "unexpected_error";
    if (code === "42501") kind = "forbidden";
    else if (code === "23514") kind = "invalid_payload";
    else if (code === "02000") kind = "not_found";
    return { ok: false, error: kind, message: error.message };
  }
  return { ok: true, data: data as { legal_entity_id: string; updated_fields: string[]; updated_at: string } };
}
