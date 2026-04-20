// Paperasse — Dashboard v1 (Lot 1.4). Vue d'ensemble de la société avec
// fondations techniques, à venir, et informations juridiques.
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Calendar,
  Receipt,
  FileText,
  Landmark,
  Zap,
  CheckCircle2,
  Clock,
  LayoutDashboard,
} from "lucide-react";
import { theme } from "../lib/theme";
import { PageHeader } from "../components/PageHeader";
import { KpiCard } from "../components/KpiCard";
import { EmptyState } from "../components/EmptyState";
import { Button } from "../components/Button";
import { getSupabase } from "../lib/supabaseClient";

type Summary = {
  tenant_name: string;
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
  onNavigateSettings: () => void;
};

export function Dashboard({ onNavigateSettings }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const supabase = getSupabase();

      const { data: memberships, error: memErr } = await supabase
        .from("compta_memberships_v")
        .select("tenant_id, role")
        .eq("role", "tenant_owner")
        .is("revoked_at", null);

      if (cancelled) return;
      if (memErr) {
        setError(memErr.message);
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
        setError(firstError.message);
        setLoading(false);
        return;
      }
      if (!tenantRes.data || !leRes.data) {
        setSummary(null);
        setLoading(false);
        return;
      }

      setSummary({
        tenant_name: tenantRes.data.name,
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

  if (loading) {
    return (
      <div style={{ padding: 40, color: theme.color.textSoft, fontSize: theme.fontSize.base }}>
        Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de votre société" />
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
          <strong>Erreur de chargement :</strong> {error}
        </div>
      </>
    );
  }

  if (!summary) {
    return (
      <>
        <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de votre société" />
        <EmptyState
          icon={LayoutDashboard}
          title="Aucune société enregistrée"
          description="Commencez par créer votre société pour accéder à votre tableau de bord comptable."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={summary.tenant_name}
        subtitle={`${summary.legal_form} · SIREN ${summary.siren} · créée le ${new Date(summary.created_at).toLocaleDateString("fr-FR")}`}
        actions={
          <Button variant="secondary" onClick={onNavigateSettings}>
            Paramètres de la société
          </Button>
        }
      />

      {/* Section Fondations */}
      <Section
        title="Fondations techniques"
        subtitle="Ce qui est déjà en place pour votre comptabilité"
        icon={<CheckCircle2 size={14} color={theme.color.success} />}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <KpiCard label="Journaux" value={summary.journals_count} hint="Ventes, Achats, Banque, OD" icon={<BookOpen size={14} />} />
          <KpiCard label="Périodes ouvertes" value={summary.periods_count} hint="Janvier à Décembre 2026" icon={<Calendar size={14} />} />
          <KpiCard label="Exercice" value={new Date(summary.fiscal_year_start).getFullYear()} hint={`${summary.fiscal_year_start} → ${summary.fiscal_year_end}`} icon={<Calendar size={14} />} />
          <KpiCard label="Régime TVA" value={labelTVA(summary.regime_tva)} hint={labelIS(summary.regime_is)} icon={<Receipt size={14} />} />
        </div>
      </Section>

      {/* Section À venir */}
      <Section
        title="Prochaines étapes"
        subtitle="Ce qui arrive avec les lots suivants"
        icon={<Clock size={14} color={theme.color.accent} />}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <UpcomingCard
            icon={Landmark}
            title="Connexion Revolut"
            description="Import automatique des transactions bancaires et rapprochement."
            badge="Lot 2.1"
          />
          <UpcomingCard
            icon={Zap}
            title="Moteur de règles TVA"
            description="Propositions comptables automatiques selon le type de transaction."
            badge="Lot 2.2"
          />
          <UpcomingCard
            icon={BookOpen}
            title="Écritures comptables"
            description="Validation des propositions et post vers les journaux comptables."
            badge="Lot 2.3"
          />
          <UpcomingCard
            icon={Receipt}
            title="Déclaration TVA CA3"
            description="Génération automatique depuis les écritures du trimestre."
            badge="Lot 4.x"
          />
          <UpcomingCard
            icon={FileText}
            title="Factures Factur-X"
            description="Émission conforme à la réforme facturation électronique 2026."
            badge="Lot 4.x"
          />
        </div>
      </Section>

      {/* Section Informations société */}
      <Section
        title="Informations société"
        subtitle={
          <>
            Modifiables depuis{" "}
            <a
              onClick={(e) => {
                e.preventDefault();
                onNavigateSettings();
              }}
              href="#settings-company"
              style={{ color: theme.color.primary, fontWeight: 500 }}
            >
              Paramètres → Société
            </a>
          </>
        }
      >
        <div
          style={{
            border: `1px solid ${theme.color.border}`,
            borderRadius: theme.radius.md,
            background: theme.color.bg,
            overflow: "hidden",
          }}
        >
          <InfoRow label="Raison sociale" value={summary.legal_entity_name} />
          <InfoRow label="Forme juridique" value={summary.legal_form} />
          <InfoRow label="SIREN" value={summary.siren} mono />
          <InfoRow label="SIRET" value={summary.siret} mono />
          <InfoRow label="Code NAF" value={summary.naf ?? "—"} mono />
          <InfoRow label="Régime TVA" value={labelTVA(summary.regime_tva)} />
          <InfoRow label="Régime IS / BIC" value={labelIS(summary.regime_is)} />
          <InfoRow
            label="Exercice en cours"
            value={`${summary.fiscal_year_start} → ${summary.fiscal_year_end}`}
            last
          />
        </div>
      </Section>
    </>
  );
}

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon}
          <h2
            style={{
              fontSize: theme.fontSize.md,
              fontWeight: 600,
              color: theme.color.text,
              margin: 0,
            }}
          >
            {title}
          </h2>
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: theme.fontSize.sm,
              color: theme.color.textSoft,
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function UpcomingCard({
  icon: Icon,
  title,
  description,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        background: theme.color.bg,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        overflow: "hidden",
        transition: "border-color 0.12s, transform 0.12s",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: theme.accent.topBorderHeight,
          background: theme.gradient.serenityHorizontal,
          opacity: 0.6,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ color: theme.color.primary, display: "flex" }}>
          <Icon size={18} />
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: theme.color.textSoft,
            background: theme.color.bgSoft,
            padding: "2px 8px",
            borderRadius: theme.radius.sm,
            border: `1px solid ${theme.color.border}`,
          }}
        >
          {badge}
        </span>
      </div>
      <div
        style={{
          fontSize: theme.fontSize.base,
          fontWeight: 600,
          color: theme.color.text,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: theme.fontSize.sm,
          color: theme.color.textSoft,
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 14px",
        fontSize: theme.fontSize.sm,
        borderBottom: last ? "none" : `1px solid ${theme.color.borderSoft}`,
        gap: 12,
      }}
    >
      <span style={{ color: theme.color.textSoft }}>{label}</span>
      <span
        style={{
          color: theme.color.text,
          fontWeight: 500,
          textAlign: "right",
          fontFamily: mono ? "ui-monospace, Menlo, Monaco, monospace" : undefined,
          fontSize: mono ? theme.fontSize.sm : theme.fontSize.sm,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function labelTVA(r: string): string {
  const map: Record<string, string> = {
    franchise: "Franchise en base",
    reel_simplifie: "Réel simplifié",
    reel_normal: "Réel normal",
    mini_reel: "Mini-réel",
  };
  return map[r] ?? r;
}

function labelIS(r: string): string {
  const map: Record<string, string> = {
    reel_simplifie: "Réel simplifié (liasse 2033)",
    reel_normal: "Réel normal (liasse 2050)",
    ir_transparent: "IR transparent (SCI, SARL IR)",
  };
  return map[r] ?? r;
}
