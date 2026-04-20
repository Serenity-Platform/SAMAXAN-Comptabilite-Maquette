import { theme } from "../lib/theme";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

type Props = {
  onStartOnboarding: () => void;
};

export function Home({ onStartOnboarding }: Props) {
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
      <Card style={{ maxWidth: 720, width: "100%" }}>
        <div
          style={{
            display: "inline-block",
            fontSize: theme.fontSize.xs,
            fontWeight: 600,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: theme.color.accent,
            padding: "4px 10px",
            borderRadius: theme.radius.pill,
            background: theme.color.bgTint,
            marginBottom: 16,
          }}
        >
          Lot 1.1 & 1.2 — Onboarding Paperasse
        </div>

        <h1
          style={{
            fontSize: theme.fontSize.hero,
            fontWeight: 700,
            margin: "0 0 12px",
            color: theme.color.primary,
            letterSpacing: -0.5,
          }}
        >
          Paperasse
        </h1>

        <p style={{ fontSize: theme.fontSize.md, color: theme.color.textMuted, lineHeight: 1.6, margin: "0 0 28px" }}>
          Module de comptabilité française intégré à Serenity.
          <br />
          Lot 1.1 : Edge Function Sirene déployée et testée. Lot 1.2 : flux onboarding 6 étapes.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 28,
          }}
        >
          <Stat label="Comptes PCG 2026" value="838" />
          <Stat label="Cases liasse 2033" value="52" />
          <Stat label="Règles TVA v1" value="10" />
          <Stat label="Règles classification" value="12" />
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Button onClick={onStartOnboarding}>Démarrer l'onboarding Samaxan</Button>
          <span style={{ fontSize: theme.fontSize.sm, color: theme.color.textSoft }}>
            Testable avec SIREN 851264606 (Samaxan) ou tout autre SIREN français.
          </span>
        </div>

        <div
          style={{
            marginTop: 28,
            paddingTop: 20,
            borderTop: `1px solid ${theme.color.borderSoft}`,
            fontSize: theme.fontSize.sm,
            color: theme.color.textSoft,
            lineHeight: 1.7,
          }}
        >
          <strong style={{ color: theme.color.text }}>Documentation :</strong>{" "}
          <code style={{ background: theme.color.borderSoft, padding: "2px 6px", borderRadius: 4 }}>
            docs/project-state/
          </code>
          <br />
          <strong style={{ color: theme.color.text }}>Migrations :</strong>{" "}
          <code style={{ background: theme.color.borderSoft, padding: "2px 6px", borderRadius: 4 }}>
            supabase/migrations/20260420_000001..22 + 20260421_000001
          </code>
          <br />
          <strong style={{ color: theme.color.text }}>Edge Function :</strong>{" "}
          <code style={{ background: theme.color.borderSoft, padding: "2px 6px", borderRadius: 4 }}>
            compta-sirene-lookup
          </code>{" "}
          (déployée ✓)
        </div>
      </Card>

      <p style={{ marginTop: 24, fontSize: theme.fontSize.sm, color: theme.color.textFaint }}>
        © 2026 SAMAXAN · Paperasse — Module Serenity
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: theme.color.bgSoft,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontSize: theme.fontSize.xxl, fontWeight: 700, color: theme.color.primary, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: theme.fontSize.xs, color: theme.color.textSoft, marginTop: 6, letterSpacing: 0.2 }}>
        {label}
      </div>
    </div>
  );
}
