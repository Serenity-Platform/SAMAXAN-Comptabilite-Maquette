// Paperasse — Hook useSession pour récupérer/surveiller l'état auth courant
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabaseClient";

export type SessionState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; session: Session };

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    const supabase = getSupabase();
    let unsubscribed = false;

    supabase.auth.getSession().then(({ data }) => {
      if (unsubscribed) return;
      if (data.session) {
        setState({ status: "authenticated", session: data.session });
      } else {
        setState({ status: "unauthenticated" });
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (unsubscribed) return;
      if (session) {
        setState({ status: "authenticated", session });
      } else {
        setState({ status: "unauthenticated" });
      }
    });

    return () => {
      unsubscribed = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
