const PRIMARY = "#431E96";
const ACCENT = "#A202C7";

export default function App() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          width: "100%",
          background: "white",
          borderRadius: 16,
          padding: "48px 40px",
          boxShadow: "0 10px 40px rgba(15, 23, 42, 0.08)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: ACCENT,
            padding: "4px 10px",
            borderRadius: 999,
            background: "#faf5ff",
            marginBottom: 16,
          }}
        >
          Lot 0 — Fondation
        </div>

        <h1
          style={{
            fontSize: 36,
            fontWeight: 700,
            margin: "0 0 12px",
            color: PRIMARY,
            letterSpacing: -0.5,
          }}
        >
          Paperasse
        </h1>

        <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, margin: "0 0 24px" }}>
          Module de comptabilité française intégré à Serenity. Socle technique en place —
          schéma DB, invariants comptables, RLS, Storage.
          <br />
          <strong>L'interface produit démarre au Lot 3.</strong>
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

        <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
          <strong style={{ color: "#0f172a" }}>Documentation :</strong>{" "}
          <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
            docs/project-state/
          </code>
          <br />
          <strong style={{ color: "#0f172a" }}>Migrations :</strong>{" "}
          <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
            supabase/migrations/20260420_000001..22
          </code>
          <br />
          <strong style={{ color: "#0f172a" }}>Maquette UX :</strong>{" "}
          <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
            reference/mockup-v0/
          </code>
        </div>
      </div>

      <p
        style={{
          marginTop: 24,
          fontSize: 12,
          color: "#94a3b8",
        }}
      >
        © 2026 SAMAXAN · Paperasse — Module Serenity
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "14px 16px",
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 700, color: PRIMARY, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, letterSpacing: 0.2 }}>{label}</div>
    </div>
  );
}
