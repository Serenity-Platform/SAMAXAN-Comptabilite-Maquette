// Paperasse - API Banque & Propositions comptables
// Lot 2.1 : integration Revolut
// Lot 2.2 : approve/reject/undo + vue review enrichie
import { getSupabase } from "./supabaseClient";
import { config } from "./config";

// ============================================================
// Types
// ============================================================
export type BankIntegration = {
  id: string;
  tenant_id: string;
  legal_entity_id: string | null;
  provider: "revolut_business";
  status: "pending" | "connected" | "expired" | "revoked" | "error";
  accounts: Array<{
    id: string;
    name: string;
    currency: string;
    balance: number;
    state: string;
  }>;
  scopes: string[];
  last_sync_at: string | null;
  last_sync_error: string | null;
  last_sync_tx_count: number;
  connected_at: string | null;
  disconnected_at: string | null;
};

export type ProposedLine = {
  account_pcg: string;
  debit: number;
  credit: number;
  label: string;
};

export type RuleApplication = {
  rule_id?: string;
  rule_code?: string;
  rule_version?: string;
  context_snapshot?: Record<string, unknown>;
  applied_at?: string;
  result?: Record<string, unknown>;
};

export type ProposalStatus =
  | "draft"
  | "review_required"
  | "reviewed"
  | "rejected"
  | "ready_to_post";

export type ConfidenceLevel = "low" | "medium" | "high";

export type DocumentType =
  | "purchase_invoice"
  | "sales_invoice"
  | "credit_note"
  | "bank_statement"
  | "receipt"
  | "contract"
  | "other";

export type AttachedDocument = {
  id: string;
  file_name: string;
  document_type: DocumentType;
  storage_path: string;
  content_hash: string;
  file_size_bytes: number;
  mime_type: string;
  created_at: string;
};

export type ReviewProposal = {
  id: string;
  tenant_id: string;
  legal_entity_id: string;
  status: ProposalStatus;
  confidence_level: ConfidenceLevel | null;
  confidence_score: number | null;
  proposed_lines: ProposedLine[];
  rule_applications: RuleApplication[];
  rejection_reason: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  posted_journal_entry_id: string | null;
  created_at: string;
  updated_at: string;
  source_event_id: string;
  se_external_id: string;
  se_external_source: string;
  se_event_type: string;
  se_occurred_at: string;
  se_raw_payload: {
    type?: string;
    state?: string;
    reference?: string;
    legs?: Array<{
      amount: number;
      currency: string;
      description?: string;
    }>;
  };
  journal_code: string | null;
  journal_label: string | null;
  je_piece_reference: string | null;
  je_entry_date: string | null;
  je_status: "posted" | "locked" | "reversed" | null;
  attached_documents: AttachedDocument[];
};

export type SyncResult = {
  new_events: number;
  new_proposals: number;
  skipped_duplicates: number;
  auto_ready_to_post: number;
  review_required: number;
  last_sync_at: string;
};

// ============================================================
// Integration : list / disconnect
// ============================================================
export async function listBankIntegrations(): Promise<BankIntegration[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("fn_list_bank_integrations");
  if (error) throw new Error(`fn_list_bank_integrations: ${error.message}`);
  return (data ?? []) as BankIntegration[];
}

export async function disconnectBankIntegration(integrationId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("fn_disconnect_bank_integration", {
    p_integration_id: integrationId,
  });
  if (error) throw new Error(`disconnect: ${error.message}`);
}

// ============================================================
// OAuth / Sync
// ============================================================
export async function startRevolutOAuth(): Promise<void> {
  const supabase = getSupabase();
  const { data: sess } = await supabase.auth.getSession();
  const accessToken = sess.session?.access_token;
  if (!accessToken) throw new Error("Non authentifie");

  const resp = await fetch(
    `${config.supabase.url}/functions/v1/compta-revolut-oauth-start`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: config.supabase.anonKey,
      },
      body: JSON.stringify({}),
    },
  );
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`oauth-start: ${resp.status} ${t}`);
  }
  const json = (await resp.json()) as { authorize_url: string };
  window.location.href = json.authorize_url;
}

export async function triggerRevolutSync(): Promise<
  | { ok: true; data: SyncResult }
  | { ok: false; error: string; message?: string }
> {
  const supabase = getSupabase();
  const { data: sess } = await supabase.auth.getSession();
  const accessToken = sess.session?.access_token;
  if (!accessToken) return { ok: false, error: "unauthenticated" };

  const resp = await fetch(
    `${config.supabase.url}/functions/v1/compta-revolut-sync`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: config.supabase.anonKey,
      },
      body: JSON.stringify({}),
    },
  );
  const body = await resp.json();
  if (!resp.ok || !body.ok) {
    return {
      ok: false,
      error: body.error ?? `http_${resp.status}`,
      message: body.message,
    };
  }
  return { ok: true, data: body.data as SyncResult };
}

// ============================================================
// Proposals - review workflow (Lot 2.2)
// ============================================================
export type ProposalFilter = "all" | "review_required" | "ready_to_post" | "reviewed" | "rejected";

