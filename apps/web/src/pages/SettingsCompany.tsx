// Paperasse — Page Paramètres > Société : édition de la legal_entity
import { useEffect, useState } from "react";
import { ArrowLeft, Save, CheckCircle2 } from "lucide-react";
import { theme } from "../lib/theme";
import { PageHeader } from "../components/PageHeader";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Button } from "../components/Button";
import { getSupabase } from "../lib/supabaseClient";
import { updateLegalEntity, type LegalEntityPatch } from "../lib/companyApi";

type LegalEntity = {
  id: string;
  tenant_id: string;
  name: string;
  legal_form: string;
  siren: string;
  siret: string;
  rcs: string | null;
  naf: string | null;
  capital_amount: number | null;
  capital_currency: string | null;
  address: {
    line1?: string;
    line2?: string;
    postal_code?: string;
    city?: string;
    country?: string;
  } | null;
  president: { name?: string; role?: string } | null;
  regime_tva: string;
  regime_is: string;
};

type Props = {
  onBack: () => void;
};

type FormState = {
  name: string;
  legal_form: string;
  rcs: string;
  naf: string;
  capital_amount: string;
  addr_line1: string;
  addr_line2: string;
  addr_postal_code: string;
  addr_city: string;
  addr_country: string;
  president_name: string;
  president_role: string;
  regime_tva: string;
  regime_is: string;
};

function toFormState(le: LegalEntity): FormState {
  return {
    name: le.name,
    legal_form: le.legal_form,
    rcs: le.rcs ?? "",
    naf: le.naf ?? "",
    capital_amount: le.capital_amount?.toString() ?? "",
    addr_line1: le.address?.line1 ?? "",
    addr_line2: le.address?.line2 ?? "",
    addr_postal_code: le.address?.postal_code ?? "",
    addr_city: le.address?.city ?? "",
    addr_country: le.address?.country ?? "FR",
    president_name: le.president?.name ?? "",
    president_role: le.president?.role ?? "",
    regime_tva: le.regime_tva,
    regime_is: le.regime_is,
  };
}

