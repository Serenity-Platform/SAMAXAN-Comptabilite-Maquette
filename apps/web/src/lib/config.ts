// Paperasse — Configuration runtime
// NOTE : l'URL Supabase et l'anon key sont publiques (safe à exposer côté client),
// la sécurité repose sur la RLS et les verify_jwt des Edge Functions.
// Valeurs issues du Project wtvnepynwrvvpugmdacd (projet Serenity V2 Dashboard).

export const config = {
  supabase: {
    url: "https://wtvnepynwrvvpugmdacd.supabase.co",
    // Anon key à injecter via Netlify env var VITE_SUPABASE_ANON_KEY en Lot 1.3
    // Pour Lot 1.2 UI seule, on n'appelle pas la DB directement : seul compta-sirene-lookup
    // est appelé (verify_jwt=false) sans apikey requise pour lecture.
  },
  // URL Edge Function Sirene lookup, verify_jwt=false (endpoint public d'aide onboarding)
  sireneEndpoint: "https://wtvnepynwrvvpugmdacd.supabase.co/functions/v1/compta-sirene-lookup",
} as const;
