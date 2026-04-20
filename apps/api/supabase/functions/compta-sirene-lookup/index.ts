// Paperasse Lot 1.1 - Edge Function compta-sirene-lookup
//
// Rôle : lookup SIREN/SIRET via l'API publique recherche-entreprises.api.gouv.fr
// et retour d'un payload normalisé prêt à alimenter compta.fn_create_tenant_with_legal_entity.
//
// - Pas de token requis (API publique data.gouv.fr)
// - Rate limit upstream : 7 req/s (pas de protection ici, suffisant pour un flux onboarding)
// - Fallback en cas d'erreur upstream : renvoie 502 avec détail, jamais de 500 opaque
// - CORS ouvert sur tous domaines (le webapp Paperasse appelle depuis browser)

import { createClient } from "npm:@supabase/supabase-js@2";

const SIRENE_API = "https://recherche-entreprises.api.gouv.fr/search";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

function isValidSiren(s: string): boolean {
  return /^\d{9}$/.test(s);
}

function isValidSiret(s: string): boolean {
  return /^\d{14}$/.test(s);
}

// Mapping INSEE nature_juridique → legal_form Paperasse
// Miroir de compta.fn_map_nature_juridique côté SQL
function mapNatureJuridique(code: string | null | undefined): string {
  if (!code) return "AUTRE";
  const map: Record<string, string> = {
    "5710": "SAS",
    "5720": "SASU",
    "5488": "SASU",
    "5498": "EURL",
    "5499": "SARL",
    "5410": "SARL",
    "5422": "SARL",
    "5308": "SA",
    "5307": "SA",
    "5306": "SA",
    "6540": "SCI",
    "5202": "SNC",
    "6585": "SELARL",
    "6588": "SCP",
  };
  return map[code] ?? "AUTRE";
}

function buildAddress(siege: Record<string, unknown>): {
  line1: string;
  postal_code: string;
  city: string;
  country: string;
} {
  const parts: string[] = [];
  const numero = (siege.numero_voie as string | null) ?? "";
  const indice = (siege.indice_repetition as string | null) ?? "";
  const typeV = (siege.type_voie as string | null) ?? "";
  const libelle = (siege.libelle_voie as string | null) ?? "";
  if (numero) parts.push(numero);
  if (indice) parts.push(indice);
  if (typeV) parts.push(typeV);
  if (libelle) parts.push(libelle);
  const line1 = parts.join(" ").trim() || (siege.adresse as string) || "";
  return {
    line1,
    postal_code: (siege.code_postal as string | null) ?? "",
    city: (siege.libelle_commune as string | null) ?? "",
    country: "FR",
  };
}

function pickPresident(dirigeants: Array<Record<string, unknown>> | null | undefined): {
  name: string;
  role: string;
} | null {
  if (!Array.isArray(dirigeants) || dirigeants.length === 0) return null;
  // Priorité : "Président" > "Gérant" > "Directeur général" > premier
  const priority = ["Président", "Gérant", "Directeur général"];
  for (const p of priority) {
    const hit = dirigeants.find(
      (d) => typeof d.qualite === "string" && (d.qualite as string).toLowerCase().includes(p.toLowerCase())
    );
    if (hit) {
      const nom = (hit.nom as string | null) ?? "";
      const prenoms = (hit.prenoms as string | null) ?? "";
      return {
        name: `${prenoms} ${nom}`.trim(),
        role: (hit.qualite as string) ?? p,
      };
    }
  }
  const first = dirigeants[0];
  const nom = (first.nom as string | null) ?? "";
  const prenoms = (first.prenoms as string | null) ?? "";
  return {
    name: `${prenoms} ${nom}`.trim(),
    role: (first.qualite as string | null) ?? "Dirigeant",
  };
}

