import { useState } from "react";
import { theme } from "../lib/theme";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Stepper } from "../components/Stepper";
import { lookupSirene } from "../lib/sireneApi";
import type {
  LegalForm,
  OnboardingState,
  RegimeIS,
  RegimeTVA,
  SireneResult,
} from "../lib/types";
import { DEFAULT_ONBOARDING_STATE } from "../lib/types";

const STEPS = [
  { index: 1, label: "Identité" },
  { index: 2, label: "Fiscal" },
  { index: 3, label: "Facturation" },
  { index: 4, label: "Équipe" },
  { index: 5, label: "Serenity" },
  { index: 6, label: "Confirmer" },
];

type Props = {
  onExit: () => void;
};

export function Onboarding({ onExit }: Props) {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE);
  const [submitted, setSubmitted] = useState<null | OnboardingState>(null);

  const update = <K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const next = () => setStep((s) => Math.min(s + 1, 6));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 780, marginBottom: 16 }}>
        <button
          onClick={onExit}
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

      <Card style={{ maxWidth: 780, width: "100%" }}>
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
          Onboarding Samaxan
        </div>

        <h1
          style={{
            fontSize: theme.fontSize.xxl,
            fontWeight: 700,
            margin: "0 0 8px",
            color: theme.color.primary,
          }}
        >
          Créer votre société
        </h1>
        <p style={{ fontSize: theme.fontSize.base, color: theme.color.textMuted, margin: "0 0 28px" }}>
          6 étapes guidées pour initialiser votre tenant comptable.
        </p>

        <Stepper current={step} steps={STEPS} />

        {submitted ? (
          <SubmittedPreview state={submitted} onRestart={() => { setSubmitted(null); setStep(1); setState(DEFAULT_ONBOARDING_STATE); }} />
        ) : (
          <>
            {step === 1 && <Step1Identity state={state} update={update} />}
            {step === 2 && <Step2Fiscal state={state} update={update} />}
            {step === 3 && <Step3Invoicing state={state} update={update} />}
            {step === 4 && <Step4Team state={state} update={update} />}
            {step === 5 && <Step5Serenity state={state} update={update} />}
            {step === 6 && <Step6Confirm state={state} />}

            <div
              style={{
                marginTop: 32,
                paddingTop: 20,
                borderTop: `1px solid ${theme.color.borderSoft}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Button variant="ghost" onClick={prev} disabled={step === 1}>
                Précédent
              </Button>
              <div style={{ fontSize: theme.fontSize.sm, color: theme.color.textSoft }}>
                Étape {step} / 6
              </div>
              {step < 6 ? (
                <Button onClick={next} disabled={!canProceed(step, state)}>
                  Suivant
                </Button>
              ) : (
                <Button onClick={() => setSubmitted(state)}>
                  Créer ma société
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// ===================== GATES =========================================================

function canProceed(step: number, state: OnboardingState): boolean {
  if (step === 1) {
    return (
      state.sirenePreviewLoaded &&
      !!state.name &&
      !!state.siren &&
      !!state.siret &&
      !!state.legal_form &&
      !!state.address.line1 &&
      !!state.address.postal_code &&
      !!state.address.city
    );
  }
  if (step === 2) {
    if (!state.regime_tva || !state.regime_is) return false;
    if (!state.fiscal_year_start || !state.fiscal_year_end) return false;
    // Validation cohérence exercice comptable
    const start = new Date(state.fiscal_year_start);
    const end = new Date(state.fiscal_year_end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
    if (end <= start) return false;
    const days = Math.round((end.getTime() - start.getTime()) / 86400000);
    if (days < 30 || days > 730) return false; // min 1 mois, max 2 ans
    return true;
  }
  if (step === 3) return !!state.invoicing_prefix && !!state.invoicing_avoir_prefix && state.invoicing_next_number > 0;
  if (step === 4) return true; // équipe optionnelle
  if (step === 5) return true; // serenity optionnel
  return true;
}

// ===================== STEP 1 — IDENTITÉ ===============================================

type StepProps = {
  state: OnboardingState;
  update: <K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) => void;
};

function Step1Identity({ state, update }: StepProps) {
  const [sireneLoading, setSireneLoading] = useState(false);
  const [sireneError, setSireneError] = useState<string | null>(null);
  const [sireneWarnings, setSireneWarnings] = useState<string[]>([]);

  const handleLookup = async () => {
    const siren = state.siren.replace(/\s/g, "");
    if (!/^\d{9}$/.test(siren)) {
      setSireneError("SIREN invalide : 9 chiffres attendus");
      return;
    }
    setSireneError(null);
    setSireneWarnings([]);
    setSireneLoading(true);
    try {
      const resp = await lookupSirene(siren);
      if ("ok" in resp && resp.ok) {
        applySireneResult(resp.data);
        setSireneWarnings(resp.warnings);
      } else if ("error" in resp) {
        setSireneError(resp.message ?? resp.error);
      }
    } catch (err) {
      setSireneError(String(err));
    } finally {
      setSireneLoading(false);
    }
  };

  const applySireneResult = (data: SireneResult) => {
    update("siren", data.siren);
    update("siret", data.siret);
    update("name", data.name);
    update("legal_form", data.legal_form as LegalForm);
    update("naf", data.naf ?? "");
    update("rcs", data.rcs ?? "");
    update("address", data.address);
    if (data.president) update("president", data.president);
    update("active", data.active);
    update("date_creation", data.date_creation);
    update("categorie_entreprise", data.categorie_entreprise);
    update("sirenePreviewLoaded", true);
  };

  return (
    <div>
      <SectionTitle
        title="Identité légale"
        hint="Saisissez le SIREN de votre société pour préremplir les champs depuis l'annuaire officiel."
      />

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16 }}>
        <Input
          label="SIREN"
          placeholder="851264606"
          value={state.siren}
          onChange={(e) => update("siren", e.target.value.replace(/\s/g, ""))}
          maxLength={9}
          wrapperStyle={{ flex: 1 }}
          hint="9 chiffres. Ex. Samaxan : 851264606"
          error={sireneError ?? undefined}
          disabled={sireneLoading}
        />
        <Button
          onClick={handleLookup}
          disabled={sireneLoading || state.siren.length !== 9}
          style={{ height: 42 }}
        >
          {sireneLoading ? "Recherche…" : "Rechercher"}
        </Button>
      </div>

      {sireneWarnings.length > 0 && (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fbbf24",
            borderRadius: theme.radius.md,
            padding: 12,
            marginBottom: 16,
            fontSize: theme.fontSize.sm,
          }}
        >
          <strong>Attention :</strong>{" "}
          {sireneWarnings.map((w) => warningLabel(w)).join(" · ")}
        </div>
      )}

      {state.sirenePreviewLoaded && (
        <>
          <div
            style={{
              background: theme.color.bgTint,
              border: `1px solid ${theme.color.accent}22`,
              borderRadius: theme.radius.md,
              padding: 14,
              marginBottom: 20,
              fontSize: theme.fontSize.sm,
              color: theme.color.textMuted,
            }}
          >
            <strong style={{ color: theme.color.primary }}>Données Sirene récupérées.</strong>{" "}
            Les champs ci-dessous sont préremplis mais éditables. Vérifiez et corrigez si nécessaire.
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <Input
              label="Raison sociale"
              value={state.name}
              onChange={(e) => update("name", e.target.value)}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Select
                label="Forme juridique"
                value={state.legal_form}
                onChange={(e) => update("legal_form", e.target.value as LegalForm)}
              >
                <option value="SAS">SAS</option>
                <option value="SASU">SASU</option>
                <option value="SARL">SARL</option>
                <option value="EURL">EURL</option>
                <option value="SA">SA</option>
                <option value="SCI">SCI</option>
                <option value="SNC">SNC</option>
                <option value="SELARL">SELARL</option>
                <option value="SCP">SCP</option>
                <option value="AUTRE">Autre</option>
              </Select>
              <Input
                label="SIRET (siège)"
                value={state.siret}
                onChange={(e) => update("siret", e.target.value)}
                maxLength={14}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <Input
                label="Code NAF"
                value={state.naf}
                onChange={(e) => update("naf", e.target.value)}
                hint="Depuis Sirene"
              />
              <Input
                label="RCS"
                value={state.rcs}
                onChange={(e) => update("rcs", e.target.value)}
                hint="Saisie manuelle"
                placeholder="Ex. Melun"
              />
              <Input
                label="Capital social (€)"
                type="number"
                value={state.capital_amount || ""}
                onChange={(e) => update("capital_amount", Number(e.target.value) || 0)}
                hint="Saisie manuelle"
              />
            </div>

            <SectionTitle title="Adresse" />

            <Input
              label="Adresse (ligne 1)"
              value={state.address.line1}
              onChange={(e) => update("address", { ...state.address, line1: e.target.value })}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 14 }}>
              <Input
                label="Code postal"
                value={state.address.postal_code}
                onChange={(e) => update("address", { ...state.address, postal_code: e.target.value })}
              />
              <Input
                label="Ville"
                value={state.address.city}
                onChange={(e) => update("address", { ...state.address, city: e.target.value })}
              />
              <Input
                label="Pays"
                value={state.address.country}
                onChange={(e) => update("address", { ...state.address, country: e.target.value })}
                maxLength={2}
              />
            </div>

            <SectionTitle title="Dirigeant" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Input
                label="Nom complet"
                value={state.president.name}
                onChange={(e) => update("president", { ...state.president, name: e.target.value })}
              />
              <Input
                label="Fonction"
                value={state.president.role}
                onChange={(e) => update("president", { ...state.president, role: e.target.value })}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ===================== STEP 2 — FISCAL =================================================

function Step2Fiscal({ state, update }: StepProps) {
  return (
    <div>
      <SectionTitle
        title="Régime fiscal"
        hint="Ces choix conditionnent la TVA collectée, la liasse fiscale et les obligations déclaratives."
      />
      <div style={{ display: "grid", gap: 14 }}>
        <Select
          label="Régime TVA"
          value={state.regime_tva}
          onChange={(e) => update("regime_tva", e.target.value as RegimeTVA)}
          hint="Franchise en base : < 37 500 € annuel · Réel simplifié : CA3 trimestriel · Réel normal : CA3 mensuel"
        >
          <option value="franchise">Franchise en base (pas de TVA collectée)</option>
          <option value="reel_simplifie">Réel simplifié</option>
          <option value="reel_normal">Réel normal</option>
        </Select>

        <Select
          label="Régime IS / BIC"
          value={state.regime_is}
          onChange={(e) => update("regime_is", e.target.value as RegimeIS)}
          hint="Détermine la liasse fiscale à produire (2033 réel simplifié, 2050 réel normal)"
        >
          <option value="micro_entreprise">Micro-entreprise</option>
          <option value="reel_simplifie">Réel simplifié (liasse 2033)</option>
          <option value="reel_normal">Réel normal (liasse 2050)</option>
          <option value="is_non_assujetti">Non assujetti IS</option>
        </Select>

        <SectionTitle title="Exercice comptable" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Input
            label="Début d'exercice"
            type="date"
            value={state.fiscal_year_start}
            onChange={(e) => update("fiscal_year_start", e.target.value)}
            hint="Par défaut : 1er janvier"
          />
          <Input
            label="Fin d'exercice"
            type="date"
            value={state.fiscal_year_end}
            onChange={(e) => update("fiscal_year_end", e.target.value)}
            hint="Par défaut : 31 décembre"
          />
        </div>

        <FiscalDurationHint state={state} update={update} />
      </div>
    </div>
  );
}

function FiscalDurationHint({ state, update }: StepProps) {
  const year = new Date().getFullYear();
  const duration = fiscalYearDurationLabel(state.fiscal_year_start, state.fiscal_year_end);
  const isDefault = state.fiscal_year_start === `${year}-01-01` && state.fiscal_year_end === `${year}-12-31`;
  return (
    <div
      style={{
        padding: 12,
        borderRadius: theme.radius.md,
        background: duration.tone === "ok" ? theme.color.bgSoft : "#fef3c7",
        border: `1px solid ${duration.tone === "ok" ? theme.color.border : "#fbbf24"}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        fontSize: theme.fontSize.sm,
      }}
    >
      <div>
        <strong style={{ color: theme.color.text }}>Durée de l'exercice :</strong>{" "}
        <span style={{ color: duration.tone === "ok" ? theme.color.textMuted : "#92400e" }}>
          {duration.text}
        </span>
      </div>
      {!isDefault && (
        <button
          onClick={() => {
            update("fiscal_year_start", `${year}-01-01`);
            update("fiscal_year_end", `${year}-12-31`);
          }}
          style={{
            background: "transparent",
            border: "none",
            color: theme.color.primary,
            cursor: "pointer",
            fontSize: theme.fontSize.sm,
            fontWeight: 600,
            textDecoration: "underline",
          }}
        >
          Remettre à {year}
        </button>
      )}
    </div>
  );
}

