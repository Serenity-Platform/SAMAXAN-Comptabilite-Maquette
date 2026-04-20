// Paperasse Lot 2.1 - Client API Banque (Revolut Business)
import { config } from "./config";
import { getSupabase } from "./supabaseClient";

export type BankIntegration = {
  id: string;
  provider: "revolut_business";
  status: "pending" | "connected" | "expired" | "revoked" | "error";
  accounts: RevolutAccount[];
  scopes: string[];
  last_sync_at: string | null;
  last_sync_error: string | null;
  last_sync_tx_count: number;
  connected_at: string | null;
  disconnected_at: string | null;
};

export type RevolutAccount = {
  id: string;
  name?: string;
  balance?: number;
  currency: string;
  state: string;
};

export type SyncResult =
  | {
      ok: true;
      data: {
        new_events: number;
        new_proposals: number;
        skipped_duplicates: number;
        auto_ready_to_post: number;
        review_required: number;
        last_sync_at: string;
      };
    }
  | { ok: false; error: string; message?: string };

async function authedHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
    apikey: config.supabase.anonKey,
  };
}

export async function listBankIntegrations(): Promise<BankIntegration[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("fn_list_bank_integrations");
  if (error) throw new Error(error.message);
  return (data ?? []) as BankIntegration[];
}

export async function disconnectBankIntegration(integrationId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("fn_disconnect_bank_integration", {
    p_integration_id: integrationId,
  });
  if (error) throw new Error(error.message);
}

/** Démarre le flow OAuth : récupère l'URL d'autorisation et redirige le navigateur. */
export async function startRevolutOAuth(): Promise<{ ok: true; authorize_url: string } | { ok: false; error: string; message?: string }> {
  const headers = await authedHeaders();
  if (!headers.Authorization) return { ok: false, error: "not_authenticated" };

  const resp = await fetch(`${config.supabase.url}/functions/v1/compta-revolut-oauth-start`, {
    method: "POST",
    headers,
    body: "{}",
  });
  const json = await resp.json();
  if (!resp.ok || !json.ok) {
    return { ok: false, error: json.error ?? "unexpected", message: json.message };
  }
  return { ok: true, authorize_url: json.authorize_url };
}

export async function triggerRevolutSync(): Promise<SyncResult> {
  const headers = await authedHeaders();
  if (!headers.Authorization) return { ok: false, error: "not_authenticated" };

  const resp = await fetch(`${config.supabase.url}/functions/v1/compta-revolut-sync`, {
    method: "POST",
    headers,
    body: "{}",
  });
  const json = await resp.json();
  if (!resp.ok || !json.ok) {
    return { ok: false, error: json.error ?? "unexpected", message: json.message };
  }
  return { ok: true, data: json.data };
}

// Lister les transactions (source_events Revolut) d'un tenant
export async function listBankTransactions(opts?: {
  limit?: number;
  status?: "pending" | "classified" | "failed";
}): Promise<BankTransaction[]> {
  const supabase = getSupabase();
  let q = supabase
    .from("compta_bank_transactions_v")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.status) q = q.eq("processing_status", opts.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as BankTransaction[];
}

export type BankTransaction = {
  id: string;
  external_id: string;
  occurred_at: string;
  raw_payload: {
    type: string;
    state: string;
    legs?: Array<{ amount: number; currency: string; description?: string; account_id: string }>;
    merchant?: { name?: string };
    reference?: string;
  };
  processing_status: "pending" | "classified" | "failed" | "skipped";
  proposal_status: string | null;
  proposal_id: string | null;
  confidence_level: "low" | "medium" | "high" | null;
  pcg_debit: string | null;
  pcg_credit: string | null;
};
