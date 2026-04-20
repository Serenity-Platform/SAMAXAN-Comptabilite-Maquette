// Paperasse — Dashboard minimal post-création (Lot 1.3)
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { theme } from "../lib/theme";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { getSupabase } from "../lib/supabaseClient";

type TenantSummary = {
  tenant_id: string;
  tenant_name: string;
  legal_entity_id: string;
  legal_entity_name: string;
  legal_form: string;
  siren: string;
  siret: string;
  naf: string | null;
  regime_tva: string;
  regime_is: string;
  journals_count: number;
  periods_count: number;
  fiscal_year_start: string;
  fiscal_year_end: string;
  created_at: string;
};

type Props = {
  session: Session;
  onSignOut: () => void;
  onStartOnboarding: () => void;
};

export function Dashboard({ session, onSignOut, onStartOnboarding }: Props) {
  const [summary, setSummary] = useState<TenantSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const supabase = getSupabase();

      // Récupérer les infos via les vues public.compta_*_v (RLS appliquée via SECURITY INVOKER)
      const { data: memberships, error: memErr } = await supabase
        .from("compta_memberships_v")
        .select("tenant_id, role")
        .eq("role", "tenant_owner")
        .is("revoked_at", null);

      if (cancelled) return;
      if (memErr) {
        setError(`Erreur chargement tenants : ${memErr.message}`);
        setLoading(false);
        return;
      }
      if (!memberships || memberships.length === 0) {
        setSummary(null);
        setLoading(false);
        return;
      }
      const tenantId = memberships[0].tenant_id;

      const [tenantRes, leRes, fyRes, journalsRes, periodsRes] = await Promise.all([
        supabase.from("compta_tenants_v").select("id, name, created_at").eq("id", tenantId).single(),
        supabase.from("compta_legal_entities_v").select("id, name, legal_form, siren, siret, naf, regime_tva, regime_is").eq("tenant_id", tenantId).maybeSingle(),
        supabase.from("compta_fiscal_years_v").select("start_date, end_date").eq("tenant_id", tenantId).order("start_date", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("compta_journals_v").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("compta_accounting_periods_v").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      ]);

      if (cancelled) return;

      const firstError = [tenantRes.error, leRes.error, fyRes.error, journalsRes.error, periodsRes.error].find(Boolean);
      if (firstError) {
        setError(`Erreur détails : ${firstError.message}`);
        setLoading(false);
        return;
      }

      if (!tenantRes.data || !leRes.data) {
        setSummary(null);
        setLoading(false);
        return;
      }

      setSummary({
        tenant_id: tenantRes.data.id,
        tenant_name: tenantRes.data.name,
        legal_entity_id: leRes.data.id,
        legal_entity_name: leRes.data.name,
        legal_form: leRes.data.legal_form,
        siren: leRes.data.siren,
        siret: leRes.data.siret,
        naf: leRes.data.naf,
        regime_tva: leRes.data.regime_tva,
        regime_is: leRes.data.regime_is,
        journals_count: journalsRes.count ?? 0,
        periods_count: periodsRes.count ?? 0,
        fiscal_year_start: fyRes.data?.start_date ?? "—",
        fiscal_year_end: fyRes.data?.end_date ?? "—",
        created_at: tenantRes.data.created_at,
      });
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSignOut = async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    onSignOut();
  };

  const userEmail = session.user.email ?? session.user.id;

  return (
    <div style={{ minHeight: "100vh", padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 820,
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: theme.fontSize.sm, color: theme.color.textSoft }}>
          Connecté en tant que <strong style={{ color: theme.color.text }}>{userEmail}</strong>
        </div>
        <button
          onClick={handleSignOut}
          style={{
            background: "transparent",
            border: "none",
            color: theme.color.textSoft,
            fontSize: theme.fontSize.sm,
            cursor: "pointer",
            padding: 0,
          }}
        >
          Se déconnecter
        </button>
      </div>

      <Card style={{ maxWidth: 820, width: "100%" }}>
        {loading && (
          <p style={{ fontSize: theme.fontSize.base, color: theme.color.textMuted }}>
            Chargement…
          </p>
        )}

        {!loading && error && (
          <div
            style={{
              padding: 16,
              background: "#fef2f2",
              border: "1px solid #dc262655",
              borderRadius: theme.radius.md,
              fontSize: theme.fontSize.base,
              color: "#991b1b",
            }}
          >
            <strong>Erreur :</strong> {error}
          </div>
        )}

        {!loading && !error && !summary && (
          <>
            <h1 style={{ fontSize: theme.fontSize.xxl, fontWeight: 700, color: theme.color.primary, margin: "0 0 8px" }}>
              Aucune société
            </h1>
            <p style={{ fontSize: theme.fontSize.base, color: theme.color.textMuted, margin: "0 0 24px" }}>
              Vous n'avez pas encore créé de société. Démarrez l'onboarding pour initialiser votre
              tenant comptable.
            </p>
            <Button onClick={onStartOnboarding}>Démarrer l'onboarding</Button>
          </>
        )}

        {!loading && !error && summary && (
          <>
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
              Tenant actif
            </div>

            <h1 style={{ fontSize: theme.fontSize.xxl, fontWeight: 700, color: theme.color.primary, margin: "0 0 4px" }}>
              {summary.tenant_name}
            </h1>
            <p style={{ fontSize: theme.fontSize.base, color: theme.color.textMuted, margin: "0 0 28px" }}>
              {summary.legal_form} · SIREN {summary.siren} · créé le {new Date(summary.created_at).toLocaleDateString("fr-FR")}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
                marginBottom: 28,
              }}
            >
              <Stat label="Journaux comptables" value={String(summary.journals_count)} />
              <Stat label="Périodes mensuelles" value={String(summary.periods_count)} />
              <Stat label="Exercice" value={summary.fiscal_year_start.slice(0, 4)} />
              <Stat label="Régime TVA" value={labelTVA(summary.regime_tva)} />
            </div>

            <div
              style={{
                border: `1px solid ${theme.color.border}`,
                borderRadius: theme.radius.md,
                overflow: "hidden",
              }}
            >
              <SummaryRow label="Raison sociale" value={summary.legal_entity_name} />
              <SummaryRow label="Forme juridique" value={summary.legal_form} />
              <SummaryRow label="SIREN / SIRET" value={`${summary.siren} / ${summary.siret}`} />
              <SummaryRow label="Code NAF" value={summary.naf ?? "—"} />
              <SummaryRow label="Régime TVA" value={labelTVA(summary.regime_tva)} />
              <SummaryRow label="Régime IS / BIC" value={labelIS(summary.regime_is)} />
              <SummaryRow label="Exercice en cours" value={`${summary.fiscal_year_start} → ${summary.fiscal_year_end}`} last />
            </div>

            <div
              style={{
                marginTop: 24,
                padding: 14,
                background: theme.color.bgTint,
                border: `1px solid ${theme.color.accent}33`,
                borderRadius: theme.radius.md,
                fontSize: theme.fontSize.sm,
                color: theme.color.textMuted,
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: theme.color.primary }}>Fondations en place.</strong>{" "}
              Les écritures comptables, imports bancaires et déclarations TVA arriveront dans les
              lots suivants. Pour l'instant, votre tenant dispose du socle technique (PCG 2026, 4
              journaux, {summary.periods_count} périodes, RLS isolée).
            </div>
          </>
        )}
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

function SummaryRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 14px",
        fontSize: theme.fontSize.sm,
        borderBottom: last ? "none" : `1px solid ${theme.color.borderSoft}`,
      }}
    >
      <span style={{ color: theme.color.textSoft }}>{label}</span>
      <span style={{ color: theme.color.text, fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function labelTVA(r: string): string {
  const map: Record<string, string> = {
    franchise: "Franchise en base",
    reel_simplifie: "Réel simplifié",
    reel_normal: "Réel normal",
  };
  return map[r] ?? r;
}

function labelIS(r: string): string {
  const map: Record<string, string> = {
    micro_entreprise: "Micro-entreprise",
    reel_simplifie: "Réel simplifié (liasse 2033)",
    reel_normal: "Réel normal (liasse 2050)",
    is_non_assujetti: "Non assujetti IS",
  };
  return map[r] ?? r;
}