// ===================== STEP 3 — FACTURATION ============================================

function Step3Invoicing({ state, update }: StepProps) {
  return (
    <div>
      <SectionTitle
        title="Numérotation des factures"
        hint="La séquence de numérotation est auditable et verrouillée après émission."
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Input
          label="Préfixe facture"
          value={state.invoicing_prefix}
          onChange={(e) => update("invoicing_prefix", e.target.value.toUpperCase())}
          hint="Ex. F, FAC, INV"
          maxLength={6}
        />
        <Input
          label="Préfixe avoir"
          value={state.invoicing_avoir_prefix}
          onChange={(e) => update("invoicing_avoir_prefix", e.target.value.toUpperCase())}
          hint="Ex. AV, AVOIR"
          maxLength={6}
        />
        <Input
          label="Prochain n°"
          type="number"
          value={state.invoicing_next_number}
          onChange={(e) => update("invoicing_next_number", Number(e.target.value) || 1)}
          hint="Point de départ"
        />
      </div>

      <div
        style={{
          marginTop: 20,
          padding: 14,
          background: theme.color.bgSoft,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.md,
          fontSize: theme.fontSize.sm,
          color: theme.color.textMuted,
        }}
      >
        <div style={{ marginBottom: 4 }}>
          <strong style={{ color: theme.color.text }}>Aperçu :</strong>
        </div>
        Première facture : <code>{state.invoicing_prefix}-{new Date().getFullYear()}-{String(state.invoicing_next_number).padStart(4, "0")}</code>
        <br />
        Premier avoir : <code>{state.invoicing_avoir_prefix}-{new Date().getFullYear()}-0001</code>
      </div>
    </div>
  );
}