// Normalisation : du payload Sirene brut → payload Paperasse prêt pour fn_create_tenant_with_legal_entity
function normalizeSireneResult(raw: Record<string, unknown>): {
  name: string;
  legal_form: string;
  siren: string;
  siret: string;
  rcs: string | null;
  naf: string | null;
  address: ReturnType<typeof buildAddress>;
  president: ReturnType<typeof pickPresident>;
  active: boolean;
  date_creation: string | null;
  categorie_entreprise: string | null;
  nombre_etablissements: number | null;
  _sirene_raw: { nature_juridique: string; activite_principale: string; date_mise_a_jour: string | null };
} {
  const siege = (raw.siege as Record<string, unknown>) ?? {};
  const siret = (siege.siret as string) ?? "";
  const nature = raw.nature_juridique as string | null;
  const activite = raw.activite_principale as string | null;

  return {
    name: (raw.nom_raison_sociale as string) ?? (raw.nom_complet as string) ?? "",
    legal_form: mapNatureJuridique(nature),
    siren: (raw.siren as string) ?? "",
    siret,
    rcs: null, // pas fourni par cette API publique, saisie manuelle requise
    naf: activite,
    address: buildAddress(siege),
    president: pickPresident(raw.dirigeants as Array<Record<string, unknown>>),
    active: (raw.etat_administratif as string) === "A",
    date_creation: (raw.date_creation as string | null) ?? null,
    categorie_entreprise: (raw.categorie_entreprise as string | null) ?? null,
    nombre_etablissements: (raw.nombre_etablissements as number | null) ?? null,
    _sirene_raw: {
      nature_juridique: nature ?? "",
      activite_principale: activite ?? "",
      date_mise_a_jour: (raw.date_mise_a_jour as string | null) ?? null,
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (!["GET", "POST"].includes(req.method)) {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // Extraction paramètres
  let query = "";
  if (req.method === "GET") {
    const url = new URL(req.url);
    query = url.searchParams.get("q") ?? url.searchParams.get("siren") ?? url.searchParams.get("siret") ?? "";
  } else {
    try {
      const body = await req.json();
      query = body.q ?? body.siren ?? body.siret ?? "";
    } catch {
      return jsonResponse({ error: "invalid_json_body" }, 400);
    }
  }

  query = String(query ?? "").trim();
  if (!query) {
    return jsonResponse({ error: "q_or_siren_or_siret_required" }, 400);
  }

  // Validation format
  const isSiren = isValidSiren(query);
  const isSiret = isValidSiret(query);
  if (!isSiren && !isSiret) {
    return jsonResponse(
      { error: "invalid_format", message: "Attendu : SIREN (9 chiffres) ou SIRET (14 chiffres)" },
      400
    );
  }

  // Appel Sirene
  // Pour SIRET on recherche les 9 premiers chiffres (= SIREN) pour récupérer l'unité légale,
  // puis on filtre sur le SIRET précis si besoin
  const sirenForSearch = isSiret ? query.substring(0, 9) : query;
  const sireneUrl = `${SIRENE_API}?q=${encodeURIComponent(sirenForSearch)}`;

  try {
    const resp = await fetch(sireneUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Paperasse/0.1 (Serenity)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) {
      return jsonResponse(
        {
          error: "sirene_upstream_error",
          upstream_status: resp.status,
          message: "L'annuaire des entreprises est temporairement indisponible",
        },
        502
      );
    }

    const data = (await resp.json()) as {
      results: Array<Record<string, unknown>>;
      total_results: number;
    };

    if (!data.results || data.results.length === 0 || data.total_results === 0) {
      return jsonResponse({ error: "not_found", message: `Aucune entreprise trouvée pour ${query}` }, 404);
    }

    // Match strict : on veut exactement ce SIREN (pas des résultats mous)
    const exact = data.results.find((r) => (r.siren as string) === sirenForSearch);
    const best = exact ?? data.results[0];

    const normalized = normalizeSireneResult(best);

    // Si l'appel était par SIRET, vérifier que siret correspond (ou suggérer)
    if (isSiret && normalized.siret !== query) {
      return jsonResponse(
        {
          error: "siret_mismatch",
          message: `SIRET demandé (${query}) ne correspond pas au siège de l'unité légale (${normalized.siret})`,
          suggested: normalized,
        },
        409
      );
    }

    // Contrôles qualité non-bloquants, remontés dans warnings pour UI
    const warnings: string[] = [];
    if (!normalized.active) warnings.push("entreprise_cessee");
    if (normalized.legal_form === "AUTRE") {
      warnings.push(`nature_juridique_non_mappee:${normalized._sirene_raw.nature_juridique}`);
    }
    if (!normalized.president) warnings.push("pas_de_dirigeant_detectable");

    return jsonResponse({
      ok: true,
      data: normalized,
      warnings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse(
      {
        error: "sirene_fetch_failed",
        message: `Impossible de contacter l'annuaire des entreprises : ${message}`,
      },
      502
    );
  }
});
