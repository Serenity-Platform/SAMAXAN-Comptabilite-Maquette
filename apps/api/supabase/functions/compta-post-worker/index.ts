// Paperasse - Edge Function compta-post-worker
//
// Statut : STUB Lot 0. Implémentation réelle : Lot 2.
//
// Rôle (D003) : pick up les accounting_proposals au statut 'ready_to_post'
// par batch de 50 avec SELECT ... FOR UPDATE SKIP LOCKED, et les promeut
// en journal_entries + journal_entry_lines en une seule transaction
// (le trigger DEFERRABLE valide l'équilibre D=C au COMMIT).
//
// Fréquence cible : cron 30s.
// Retry : post_attempts sur accounting_proposals, post_last_error tracé.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (_req) => {
  // TODO Lot 2 :
  // 1) SELECT ... FROM compta.accounting_proposals
  //    WHERE status = 'ready_to_post' AND post_attempts < 5
  //    ORDER BY ready_to_post_at ASC LIMIT 50 FOR UPDATE SKIP LOCKED
  // 2) pour chaque proposition : BEGIN ; INSERT entry + lignes ; UPDATE proposal ; COMMIT
  // 3) en cas d'erreur : UPDATE post_attempts + post_last_error + audit_logs priority=high
  // 4) observer latence + backlog (audit_logs priority=normal)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { count } = await supabase
    .schema("compta")
    .from("accounting_proposals")
    .select("id", { count: "exact", head: true })
    .eq("status", "ready_to_post");

  return new Response(
    JSON.stringify({
      status: "stub",
      lot: "0",
      implementation_target: "Lot 2",
      queue_depth: count ?? 0,
      note: "compta-post-worker sera implémenté au Lot 2 selon D003",
    }),
    { headers: { "content-type": "application/json" } }
  );
});
