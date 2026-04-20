// Paperasse — Configuration runtime
// NOTE : l'URL Supabase et l'anon key sont publiques (safe à exposer côté client),
// la sécurité repose sur la RLS et les verify_jwt des Edge Functions.

// Vite injecte les VITE_* lors du build. Fallback sur localhost pour dev local sans .env.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://wtvnepynwrvvpugmdacd.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const config = {
  supabase: {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  },
  endpoints: {
    sireneLookup: `${SUPABASE_URL}/functions/v1/compta-sirene-lookup`,
    onboardingSubmit: `${SUPABASE_URL}/functions/v1/compta-onboarding-submit`,
  },
  // URL de redirection après login magic link (utilisée par Supabase Auth)
  authRedirect: typeof window !== "undefined" ? window.location.origin : "",
} as const;

// Legacy alias (pour ne pas casser sireneApi.ts)
export const sireneEndpoint = config.endpoints.sireneLookup;

// Pour debug en console : affiche la config sans leak des secrets
if (typeof window !== "undefined" && !SUPABASE_ANON_KEY) {
  console.warn("[Paperasse] VITE_SUPABASE_ANON_KEY absente — auth ne fonctionnera pas.");
}
