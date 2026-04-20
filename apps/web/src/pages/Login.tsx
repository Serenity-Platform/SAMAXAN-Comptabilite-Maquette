// Paperasse — Page Login par magic link Supabase
import { useState } from "react";
import { theme } from "../lib/theme";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { getSupabase } from "../lib/supabaseClient";
import { config } from "../lib/config";

type Props = {
  onBack: () => void;
};

export function Login({ onBack }: Props) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !email.includes("@")) {
      setErrorMsg("Email invalide");
      setState("error");
      return;
    }
    setState("sending");
    setErrorMsg(null);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: config.authRedirect,
          shouldCreateUser: false, // évite création de users surprises depuis l'interface
        },
      });
      if (error) {
        setErrorMsg(error.message);
        setState("error");
      } else {
        setState("sent");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState("error");
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
          Recevez un lien de connexion par email. Le lien expire après 1 heure.
        </p>

        {state === "sent" ? (
          <div
            style={{
              padding: 16,
              background: "#ecfdf5",
              border: "1px solid #10b98155",
              borderRadius: theme.radius.md,
              fontSize: theme.fontSize.base,
              color: "#065f46",
              lineHeight: 1.6,
            }}
          >
            <strong>Email envoyé à {email}.</strong>
            <br />
            Cliquez sur le lien reçu pour vous connecter. Cette page se rafraîchira automatiquement
            dès que la session sera établie.
          </div>
        ) : (
          <>
            <Input
              label="Email"
              type="email"
              placeholder="samgraphiste@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={state === "sending"}
              error={state === "error" ? errorMsg ?? undefined : undefined}
            />
            <div style={{ marginTop: 20 }}>
              <Button
                onClick={handleSubmit}
                disabled={state === "sending" || !email}
                style={{ width: "100%" }}
              >
                {state === "sending" ? "Envoi…" : "Recevoir le lien de connexion"}
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
              Seuls les utilisateurs Serenity existants peuvent se connecter. Aucun nouveau compte
              n'est créé automatiquement.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
