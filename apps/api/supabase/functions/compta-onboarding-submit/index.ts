// Paperasse Lot 1.3 - Edge Function compta-onboarding-submit
//
// Rôle : valide le payload onboarding et crée tenant + legal_entity + journaux + périodes
//        en appelant la RPC SQL fn_onboarding_submit (qui utilise auth.uid()).
//
// Sécurité :
// - verify_jwt = true (imposé par la plateforme Supabase)
// - La RPC SQL en SECURITY DEFINER fait l'autorisation via auth.uid()
// - Garde-fou v1 : 1 tenant par user (géré côté SQL)
//
// Entrées :
//   POST body JSON
//   {
//     tenant_name: string,
//     legal_entity: { name, legal_form, siren, siret, ... },
//     fiscal_year_start?: "YYYY-MM-DD",
//     fiscal_year_end?:   "YYYY-MM-DD"
//   }
//
// Sorties :
//   200 { ok: true, data: { tenant_id, legal_entity_id, fiscal_year_id, journals_count, periods_count, ... } }
//   400 { error: "invalid_payload", details: [...] }
//   401 { error: "unauthorized" }
//   409 { error: "tenant_already_exists", message: ... }
//   500 { error: "unexpected_error", message: ... }

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

// Validation payload onboarding — miroir minimal du CHECK SQL
function validatePayload(body: unknown): { ok: true; data: ValidatedPayload } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!body || typeof body !== "object") {
    return { ok: false, errors: ["body must be a JSON object"] };
  }
  const b = body as Record<string, unknown>;

  if (!b.tenant_name || typeof b.tenant_name !== "string" || (b.tenant_name as string).trim() === "") {
    errors.push("tenant_name required");
  }

  const le = b.legal_entity as Record<string, unknown> | undefined;
  if (!le || typeof le !== "object") {
    errors.push("legal_entity object required");
  } else {
    const requiredStr = ["legal_form", "siren", "siret", "regime_tva", "regime_is"];
    for (const field of requiredStr) {
      if (!le[field] || typeof le[field] !== "string" || (le[field] as string).trim() === "") {
        errors.push(`legal_entity.${field} required`);
      }
    }
    if (typeof le.siren === "string" && !/^\d{9}$/.test(le.siren)) {
      errors.push("legal_entity.siren must be 9 digits");
    }
    if (typeof le.siret === "string" && !/^\d{14}$/.test(le.siret)) {
      errors.push("legal_entity.siret must be 14 digits");
    }
    const addr = le.address as Record<string, unknown> | undefined;
    if (!addr || typeof addr !== "object") {
      errors.push("legal_entity.address object required");
    } else {
      for (const field of ["line1", "postal_code", "city", "country"]) {
        if (!addr[field] || typeof addr[field] !== "string") {
          errors.push(`legal_entity.address.${field} required`);
        }
      }
    }
  }

  const fsStart = b.fiscal_year_start as string | undefined;
  const fsEnd = b.fiscal_year_end as string | undefined;
  if (fsStart !== undefined && (typeof fsStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fsStart))) {
    errors.push("fiscal_year_start must be YYYY-MM-DD");
  }
  if (fsEnd !== undefined && (typeof fsEnd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fsEnd))) {
    errors.push("fiscal_year_end must be YYYY-MM-DD");
  }
  if (fsStart && fsEnd && fsStart >= fsEnd) {
    errors.push("fiscal_year_end must be after fiscal_year_start");
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      tenant_name: (b.tenant_name as string).trim(),
      legal_entity: le as Record<string, unknown>,
      fiscal_year_start: fsStart ?? null,
      fiscal_year_end: fsEnd ?? null,
    },
  };
}

type ValidatedPayload = {
  tenant_name: string;
  legal_entity: Record<string, unknown>;
  fiscal_year_start: string | null;
  fiscal_year_end: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // Auth : on récupère le JWT Authorization pour créer un client Supabase "user-scoped"
  // qui appellera la RPC avec auth.uid() correctement peuplé.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized", message: "Authorization Bearer token required" }, 401);
  }

  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json_body" }, 400);
  }

  const validated = validatePayload(body);
  if (!validated.ok) {
    return jsonResponse({ error: "invalid_payload", details: validated.errors }, 400);
  }
  const payload = validated.data;

  // Client Supabase user-scoped (utilise le JWT du caller → auth.uid() fonctionne dans la RPC)
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnon) {
    return jsonResponse(
      { error: "server_misconfigured", message: "SUPABASE_URL/ANON_KEY missing" },
      500,
    );
  }
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  // Appel RPC
  const { data, error } = await supabase.rpc("fn_onboarding_submit", {
    p_tenant_name: payload.tenant_name,
    p_legal_entity_payload: payload.legal_entity,
    p_fiscal_year_start: payload.fiscal_year_start,
    p_fiscal_year_end: payload.fiscal_year_end,
  });

  if (error) {
    // Mapping erreurs PostgreSQL vers HTTP status pertinents
    const code = error.code ?? "";
    const msg = error.message ?? "Unknown RPC error";

    if (code === "42501" || msg.toLowerCase().includes("authentification")) {
      return jsonResponse({ error: "unauthorized", message: msg }, 401);
    }
    if (code === "23505" || msg.toLowerCase().includes("déjà un tenant")) {
      return jsonResponse({ error: "tenant_already_exists", message: msg }, 409);
    }
    if (code === "22023" || code === "23514" || msg.toLowerCase().includes("invalide") || msg.toLowerCase().includes("manquant")) {
      return jsonResponse({ error: "invalid_payload", message: msg }, 400);
    }
    if (code === "23503") {
      return jsonResponse({ error: "foreign_key_violation", message: msg }, 400);
    }
    console.error("fn_onboarding_submit RPC error:", { code, msg, details: error.details, hint: error.hint });
    return jsonResponse({ error: "unexpected_error", message: msg, code }, 500);
  }

  return jsonResponse({ ok: true, data });
});
