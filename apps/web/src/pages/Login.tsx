// Paperasse — Page Login par email + password Supabase
// Volontairement SANS magic link pour éviter la dépendance aux redirect URLs
// de la config auth Supabase (partagée avec app-serenity.com).
import { useState } from "react";
import { theme } from "../lib/theme";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { getSupabase } from "../lib/supabaseClient";

type Props = {
  onBack: () => void;
  onSignedIn: () => void;
};

export function Login({ onBack, onSignedIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "signing_in" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !email.includes("@")) {
      setErrorMsg("Email invalide");
      setState("error");
      return;
    }
    if (!password) {
      setErrorMsg("Mot de passe requis");
      setState("error");
      return;
    }
    setState("signing_in");
    setErrorMsg(null);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setErrorMsg(error.message);
        setState("error");
      } else {
        onSignedIn();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 440, marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            border: "none",
            color: theme.color.textSoft,
            fontSize: theme.fontSize.sm,
            cursor: "pointer",
            padding: 0,
          }}
        >
          ← Retour à l'accueil
        </button>
      </div>

      <Card style={{ maxWidth: 440, width: "100%" }}>
        <h1
          style={{
            fontSize: theme.fontSize.xl,
            fontWeight: 700,
            color: theme.color.primary,
            margin: "0 0 8px",
          }}
        >
          Connexion
        </h1>
        <p style={{ fontSize: theme.fontSize.base, color: theme.color.textMuted, margin: "0 0 24px", lineHeight: 1.5 }}>
          Utilisez votre email et mot de passe Serenity.
        </p>

        <div onKeyDown={handleKeyDown} style={{ display: "grid", gap: 16 }}>
          <Input
            label="Email"
            type="email"
            placeholder="samgraphiste@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={state === "signing_in"}
            autoComplete="email"
            autoFocus
          />

          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={state === "signing_in"}
            autoComplete="current-password"
            error={state === "error" ? errorMsg ?? undefined : undefined}
          />
        </div>

        <div style={{ marginTop: 20 }}>
          <Button
            onClick={handleSubmit}
            disabled={state === "signing_in" || !email || !password}
            style={{ width: "100%" }}
          >
            {state === "signing_in" ? "Connexion…" : "Se connecter"}
          </Button>
        </div>

        <p
          style={{
            fontSize: theme.fontSize.xs,
            color: theme.color.textSoft,
            marginTop: 16,
            lineHeight: 1.5,
          }}
        >
          Utilisez le même couple email/mot de passe que sur app-serenity.com.
          Aucun redirect, aucun email envoyé.
        </p>
      </Card>
    </div>
  );
}
