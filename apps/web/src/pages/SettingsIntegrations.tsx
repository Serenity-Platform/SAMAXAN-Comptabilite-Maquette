// Paperasse Lot 2.1 - Page Paramètres > Intégrations
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Link2, RotateCw, Unplug, AlertCircle } from "lucide-react";
import { theme } from "../lib/theme";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import {
  listBankIntegrations,
  disconnectBankIntegration,
  startRevolutOAuth,
  triggerRevolutSync,
  type BankIntegration,
} from "../lib/bankApi";

type Props = { onBack: () => void };

type FeedbackState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function SettingsIntegrations({ onBack }: Props) {
  const [integrations, setIntegrations] = useState<BankIntegration[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState>({ kind: "idle" });
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Parse les query params après redirection Revolut (revolut_status=success / error)
  useEffect(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf("?");
    if (qIdx === -1) return;
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    const status = params.get("revolut_status");
    if (status === "success") {
      const count = params.get("revolut_accounts_count") ?? "0";
      setFeedback({
        kind: "success",
        message: `Revolut Business connecté (${count} compte${Number(count) > 1 ? "s" : ""} détecté${Number(count) > 1 ? "s" : ""}).`,
      });
    } else if (status === "error") {
      const code = params.get("revolut_error") ?? "unknown";
      const msg = params.get("revolut_message") ?? "";
      setFeedback({
        kind: "error",
        message: msg ? `${code} — ${msg}` : `Échec connexion Revolut : ${code}`,
      });
    }
    // Nettoyer l'URL
    if (status) {
      window.history.replaceState(null, "", "#settings-integrations");
    }
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const list = await listBankIntegrations();
      setIntegrations(list);
    } catch (err) {
      setFeedback({
        kind: "error",
        message: `Chargement des intégrations : ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const revolutIntegration =
    integrations?.find((i) => i.provider === "revolut_business" && i.status === "connected") ?? null;

  const onConnectRevolut = async () => {
    setConnecting(true);
    setFeedback({ kind: "idle" });
    const result = await startRevolutOAuth();
    setConnecting(false);
    if (!result.ok) {
      setFeedback({
        kind: "error",
        message: result.message ?? result.error ?? "Impossible de démarrer OAuth Revolut",
      });
      return;
    }
    window.location.href = result.authorize_url;
  };

  const onDisconnect = async (id: string) => {
    if (!confirm("Déconnecter Revolut Business ? Les transactions déjà importées resteront en base.")) return;
    setDisconnecting(id);
    setFeedback({ kind: "idle" });
    try {
      await disconnectBankIntegration(id);
      setFeedback({ kind: "success", message: "Revolut Business déconnecté." });
      await load();
    } catch (err) {
      setFeedback({
        kind: "error",
        message: `Déconnexion impossible : ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setDisconnecting(null);
    }
  };

  const onSync = async () => {
    setSyncing(true);
    setFeedback({ kind: "idle" });
    const result = await triggerRevolutSync();
    setSyncing(false);
    if (!result.ok) {
      setFeedback({
        kind: "error",
        message: result.message ?? result.error ?? "Synchronisation échouée",
      });
      return;
    }
    const d = result.data;
    setFeedback({
      kind: "success",
      message: `Sync terminée : ${d.new_events} transaction${d.new_events > 1 ? "s" : ""} importée${d.new_events > 1 ? "s" : ""}, ${d.new_proposals} proposition${d.new_proposals > 1 ? "s" : ""} créée${d.new_proposals > 1 ? "s" : ""} (${d.auto_ready_to_post} auto, ${d.review_required} à revoir), ${d.skipped_duplicates} doublon${d.skipped_duplicates > 1 ? "s" : ""} ignoré${d.skipped_duplicates > 1 ? "s" : ""}.`,
    });
    await load();
  };

  return (
    <>
      <PageHeader
        title="Intégrations"
        subtitle="Connectez vos outils tiers à Paperasse"
        actions={
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            Retour
          </Button>
        }
      />

      {feedback.kind === "success" && (
        <FeedbackBox tone="success" message={feedback.message} onClose={() => setFeedback({ kind: "idle" })} />
      )}
      {feedback.kind === "error" && (
        <FeedbackBox tone="error" message={feedback.message} onClose={() => setFeedback({ kind: "idle" })} />
      )}

      {/* Revolut Business */}
      <IntegrationCard
        name="Revolut Business"
        description="Import automatique des transactions bancaires, rapprochement et classification comptable."
        connected={!!revolutIntegration}
        loading={loading}
        integration={revolutIntegration}
        connecting={connecting}
        syncing={syncing}
        disconnecting={!!revolutIntegration && disconnecting === revolutIntegration.id}
        onConnect={onConnectRevolut}
        onDisconnect={() => revolutIntegration && onDisconnect(revolutIntegration.id)}
        onSync={onSync}
      />

      {/* Placeholder futures intégrations */}
      <ComingIntegration
        name="Cdiscount / Octopia"
        description="Récupération des ventes et commissions marketplace."
        badge="Lot 3.x"
      />
      <ComingIntegration
        name="Plateforme de facturation électronique (PPF/PDP)"
        description="Conforme réforme obligation facturation électronique septembre 2026."
        badge="Lot 4.x"
      />
    </>
  );
}

function IntegrationCard({
  name,
  description,
  connected,
  loading,
  integration,
  connecting,
  syncing,
  disconnecting,
  onConnect,
  onDisconnect,
  onSync,
}: {
  name: string;
  description: string;
  connected: boolean;
  loading: boolean;
  integration: BankIntegration | null;
  connecting: boolean;
  syncing: boolean;
  disconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
}) {
  return (
    <div
      style={{
        position: "relative",
        background: theme.color.bg,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        padding: 20,
        marginBottom: 16,
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          height: theme.accent.topBorderHeight,
          background: theme.gradient.serenityHorizontal,
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h2 style={{ fontSize: theme.fontSize.md, fontWeight: 600, color: theme.color.text, margin: 0 }}>
              {name}
            </h2>
            {connected && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: theme.color.success,
                  background: "#ecfdf5",
                  padding: "2px 8px",
                  borderRadius: theme.radius.sm,
                }}
              >
                <Check size={10} /> Connecté
              </span>
            )}
          </div>
          <p style={{ fontSize: theme.fontSize.sm, color: theme.color.textSoft, margin: 0, lineHeight: 1.5 }}>
            {description}
          </p>

          {connected && integration && (
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <MetaItem label="Comptes détectés" value={String(integration.accounts?.length ?? 0)} />
              <MetaItem
                label="Dernière sync"
                value={
                  integration.last_sync_at
                    ? new Date(integration.last_sync_at).toLocaleString("fr-FR")
                    : "Jamais"
                }
              />
              <MetaItem
                label="Transactions au dernier sync"
                value={String(integration.last_sync_tx_count ?? 0)}
              />
            </div>
          )}

          {connected && integration?.last_sync_error && (
            <div
              style={{
                marginTop: 10,
                padding: "8px 12px",
                background: "#fff7ed",
                border: "1px solid #fb923c55",
                borderRadius: theme.radius.md,
                fontSize: theme.fontSize.xs,
                color: "#9a3412",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <AlertCircle size={12} />
              Dernière erreur : {integration.last_sync_error}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!connected && !loading && (
            <Button onClick={onConnect} disabled={connecting}>
              <Link2 size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              {connecting ? "Connexion…" : "Connecter"}
            </Button>
          )}
          {connected && (
            <>
              <Button variant="secondary" onClick={onSync} disabled={syncing}>
                <RotateCw size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                {syncing ? "Sync…" : "Synchroniser"}
              </Button>
              <Button variant="secondary" onClick={onDisconnect} disabled={disconnecting}>
                <Unplug size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                {disconnecting ? "…" : "Déconnecter"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ComingIntegration({
  name,
  description,
  badge,
}: {
  name: string;
  description: string;
  badge: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: theme.color.bgSoft,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        marginBottom: 10,
        opacity: 0.85,
      }}
    >
      <div>
        <div style={{ fontSize: theme.fontSize.base, fontWeight: 600, color: theme.color.textMuted }}>
          {name}
        </div>
        <div style={{ fontSize: theme.fontSize.sm, color: theme.color.textSoft, marginTop: 2 }}>
          {description}
        </div>
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: theme.color.textSoft,
          background: theme.color.bg,
          padding: "3px 8px",
          borderRadius: theme.radius.sm,
          border: `1px solid ${theme.color.border}`,
        }}
      >
        {badge}
      </span>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: theme.color.textSoft, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: theme.fontSize.sm, color: theme.color.text, fontWeight: 500, marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function FeedbackBox({
  tone,
  message,
  onClose,
}: {
  tone: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  const palette =
    tone === "success"
      ? { bg: "#ecfdf5", border: "#10b98155", text: "#065f46" }
      : { bg: "#fef2f2", border: "#dc262655", text: "#991b1b" };
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: theme.radius.md,
        fontSize: theme.fontSize.sm,
        color: palette.text,
        marginBottom: 20,
      }}
    >
      <span>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: "transparent",
          border: "none",
          color: palette.text,
          cursor: "pointer",
          fontSize: theme.fontSize.sm,
          padding: 0,
        }}
      >
        Fermer
      </button>
    </div>
  );
}