export function SettingsCompany({ onBack }: Props) {
  const [le, setLe] = useState<LegalEntity | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFields, setSavedFields] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const supabase = getSupabase();

      const { data: memberships } = await supabase
        .from("compta_memberships_v")
        .select("tenant_id")
        .eq("role", "tenant_owner")
        .is("revoked_at", null);

      if (cancelled) return;
      if (!memberships || memberships.length === 0) {
        setError("Aucune société trouvée pour cet utilisateur.");
        setLoading(false);
        return;
      }
      const tenantId = memberships[0].tenant_id;

      const { data, error: err } = await supabase
        .from("compta_legal_entities_v")
        .select("id, tenant_id, name, legal_form, siren, siret, rcs, naf, capital_amount, capital_currency, address, president, regime_tva, regime_is")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setError("Société introuvable.");
        setLoading(false);
        return;
      }
      const typed = data as LegalEntity;
      setLe(typed);
      const state = toFormState(typed);
      setInitial(state);
      setForm(state);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const setField = (key: keyof FormState, value: string) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSavedFields(null);
  };

  const computePatch = (): LegalEntityPatch | null => {
    if (!form || !initial) return null;
    const patch: LegalEntityPatch = {};
    if (form.name !== initial.name) patch.name = form.name.trim();
    if (form.legal_form !== initial.legal_form) patch.legal_form = form.legal_form;
    if (form.rcs !== initial.rcs) patch.rcs = form.rcs.trim() || undefined;
    if (form.naf !== initial.naf) patch.naf = form.naf.trim() || undefined;
    if (form.capital_amount !== initial.capital_amount) {
      const num = Number(form.capital_amount);
      if (!Number.isNaN(num) && num >= 0) patch.capital_amount = num;
    }
    const addrChanged =
      form.addr_line1 !== initial.addr_line1 ||
      form.addr_line2 !== initial.addr_line2 ||
      form.addr_postal_code !== initial.addr_postal_code ||
      form.addr_city !== initial.addr_city ||
      form.addr_country !== initial.addr_country;
    if (addrChanged) {
      patch.address = {
        line1: form.addr_line1.trim(),
        line2: form.addr_line2.trim() || undefined,
        postal_code: form.addr_postal_code.trim(),
        city: form.addr_city.trim(),
        country: form.addr_country.trim() || "FR",
      };
    }
    const presidentChanged =
      form.president_name !== initial.president_name ||
      form.president_role !== initial.president_role;
    if (presidentChanged) {
      patch.president = {
        name: form.president_name.trim(),
        role: form.president_role.trim(),
      };
    }
    if (form.regime_tva !== initial.regime_tva) {
      patch.regime_tva = form.regime_tva as LegalEntityPatch["regime_tva"];
    }
    if (form.regime_is !== initial.regime_is) {
      patch.regime_is = form.regime_is as LegalEntityPatch["regime_is"];
    }
    return Object.keys(patch).length === 0 ? null : patch;
  };

  const hasChanges = !!computePatch();

  const onSave = async () => {
    if (!le || !form) return;
    const patch = computePatch();
    if (!patch) return;
    setSaving(true);
    setError(null);
    setSavedFields(null);
    const result = await updateLegalEntity(le.id, patch);
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? result.error);
      return;
    }
    setSavedFields(result.data.updated_fields);
    // Rafraîchir l'état initial pour que hasChanges retombe à false
    setInitial(form);
  };

  const onReset = () => {
    if (initial) setForm(initial);
    setError(null);
    setSavedFields(null);
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Société" subtitle="Chargement…" />
      </>
    );
  }

  if (!le || !form) {
    return (
      <>
        <PageHeader
          title="Société"
          subtitle="Informations légales et fiscales"
          actions={
            <Button variant="secondary" onClick={onBack}>
              <ArrowLeft size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Retour aux paramètres
            </Button>
          }
        />
        {error && <ErrorBox message={error} />}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Société"
        subtitle={`${le.name} — SIREN ${le.siren}`}
        actions={
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Retour
          </Button>
        }
      />

      {savedFields && savedFields.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            background: "#ecfdf5",
            border: "1px solid #10b98155",
            borderRadius: theme.radius.md,
            marginBottom: 20,
            fontSize: theme.fontSize.sm,
            color: "#065f46",
          }}
        >
          <CheckCircle2 size={16} />
          <span>
            Modifications enregistrées : <strong>{savedFields.join(", ")}</strong>
          </span>
        </div>
      )}

      {error && <ErrorBox message={error} />}

      {/* Carte : immatriculation */}
      <FormCard title="Immatriculation" subtitle="Champs SIREN et SIRET non modifiables.">
        <Grid2>
          <Input label="Raison sociale" value={form.name} onChange={(e) => setField("name", e.target.value)} />
          <Select
            label="Forme juridique"
            value={form.legal_form}
            onChange={(e) => setField("legal_form", e.target.value)}
          >
            <option value="SAS">SAS</option>
            <option value="SASU">SASU</option>
            <option value="SARL">SARL</option>
            <option value="EURL">EURL</option>
            <option value="SA">SA</option>
            <option value="SNC">SNC</option>
            <option value="SCI">SCI</option>
            <option value="SELARL">SELARL</option>
            <option value="SCP">SCP</option>
            <option value="AUTRE">Autre</option>
          </Select>
        </Grid2>
        <Grid2>
          <ReadOnlyField label="SIREN" value={le.siren} mono />
          <ReadOnlyField label="SIRET" value={le.siret} mono />
        </Grid2>
        <Grid2>
          <Input label="RCS (greffe d'immatriculation)" value={form.rcs} onChange={(e) => setField("rcs", e.target.value)} placeholder="Melun" />
          <Input label="Code NAF / APE" value={form.naf} onChange={(e) => setField("naf", e.target.value)} placeholder="47.91B" />
        </Grid2>
        <Input
          label="Capital social (€)"
          type="number"
          value={form.capital_amount}
          onChange={(e) => setField("capital_amount", e.target.value)}
        />
      </FormCard>

      {/* Carte : siège social */}
      <FormCard title="Siège social">
        <Input label="Adresse ligne 1" value={form.addr_line1} onChange={(e) => setField("addr_line1", e.target.value)} />
        <Input label="Adresse ligne 2 (optionnel)" value={form.addr_line2} onChange={(e) => setField("addr_line2", e.target.value)} />
        <Grid3>
          <Input label="Code postal" value={form.addr_postal_code} onChange={(e) => setField("addr_postal_code", e.target.value)} />
          <Input label="Ville" value={form.addr_city} onChange={(e) => setField("addr_city", e.target.value)} />
          <Input label="Pays" value={form.addr_country} onChange={(e) => setField("addr_country", e.target.value)} />
        </Grid3>
      </FormCard>

      {/* Carte : représentant légal */}
      <FormCard title="Représentant légal">
        <Grid2>
          <Input label="Nom complet" value={form.president_name} onChange={(e) => setField("president_name", e.target.value)} />
          <Input label="Fonction" value={form.president_role} onChange={(e) => setField("president_role", e.target.value)} placeholder="Président de SAS" />
        </Grid2>
      </FormCard>

      {/* Carte : régimes fiscaux */}
      <FormCard
        title="Régimes fiscaux"
        subtitle="Régime TVA et impôt sur les bénéfices. Ces valeurs conditionnent les règles de calcul TVA et la liasse fiscale."
      >
        <Grid2>
          <Select
            label="Régime TVA"
            value={form.regime_tva}
            onChange={(e) => setField("regime_tva", e.target.value)}
          >
            <option value="franchise">Franchise en base (art. 293 B CGI)</option>
            <option value="reel_simplifie">Réel simplifié (CA3)</option>
            <option value="reel_normal">Réel normal (CA3 mensuel)</option>
            <option value="mini_reel">Mini-réel (TVA au réel, BIC simplifié)</option>
          </Select>
          <Select
            label="Régime IS / BIC"
            value={form.regime_is}
            onChange={(e) => setField("regime_is", e.target.value)}
          >
            <option value="reel_simplifie">Réel simplifié (liasse 2033)</option>
            <option value="reel_normal">Réel normal (liasse 2050)</option>
            <option value="ir_transparent">IR transparent (SCI, SARL à l'IR)</option>
          </Select>
        </Grid2>
      </FormCard>

      {/* Barre d'action sticky */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          marginTop: 24,
          padding: "14px 0",
          background: `linear-gradient(to top, ${theme.color.bgSoft} 40%, transparent)`,
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
        }}
      >
        <Button variant="secondary" onClick={onReset} disabled={!hasChanges || saving}>
          Annuler
        </Button>
        <Button onClick={onSave} disabled={!hasChanges || saving}>
          <Save size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          {saving ? "Enregistrement…" : "Enregistrer les modifications"}
        </Button>
      </div>
    </>
  );
}

function FormCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: theme.color.bg,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <div style={{ marginBottom: 16 }}>
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
        {subtitle && (
          <p
            style={{
              fontSize: theme.fontSize.sm,
              color: theme.color.textSoft,
              margin: "4px 0 0",
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ display: "grid", gap: 14 }}>{children}</div>
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function Grid3({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: theme.fontSize.sm,
          fontWeight: 500,
          color: theme.color.textMuted,
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <div
        style={{
          padding: "9px 12px",
          background: theme.color.bgSoft,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.md,
          fontSize: theme.fontSize.base,
          color: theme.color.textMuted,
          fontFamily: mono ? "ui-monospace, Menlo, Monaco, monospace" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 14,
        background: "#fef2f2",
        border: "1px solid #dc262655",
        borderRadius: theme.radius.md,
        fontSize: theme.fontSize.sm,
        color: "#991b1b",
        marginBottom: 20,
      }}
    >
      <strong>Erreur :</strong> {message}
    </div>
  );
}