export async function listReviewProposals(opts?: {
  filter?: ProposalFilter;
  source?: string;
  limit?: number;
}): Promise<ReviewProposal[]> {
  const supabase = getSupabase();
  let q = supabase.from("compta_proposals_review_v").select("*");
  if (opts?.filter && opts.filter !== "all") q = q.eq("status", opts.filter);
  if (opts?.source) q = q.eq("se_external_source", opts.source);
  q = q.order("se_occurred_at", { ascending: true }).limit(opts?.limit ?? 500);
  const { data, error } = await q;
  if (error) throw new Error(`listReviewProposals: ${error.message}`);
  return (data ?? []) as ReviewProposal[];
}

export async function approveProposal(params: {
  proposalId: string;
  reviewNotes?: string | null;
  overrideLines?: ProposedLine[] | null;
}): Promise<{
  status: "approved";
  proposal_id: string;
  journal_entry_id: string;
  piece_reference: string;
  total_amount: number;
}> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("fn_proposal_approve", {
    p_proposal_id: params.proposalId,
    p_review_notes: params.reviewNotes ?? null,
    p_override_lines: params.overrideLines ?? null,
  });
  if (error) throw new Error(error.message);
  return data as {
    status: "approved";
    proposal_id: string;
    journal_entry_id: string;
    piece_reference: string;
    total_amount: number;
  };
}

export async function rejectProposal(params: {
  proposalId: string;
  rejectionReason: string;
}): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("fn_proposal_reject", {
    p_proposal_id: params.proposalId,
    p_rejection_reason: params.rejectionReason,
  });
  if (error) throw new Error(error.message);
}

export async function undoProposal(proposalId: string): Promise<{
  status: "undone";
  proposal_id: string;
  reversed_journal_entry_id: string;
}> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("fn_proposal_undo", {
    p_proposal_id: proposalId,
  });
  if (error) throw new Error(error.message);
  return data as {
    status: "undone";
    proposal_id: string;
    reversed_journal_entry_id: string;
  };
}

// ============================================================
// Source documents - pieces jointes (Lot 2.2 extension)
// ============================================================
const COMPTA_BUCKET = "compta-documents";

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function slugifyFileName(name: string): string {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");
  return normalized.slice(0, 120);
}

export async function uploadAndAttachDocument(params: {
  file: File;
  sourceEventId: string;
  tenantId: string;
  documentType?: DocumentType;
}): Promise<{
  status: "created" | "attached_existing";
  document_id: string;
  storage_path: string;
  file_name: string;
  already_existed: boolean;
}> {
  const supabase = getSupabase();

  // 1. Calculer hash SHA-256 pour idempotence
  const buffer = await params.file.arrayBuffer();
  const contentHash = await sha256Hex(buffer);

  // 2. Construire le storage path : {tenant}/source_documents/{event}/{hash8}-{filename}
  const fileNameSafe = slugifyFileName(params.file.name);
  const storagePath = `${params.tenantId}/source_documents/${params.sourceEventId}/${contentHash.slice(0, 12)}-${fileNameSafe}`;

  // 3. Upload Storage (upsert: true pour gerer le cas du meme hash rejoue)
  const { error: uploadErr } = await supabase.storage
    .from(COMPTA_BUCKET)
    .upload(storagePath, params.file, {
      contentType: params.file.type || "application/octet-stream",
      upsert: true,
    });
  if (uploadErr) throw new Error(`upload: ${uploadErr.message}`);

  // 4. Persister la row source_documents via RPC
  const { data, error } = await supabase.rpc("fn_source_document_attach", {
    p_source_event_id: params.sourceEventId,
    p_file_name: params.file.name,
    p_storage_path: storagePath,
    p_content_hash: contentHash,
    p_file_size_bytes: params.file.size,
    p_mime_type: params.file.type || "application/octet-stream",
    p_document_type: params.documentType ?? "receipt",
  });
  if (error) throw new Error(`attach: ${error.message}`);
  return data as {
    status: "created" | "attached_existing";
    document_id: string;
    storage_path: string;
    file_name: string;
    already_existed: boolean;
  };
}

export async function detachDocument(params: {
  documentId: string;
  storagePath: string;
}): Promise<void> {
  const supabase = getSupabase();

  // Supprimer la row DB d'abord (echoue si liee a une journal_entry postee)
  const { error: rpcErr } = await supabase.rpc("fn_source_document_detach", {
    p_document_id: params.documentId,
  });
  if (rpcErr) throw new Error(`detach: ${rpcErr.message}`);

  // Ensuite supprimer le fichier Storage (best-effort : erreur non bloquante)
  await supabase.storage.from(COMPTA_BUCKET).remove([params.storagePath]);
}

export async function getDocumentSignedUrl(
  storagePath: string,
  expiresInSec: number = 600,
): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(COMPTA_BUCKET)
    .createSignedUrl(storagePath, expiresInSec);
  if (error) throw new Error(`signed_url: ${error.message}`);
  return data.signedUrl;
}
