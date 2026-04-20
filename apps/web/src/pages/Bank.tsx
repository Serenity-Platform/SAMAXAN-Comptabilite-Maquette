// Paperasse Lot 2.1 - Page Banque : liste des transactions bancaires importées
import { useEffect, useMemo, useState } from "react";
import { Landmark, RotateCw, Search, X } from "lucide-react";
import { theme } from "../lib/theme";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import {
  listBankIntegrations,
  listBankTransactions,
  triggerRevolutSync,
  type BankIntegration,
  type BankTransaction,
} from "../lib/bankApi";

type ProcessingFilter = "all" | "classified" | "pending" | "failed";

export function Bank() {
  const [integration, setIntegration] = useState<BankIntegration | null>(null);
  const [txs, setTxs] = useState<BankTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<ProcessingFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<BankTransaction | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const integrations = await listBankIntegrations();
      const connected = integrations.find(
        (i) => i.provider === "revolut_business" && i.status === "connected",
      );
      setIntegration(connected ?? null);

      if (connected) {
        const transactions = await listBankTransactions({ limit: 200 });
        setTxs(transactions);
      } else {
        setTxs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const onSync = async () => {
    setSyncing(true);
    setFeedback(null);
    setError(null);
    const result = await triggerRevolutSync();
    setSyncing(false);
    if (!result.ok) {
      setError(result.message ?? result.error ?? "Synchronisation échouée");
      return;
    }
    const d = result.data;
    setFeedback(
      `${d.new_events} nouvelles transactions, ${d.new_proposals} propositions, ${d.skipped_duplicates} doublons ignorés`,
    );
    await load();
  };

  const filtered = useMemo(() => {
    let list = txs;
    if (filter !== "all") list = list.filter((t) => t.processing_status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => {
        const desc = t.raw_payload?.legs?.[0]?.description ?? "";
        const ref = t.raw_payload?.reference ?? "";
        const ext = t.external_id ?? "";
        return (
          desc.toLowerCase().includes(q) ||
          ref.toLowerCase().includes(q) ||
          ext.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [txs, filter, search]);

  const stats = useMemo(() => {
    const classified = txs.filter((t) => t.processing_status === "classified").length;
    const pending = txs.filter((t) => t.processing_status === "pending").length;
    return { total: txs.length, classified, pending };
  }, [txs]);

  if (loading) {
    return (
      <>
        <PageHeader title="Banque" subtitle="Chargement…" />
      </>
    );
  }

  if (!integration) {
    return (
      <>
        <PageHeader title="Banque" subtitle="Comptes bancaires et transactions" />
        <EmptyState
          icon={Landmark}
          title="Aucune banque connectée"
          description="Connectez votre compte Revolut Business pour importer automatiquement vos transactions et démarrer la tenue comptable."
          action={
            <Button onClick={() => { window.location.hash = "settings-integrations"; }}>
              Aller aux intégrations
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Banque"
        subtitle={`Revolut Business — ${integration.accounts?.length ?? 0} compte${(integration.accounts?.length ?? 0) > 1 ? "s" : ""}`}
        actions={
          <Button onClick={onSync} disabled={syncing}>
            <RotateCw size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            {syncing ? "Synchronisation…" : "Synchroniser"}
          </Button>
        }
      />

      {feedback && (
        <FeedbackBox tone="success" message={feedback} onClose={() => setFeedback(null)} />
      )}
      {error && <FeedbackBox tone="error" message={error} onClose={() => setError(null)} />}

      {/* Bandeau statut + comptes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <StatCard label="Transactions" value={String(stats.total)} />
        <StatCard label="Classifiées" value={String(stats.classified)} tone="success" />
        <StatCard label="À traiter" value={String(stats.pending)} tone="warning" />
        <StatCard
          label="Dernière sync"
          value={
            integration.last_sync_at
              ? new Date(integration.last_sync_at).toLocaleString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Jamais"
          }
        />
      </div>

      {/* Filtres */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 14,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          {(["all", "classified", "pending", "failed"] as ProcessingFilter[]).map((f) => (
            <FilterChip
              key={f}
              active={filter === f}
              onClick={() => setFilter(f)}
              label={
                f === "all"
                  ? "Toutes"
                  : f === "classified"
                  ? "Classifiées"
                  : f === "pending"
                  ? "À traiter"
                  : "Échecs"
              }
            />
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: theme.color.textFaint,
            }}
          />
          <input
            placeholder="Rechercher par description, référence ou ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px 8px 32px",
              border: `1px solid ${theme.color.border}`,
              borderRadius: theme.radius.md,
              fontSize: theme.fontSize.sm,
              outline: "none",
              background: theme.color.bg,
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={txs.length === 0 ? "Aucune transaction importée" : "Aucun résultat"}
          description={
            txs.length === 0
              ? "Cliquez sur Synchroniser pour importer vos transactions depuis Revolut Business."
              : "Aucune transaction ne correspond aux filtres actifs."
          }
        />
      ) : (
        <TransactionsTable txs={filtered} onSelect={setSelected} />
      )}

      {selected && (
        <TransactionDrawer tx={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function TransactionsTable({
  txs,
  onSelect,
}: {
  txs: BankTransaction[];
  onSelect: (t: BankTransaction) => void;
}) {
  return (
    <div
      style={{
        background: theme.color.bg,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: theme.fontSize.sm }}>
        <thead>
          <tr style={{ background: theme.color.bgSoft, borderBottom: `1px solid ${theme.color.border}` }}>
            <Th>Date</Th>
            <Th>Type</Th>
            <Th>Description</Th>
            <Th align="right">Montant</Th>
            <Th>Statut</Th>
            <Th>PCG</Th>
          </tr>
        </thead>
        <tbody>
          {txs.map((tx) => {
            const leg = tx.raw_payload?.legs?.[0];
            const amount = leg?.amount ?? 0;
            const currency = leg?.currency ?? "EUR";
            const desc = leg?.description ?? tx.raw_payload?.reference ?? "—";
            const date = new Date(tx.occurred_at);
            return (
              <tr
                key={tx.id}
                onClick={() => onSelect(tx)}
                style={{
                  borderBottom: `1px solid ${theme.color.borderSoft}`,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.color.bgTint)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Td>
                  <div style={{ color: theme.color.text, fontWeight: 500 }}>
                    {date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </div>
                  <div style={{ color: theme.color.textSoft, fontSize: theme.fontSize.xs }}>
                    {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </Td>
                <Td>
                  <RevolutTypeBadge type={tx.raw_payload?.type ?? "—"} />
                </Td>
                <Td>
                  <div
                    style={{
                      color: theme.color.text,
                      maxWidth: 360,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {desc}
                  </div>
                </Td>
                <Td align="right">
                  <span
                    style={{
                      fontWeight: 600,
                      color: amount < 0 ? theme.color.danger : theme.color.success,
                      fontFamily: "ui-monospace, Menlo, monospace",
                    }}
                  >
                    {amount < 0 ? "" : "+"}
                    {amount.toFixed(2)} {currency}
                  </span>
                </Td>
                <Td>
                  <ProcessingBadge status={tx.processing_status} proposal={tx.proposal_status} />
                </Td>
                <Td>
                  {tx.pcg_debit && tx.pcg_credit ? (
                    <span
                      style={{
                        fontFamily: "ui-monospace, Menlo, monospace",
                        fontSize: theme.fontSize.xs,
                        color: theme.color.textMuted,
                      }}
                    >
                      {tx.pcg_debit} / {tx.pcg_credit}
                    </span>
                  ) : (
                    <span style={{ color: theme.color.textFaint }}>—</span>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      style={{
        textAlign: align ?? "left",
        padding: "10px 14px",
        fontSize: theme.fontSize.xs,
        fontWeight: 600,
        color: theme.color.textMuted,
        textTransform: "uppercase",
        letterSpacing: 0.4,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "right";
}) {
  return (
    <td style={{ textAlign: align ?? "left", padding: "12px 14px", verticalAlign: "middle" }}>
      {children}
    </td>
  );
}

function RevolutTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    fee: "Frais",
    card_payment_fee: "Frais carte",
    atm_fee: "Frais DAB",
    exchange: "Change",
    transfer: "Virement",
    topup: "Recharge",
    payment: "Paiement",
    card_payment: "Carte",
  };
  return (
    <span
      style={{
        fontSize: theme.fontSize.xs,
        padding: "2px 7px",
        borderRadius: theme.radius.sm,
        background: theme.color.bgSoft,
        color: theme.color.textMuted,
        border: `1px solid ${theme.color.border}`,
      }}
    >
      {labels[type] ?? type}
    </span>
  );
}

function ProcessingBadge({
  status,
  proposal,
}: {
  status: string;
  proposal: string | null;
}) {
  if (status === "classified" && proposal === "ready_to_post") {
    return <Badge tone="success">Classée auto</Badge>;
  }
  if (status === "classified" && proposal === "review_required") {
    return <Badge tone="warning">À revoir</Badge>;
  }
  if (status === "pending") return <Badge tone="soft">À traiter</Badge>;
  if (status === "failed") return <Badge tone="danger">Échec</Badge>;
  return <Badge tone="soft">{status}</Badge>;
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "warning" | "danger" | "soft";
}) {
  const palette = {
    success: { bg: "#ecfdf5", fg: "#065f46", border: "#10b98155" },
    warning: { bg: "#fffbeb", fg: "#92400e", border: "#f59e0b55" },
    danger: { bg: "#fef2f2", fg: "#991b1b", border: "#dc262655" },
    soft: { bg: theme.color.bgSoft, fg: theme.color.textMuted, border: theme.color.border },
  }[tone];
  return (
    <span
      style={{
        fontSize: theme.fontSize.xs,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: theme.radius.sm,
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
      }}
    >
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
}) {
  const color =
    tone === "success"
      ? theme.color.success
      : tone === "warning"
      ? theme.color.warning
      : theme.color.text;
  return (
    <div
      style={{
        position: "relative",
        background: theme.color.bg,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        padding: "12px 14px",
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
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          color: theme.color.textSoft,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: theme.fontSize.lg, fontWeight: 700, color, marginTop: 3 }}>
        {value}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: theme.radius.pill,
        border: `1px solid ${active ? theme.color.primary : theme.color.border}`,
        background: active ? theme.color.primary : theme.color.bg,
        color: active ? "white" : theme.color.textMuted,
        fontSize: theme.fontSize.sm,
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.12s",
      }}
    >
      {label}
    </button>
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
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: theme.radius.md,
        fontSize: theme.fontSize.sm,
        color: palette.text,
        marginBottom: 16,
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
          padding: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function TransactionDrawer({
  tx,
  onClose,
}: {
  tx: BankTransaction;
  onClose: () => void;
}) {
  const leg = tx.raw_payload?.legs?.[0];
  const ruleApp = (tx as unknown as { rule_applications?: unknown[] }).rule_applications?.[0] as
    | {
        rule_code?: string;
        rule_version?: string;
        context_snapshot?: Record<string, unknown>;
      }
    | undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.4)",
          zIndex: 40,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(100%, 480px)",
          background: theme.color.bg,
          borderLeft: `1px solid ${theme.color.border}`,
          zIndex: 50,
          overflowY: "auto",
          padding: 20,
          boxShadow: "-10px 0 40px rgba(15, 23, 42, 0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: theme.fontSize.xs, color: theme.color.textSoft, marginBottom: 4 }}>
              Transaction Revolut
            </div>
            <h2 style={{ fontSize: theme.fontSize.lg, fontWeight: 700, color: theme.color.text, margin: 0 }}>
              {leg?.description ?? tx.raw_payload?.reference ?? "Transaction"}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: theme.color.textSoft,
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <DrawerField label="Montant" mono>
          {leg ? `${leg.amount.toFixed(2)} ${leg.currency}` : "—"}
        </DrawerField>
        <DrawerField label="Type Revolut" mono>
          {tx.raw_payload?.type ?? "—"}
        </DrawerField>
        <DrawerField label="État">{tx.raw_payload?.state ?? "—"}</DrawerField>
        <DrawerField label="Date d'exécution">
          {new Date(tx.occurred_at).toLocaleString("fr-FR")}
        </DrawerField>
        <DrawerField label="ID Revolut" mono>
          {tx.external_id}
        </DrawerField>

        <Section title="Proposition comptable">
          {tx.pcg_debit && tx.pcg_credit ? (
            <>
              <DrawerField label="Statut proposition">
                <ProcessingBadge status={tx.processing_status} proposal={tx.proposal_status} />
              </DrawerField>
              <DrawerField label="Compte débit" mono>
                {tx.pcg_debit}
              </DrawerField>
              <DrawerField label="Compte crédit" mono>
                {tx.pcg_credit}
              </DrawerField>
              {tx.confidence_level && (
                <DrawerField label="Confiance">
                  <Badge
                    tone={
                      tx.confidence_level === "high"
                        ? "success"
                        : tx.confidence_level === "medium"
                        ? "warning"
                        : "soft"
                    }
                  >
                    {tx.confidence_level === "high"
                      ? "Élevée"
                      : tx.confidence_level === "medium"
                      ? "Moyenne"
                      : "Faible"}
                  </Badge>
                </DrawerField>
              )}
            </>
          ) : (
            <p style={{ fontSize: theme.fontSize.sm, color: theme.color.textSoft, margin: 0 }}>
              Aucune proposition comptable générée pour cette transaction.
            </p>
          )}
        </Section>

        {ruleApp && (
          <Section title="Règle appliquée">
            <DrawerField label="Code règle" mono>
              {ruleApp.rule_code ?? "—"}
            </DrawerField>
            <DrawerField label="Version" mono>
              {ruleApp.rule_version ?? "—"}
            </DrawerField>
          </Section>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${theme.color.borderSoft}` }}>
      <h3
        style={{
          fontSize: theme.fontSize.xs,
          fontWeight: 700,
          color: theme.color.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          margin: "0 0 10px",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function DrawerField({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        fontSize: theme.fontSize.sm,
        borderBottom: `1px solid ${theme.color.borderSoft}`,
      }}
    >
      <span style={{ color: theme.color.textSoft }}>{label}</span>
      <span
        style={{
          color: theme.color.text,
          fontWeight: 500,
          fontFamily: mono ? "ui-monospace, Menlo, monospace" : undefined,
          textAlign: "right",
          maxWidth: "60%",
          wordBreak: "break-all",
        }}
      >
        {children}
      </span>
    </div>
  );
}