// ===================== STEP 4 — ÉQUIPE ================================================

function Step4Team({ state, update }: StepProps) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <SectionTitle
        title="Équipe comptable"
        hint="Invitez votre comptable externe ou un collaborateur. Étape optionnelle."
      />
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-end" }}>
        <Input
          label="Email"
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="comptable@cabinet.fr"
          wrapperStyle={{ flex: 1 }}
        />
        <Button
          variant="secondary"
          onClick={() => {
            if (draft && draft.includes("@") && !state.team_emails.includes(draft)) {
              update("team_emails", [...state.team_emails, draft]);
              setDraft("");
            }
          }}
          disabled={!draft || !draft.includes("@")}
          style={{ height: 42 }}
        >
          Ajouter
        </Button>
      </div>

      {state.team_emails.length === 0 ? (
        <p style={{ fontSize: theme.fontSize.sm, color: theme.color.textSoft, margin: "12px 0 0" }}>
          Aucun membre ajouté. Vous pourrez inviter des collaborateurs plus tard depuis les paramètres.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {state.team_emails.map((email) => (
            <div
              key={email}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: theme.color.bgSoft,
                border: `1px solid ${theme.color.border}`,
                borderRadius: theme.radius.md,
                fontSize: theme.fontSize.base,
              }}
            >
              <span>{email}</span>
              <button
                onClick={() => update("team_emails", state.team_emails.filter((e) => e !== email))}
                style={{
                  background: "transparent",
                  border: "none",
                  color: theme.color.danger,
                  cursor: "pointer",
                  fontSize: theme.fontSize.sm,
                }}
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== STEP 5 — SERENITY ===============================================

function Step5Serenity({ state, update }: StepProps) {
  return (
    <div>
      <SectionTitle
        title="Intégration Serenity"
        hint="Liez ce tenant à un compte Serenity pour alimentation automatique des flux (paiements pack, wallet, commandes)."
      />

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: 16,
          background: theme.color.bgSoft,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.md,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={state.link_serenity_user}
          onChange={(e) => update("link_serenity_user", e.target.checked)}
          style={{ marginTop: 3 }}
        />
        <div>
          <div style={{ fontSize: theme.fontSize.base, fontWeight: 600, color: theme.color.text }}>
            Lier ce tenant à un compte Serenity
          </div>
          <div style={{ fontSize: theme.fontSize.sm, color: theme.color.textSoft, marginTop: 4 }}>
            Les flux transactionnels Serenity (paiements pack, recharges Wallet, commandes marketplace) alimenteront automatiquement la comptabilité.
          </div>
        </div>
      </label>

      {state.link_serenity_user && (
        <div style={{ marginTop: 16 }}>
          <Input
            label="ID utilisateur Serenity"
            value={state.serenity_user_id ?? ""}
            onChange={(e) => update("serenity_user_id", e.target.value || null)}
            placeholder="643f7b04-549e-415b-a9d1-1e2c610c16bb"
            hint="UUID du compte Serenity propriétaire. Par défaut : votre UUID."
          />
          <p
            style={{
              fontSize: theme.fontSize.sm,
              color: theme.color.textSoft,
              marginTop: 10,
              fontStyle: "italic",
            }}
          >
            Étape facultative. Vous pourrez lier Serenity plus tard dans les paramètres du tenant.
          </p>
        </div>
      )}
    </div>
  );
}

// ===================== STEP 6 — CONFIRM ================================================

function Step6Confirm({ state }: { state: OnboardingState }) {
  return (
    <div>
      <SectionTitle
        title="Récapitulatif"
        hint="Vérifiez les informations avant de créer votre société."
      />

      <div style={{ display: "grid", gap: 16 }}>
        <SummarySection title="Identité">
          <SummaryRow label="Raison sociale" value={state.name} />
          <SummaryRow label="Forme" value={state.legal_form} />
          <SummaryRow label="SIREN" value={state.siren} />
          <SummaryRow label="SIRET" value={state.siret} />
          <SummaryRow label="NAF" value={state.naf} />
          <SummaryRow label="RCS" value={state.rcs || "—"} />
          <SummaryRow label="Capital" value={`${state.capital_amount} €`} />
        </SummarySection>

        <SummarySection title="Adresse">
          <SummaryRow label="Ligne 1" value={state.address.line1} />
          <SummaryRow label="CP / Ville" value={`${state.address.postal_code} ${state.address.city}`} />
          <SummaryRow label="Pays" value={state.address.country} />
        </SummarySection>

        <SummarySection title="Dirigeant">
          <SummaryRow label="Nom" value={state.president.name || "—"} />
          <SummaryRow label="Fonction" value={state.president.role || "—"} />
        </SummarySection>

        <SummarySection title="Fiscal">
          <SummaryRow label="Régime TVA" value={labelRegimeTVA(state.regime_tva)} />
          <SummaryRow label="Régime IS/BIC" value={labelRegimeIS(state.regime_is)} />
          <SummaryRow label="Exercice" value={`${state.fiscal_year_start} → ${state.fiscal_year_end}`} />
        </SummarySection>

        <SummarySection title="Facturation">
          <SummaryRow label="Préfixes" value={`${state.invoicing_prefix} / ${state.invoicing_avoir_prefix}`} />
          <SummaryRow label="Prochain n°" value={String(state.invoicing_next_number)} />
        </SummarySection>

        {state.team_emails.length > 0 && (
          <SummarySection title="Équipe">
            {state.team_emails.map((e) => (
              <SummaryRow key={e} label="Membre" value={e} />
            ))}
          </SummarySection>
        )}

        {state.link_serenity_user && (
          <SummarySection title="Serenity">
            <SummaryRow label="User ID lié" value={state.serenity_user_id ?? "—"} />
          </SummarySection>
        )}
      </div>

      <div
        style={{
          marginTop: 20,
          padding: 14,
          background: "#ecfdf5",
          border: "1px solid #10b98155",
          borderRadius: theme.radius.md,
          fontSize: theme.fontSize.sm,
          color: "#065f46",
        }}
      >
        <strong>Prochaine étape :</strong> en cliquant "Créer ma société", le payload sera affiché
        et prêt à être envoyé à <code>compta.fn_create_tenant_with_legal_entity</code> (création
        réelle en DB branchée au Lot 1.3 après validation auth JWT).
      </div>
    </div>
  );
}

// ===================== SUBMITTED PREVIEW ===============================================

function SubmittedPreview({ state, onRestart }: { state: OnboardingState; onRestart: () => void }) {
  const rpcPayload = {
    p_user_id: state.serenity_user_id ?? "(user connecté au Lot 1.3)",
    p_tenant_name: state.name,
    p_legal_entity_payload: {
      name: state.name,
      legal_form: state.legal_form,
      siren: state.siren,
      siret: state.siret,
      rcs: state.rcs || null,
      naf: state.naf,
      capital_amount: state.capital_amount,
      address: state.address,
      president: state.president,
      regime_tva: state.regime_tva,
      regime_is: state.regime_is,
      invoicing_config: {
        prefix: state.invoicing_prefix,
        avoir_prefix: state.invoicing_avoir_prefix,
        separator: "-",
        year_format: "YYYY",
        next_numbers: { [new Date().getFullYear()]: state.invoicing_next_number },
      },
      serenity_user_id: state.serenity_user_id,
    },
    p_fiscal_year_start: state.fiscal_year_start,
    p_fiscal_year_end: state.fiscal_year_end,
  };

  return (
    <div>
      <div
        style={{
          padding: 20,
          background: "#ecfdf5",
          border: "1px solid #10b98155",
          borderRadius: theme.radius.md,
          marginBottom: 20,
        }}
      >
        <h2 style={{ fontSize: theme.fontSize.lg, fontWeight: 700, color: "#065f46", margin: "0 0 8px" }}>
          Payload prêt
        </h2>
        <p style={{ fontSize: theme.fontSize.sm, color: "#047857", margin: 0, lineHeight: 1.6 }}>
          Le flux onboarding fonctionne de bout en bout. Le payload JSON ci-dessous sera envoyé
          à la fonction SQL <code>compta.fn_create_tenant_with_legal_entity</code> dès que le Lot 1.3
          (auth JWT + Edge Function de submit) sera livré.
        </p>
      </div>

      <div
        style={{
          background: "#0f172a",
          color: "#e2e8f0",
          padding: 16,
          borderRadius: theme.radius.md,
          fontSize: theme.fontSize.sm,
          fontFamily: "Menlo, Monaco, monospace",
          overflowX: "auto",
          lineHeight: 1.5,
        }}
      >
        <pre style={{ margin: 0 }}>
{JSON.stringify(rpcPayload, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <Button variant="secondary" onClick={onRestart}>
          Recommencer
        </Button>
      </div>
    </div>
  );
}

// ===================== HELPERS COMMUNS ================================================

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h3
        style={{
          fontSize: theme.fontSize.md,
          fontWeight: 700,
          color: theme.color.text,
          margin: "0 0 4px",
        }}
      >
        {title}
      </h3>
      {hint && (
        <p style={{ fontSize: theme.fontSize.sm, color: theme.color.textSoft, margin: 0, lineHeight: 1.5 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        background: theme.color.bgSoft,
      }}
    >
      <div
        style={{
          padding: "8px 14px",
          borderBottom: `1px solid ${theme.color.border}`,
          fontSize: theme.fontSize.xs,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: theme.color.textSoft,
        }}
      >
        {title}
      </div>
      <div style={{ padding: "8px 14px", display: "grid", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: theme.fontSize.sm }}>
      <span style={{ color: theme.color.textSoft }}>{label}</span>
      <span style={{ color: theme.color.text, fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function fiscalYearDurationLabel(start: string, end: string): { text: string; tone: "ok" | "warn" } {
  if (!start || !end) return { text: "—", tone: "warn" };
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return { text: "Dates invalides", tone: "warn" };
  if (e <= s) return { text: "La fin doit être après le début", tone: "warn" };
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  const months = Math.round(days / 30.4);
  if (months < 6) return { text: `${days} jours (${months} mois) — exercice court`, tone: "warn" };
  if (months > 24) return { text: `${days} jours (${months} mois) — exercice exceptionnellement long`, tone: "warn" };
  return { text: `${days} jours (~${months} mois)`, tone: "ok" };
}

function warningLabel(code: string): string {
  if (code === "entreprise_cessee") return "Entreprise cessée";
  if (code.startsWith("nature_juridique_non_mappee")) return `Forme juridique non reconnue (${code.split(":")[1]})`;
  if (code === "pas_de_dirigeant_detectable") return "Aucun dirigeant détecté dans Sirene";
  return code;
}

function labelRegimeTVA(r: RegimeTVA): string {
  return {
    franchise: "Franchise en base",
    reel_simplifie: "Réel simplifié",
    reel_normal: "Réel normal",
  }[r];
}

function labelRegimeIS(r: RegimeIS): string {
  return {
    micro_entreprise: "Micro-entreprise",
    reel_simplifie: "Réel simplifié (liasse 2033)",
    reel_normal: "Réel normal (liasse 2050)",
    is_non_assujetti: "Non assujetti IS",
  }[r];
}
