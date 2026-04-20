// Paperasse Lot 2.2 - Page Banque avec validation de propositions comptables
// Workflow serie : tableau a gauche, drawer lateral avec navigation J/K
// Raccourcis clavier : V valider, R rejeter, U undo, J/K nav, ? aide, Esc close
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Keyboard,
  Landmark,
  RotateCw,
  Search,
  Undo2,
  X,
  XCircle,
} from "lucide-react";
import { theme } from "../lib/theme";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import {
  approveProposal,
  listBankIntegrations,
  listReviewProposals,
  rejectProposal,
  triggerRevolutSync,
  undoProposal,
  type BankIntegration,
  type ProposalFilter,
  type ProposedLine,
  type ReviewProposal,
} from "../lib/bankApi";

type Density = "dense" | "cozy";
type LastAction =
  | { kind: "approve"; proposalId: string; pieceReference: string }
  | { kind: "reject"; proposalId: string }
  | null;
type Toast = {
  id: number;
  tone: "success" | "error" | "info";
  message: string;
  action?: { label: string; onClick: () => void };
};

export function Bank() {
  const [integration, setIntegration] = useState<BankIntegration | null>(null);
  const [proposals, setProposals] = useState<ReviewProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<ProposalFilter>("review_required");
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState<Density>("dense");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<LastAction>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const toastIdRef = useRef(0);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 6000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const integrations = await listBankIntegrations();
      const connected = integrations.find(
        (i) => i.provider === "revolut_business" && i.status === "connected",
      );
      setIntegration(connected ?? null);
      if (connected) {
        const rows = await listReviewProposals({
          source: "revolut_business",
          filter: "all",
        });
        setProposals(rows);
      } else {
        setProposals([]);
      }
    } catch (err) {
      pushToast({ tone: "error", message: errorMsg(err) });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSync = async () => {
    setSyncing(true);
    const result = await triggerRevolutSync();
    setSyncing(false);
    if (!result.ok) {
      pushToast({ tone: "error", message: result.message ?? result.error ?? "Synchronisation echouee" });
      return;
    }
    const d = result.data;
    pushToast({
      tone: "success",
      message: `${d.new_events} transactions, ${d.new_proposals} propositions (${d.auto_ready_to_post} auto, ${d.review_required} a revoir)`,
    });
    await load();
  };

  const filtered = useMemo(() => {
    let list = proposals;
    if (filter !== "all") list = list.filter((p) => p.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => {
        const desc = p.se_raw_payload?.legs?.[0]?.description ?? "";
        const ref = p.se_raw_payload?.reference ?? "";
        return (
          desc.toLowerCase().includes(q) ||
          ref.toLowerCase().includes(q) ||
          p.se_external_id.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [proposals, filter, search]);

  const stats = useMemo(() => {
    const review = proposals.filter((p) => p.status === "review_required").length;
    const ready = proposals.filter((p) => p.status === "ready_to_post").length;
    const done = proposals.filter((p) => p.status === "reviewed").length;
    const rejected = proposals.filter((p) => p.status === "rejected").length;
    return { total: proposals.length, review, ready, done, rejected };
  }, [proposals]);

  const selectedIndex = useMemo(
    () => filtered.findIndex((p) => p.id === selectedId),
    [filtered, selectedId],
  );
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  const selectNext = useCallback(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedIndex < 0) {
      setSelectedId(filtered[0].id);
      return;
    }
    const next = selectedIndex + 1;
    if (next >= filtered.length) {
      setSelectedId(null);
      pushToast({ tone: "info", message: "Fin de liste : toutes les propositions du filtre ont ete parcourues" });
    } else {
      setSelectedId(filtered[next].id);
    }
  }, [filtered, selectedIndex, pushToast]);

  const selectPrev = useCallback(() => {
    if (selectedIndex <= 0) return;
    setSelectedId(filtered[selectedIndex - 1].id);
  }, [filtered, selectedIndex]);

  const doUndo = useCallback(
    async (proposalId: string) => {
      if (actionInProgress) return;
      setActionInProgress(true);
      try {
        await undoProposal(proposalId);
        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposalId
              ? {
                  ...p,
                  status: "review_required",
                  posted_journal_entry_id: null,
                  je_piece_reference: null,
                  je_status: null,
                }
              : p,
          ),
        );
        setLastAction(null);
        pushToast({ tone: "success", message: "Validation annulee, proposition remise en revue" });
      } catch (err) {
        pushToast({ tone: "error", message: errorMsg(err) });
      } finally {
        setActionInProgress(false);
      }
    },
    [actionInProgress, pushToast],
  );

  const doApprove = useCallback(
    async (proposal: ReviewProposal, overrideLines?: ProposedLine[]) => {
      if (actionInProgress) return;
      setActionInProgress(true);
      try {
        const result = await approveProposal({
          proposalId: proposal.id,
          overrideLines: overrideLines ?? null,
        });
        setLastAction({
          kind: "approve",
          proposalId: result.proposal_id,
          pieceReference: result.piece_reference,
        });
        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposal.id
              ? {
                  ...p,
                  status: "reviewed",
                  posted_journal_entry_id: result.journal_entry_id,
                  je_piece_reference: result.piece_reference,
                  je_status: "posted",
                }
              : p,
          ),
        );
        pushToast({
          tone: "success",
          message: `Piece ${result.piece_reference} creee · ${formatAmount(result.total_amount, "EUR")}`,
          action: { label: "Annuler", onClick: () => void doUndo(result.proposal_id) },
        });
        selectNext();
      } catch (err) {
        pushToast({ tone: "error", message: errorMsg(err) });
      } finally {
        setActionInProgress(false);
      }
    },
    [actionInProgress, pushToast, selectNext, doUndo],
  );

  const doReject = useCallback(
    async (proposal: ReviewProposal, reason: string) => {
      if (actionInProgress) return;
      setActionInProgress(true);
      try {
        await rejectProposal({ proposalId: proposal.id, rejectionReason: reason });
        setLastAction({ kind: "reject", proposalId: proposal.id });
        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposal.id ? { ...p, status: "rejected", rejection_reason: reason } : p,
          ),
        );
        pushToast({ tone: "info", message: "Proposition rejetee" });
        selectNext();
      } catch (err) {
        pushToast({ tone: "error", message: errorMsg(err) });
      } finally {
        setActionInProgress(false);
      }
    },
    [actionInProgress, pushToast, selectNext],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField =
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (inField) {
        if (e.key === "Escape") (target as HTMLInputElement).blur();
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      } else if (e.key === "Escape") {
        setSelectedId(null);
        setShortcutsOpen(false);
      } else if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        selectNext();
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        selectPrev();
      } else if ((e.key === "v" || e.key === "V") && selected && selected.status !== "reviewed") {
        e.preventDefault();
        void doApprove(selected);
      } else if ((e.key === "u" || e.key === "U") && lastAction?.kind === "approve") {
        e.preventDefault();
        void doUndo(lastAction.proposalId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doApprove, doUndo, selectNext, selectPrev, selected, lastAction]);

  if (loading) {
    return <PageHeader title="Banque" subtitle="Chargement..." />;
  }

  if (!integration) {
    return (
      <>
        <PageHeader title="Banque" subtitle="Comptes bancaires et propositions comptables" />
        <EmptyState
          icon={Landmark}
          title="Aucune banque connectee"
          description="Connectez votre compte Revolut Business pour importer vos transactions et demarrer la tenue comptable."
          action={
            <Button onClick={() => (window.location.hash = "settings-integrations")}>
              Aller aux integrations
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
        subtitle={`Revolut Business · ${integration.accounts?.length ?? 0} compte${(integration.accounts?.length ?? 0) > 1 ? "s" : ""}`}
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <DensityToggle density={density} onChange={setDensity} />
            <Button onClick={onSync} disabled={syncing}>
              <RotateCw size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              {syncing ? "Synchronisation..." : "Synchroniser"}
            </Button>
          </div>
        }
      />

      <StatsBar stats={stats} filter={filter} onFilter={setFilter} integration={integration} />

      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200, position: "relative", maxWidth: 420 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: theme.color.textFaint,
              pointerEvents: "none",
            }}
          />
          <input
            placeholder="Description, reference, ID Revolut..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px 7px 30px",
              border: `1px solid ${theme.color.border}`,
              borderRadius: theme.radius.md,
              fontSize: theme.fontSize.sm,
              outline: "none",
              background: theme.color.bg,
              boxSizing: "border-box",
            }}
          />
        </div>
        <button
          onClick={() => setShortcutsOpen(true)}
          style={iconButtonStyle}
          title="Raccourcis clavier (?)"
        >
          <Keyboard size={14} />
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={filter === "review_required" ? CheckCircle2 : Landmark}
          title={
            proposals.length === 0
              ? "Aucune proposition importee"
              : filter === "review_required"
                ? "Tout est a jour"
                : "Aucun resultat"
          }
          description={
            proposals.length === 0
              ? "Cliquez sur Synchroniser pour importer vos transactions Revolut."
              : filter === "review_required"
                ? "Toutes les propositions en attente ont ete traitees."
                : "Aucune proposition ne correspond aux filtres."
          }
        />
      ) : (
        <ProposalsTable
          proposals={filtered}
          selectedId={selectedId}
          onSelect={setSelectedId}
          density={density}
        />
      )}

      {selected && (
        <ProposalDrawer
          proposal={selected}
          currentIndex={selectedIndex}
          totalCount={filtered.length}
          onClose={() => setSelectedId(null)}
          onNext={selectNext}
          onPrev={selectPrev}
          onApprove={(override) => void doApprove(selected, override)}
          onReject={(reason) => void doReject(selected, reason)}
          onUndo={() => void doUndo(selected.id)}
          actionInProgress={actionInProgress}
        />
      )}

      <ToastStack
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </>
  );
}

// ============================================================
// Sous-composants
// ============================================================
function StatsBar({
  stats,
  filter,
  onFilter,
  integration,
}: {
  stats: { total: number; review: number; ready: number; done: number; rejected: number };
  filter: ProposalFilter;
  onFilter: (f: ProposalFilter) => void;
  integration: BankIntegration;
}) {
  const chips: Array<{
    key: ProposalFilter;
    label: string;
    count: number;
    tone?: "warning" | "success" | "neutral";
  }> = [
    { key: "review_required", label: "A revoir", count: stats.review, tone: "warning" },
    { key: "ready_to_post", label: "Auto-postees", count: stats.ready, tone: "neutral" },
    { key: "reviewed", label: "Validees", count: stats.done, tone: "success" },
    { key: "rejected", label: "Rejetees", count: stats.rejected, tone: "neutral" },
    { key: "all", label: "Toutes", count: stats.total, tone: "neutral" },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginBottom: 14,
        flexWrap: "wrap",
        padding: "10px 12px",
        background: theme.color.bgSoft,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
      }}
    >
      {chips.map((chip) => (
        <FilterChip
          key={chip.key}
          active={filter === chip.key}
          onClick={() => onFilter(chip.key)}
          label={chip.label}
          count={chip.count}
          tone={chip.tone}
        />
      ))}
      <div style={{ flex: 1 }} />
      <span
        style={{
          fontSize: theme.fontSize.xs,
          color: theme.color.textSoft,
          fontFamily: "ui-monospace, Menlo, monospace",
        }}
      >
        {integration.last_sync_at
          ? `sync ${new Date(integration.last_sync_at).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "jamais synchronise"}
      </span>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: "warning" | "success" | "neutral";
}) {
  const toneColor =
    tone === "warning"
      ? theme.color.warning
      : tone === "success"
        ? theme.color.success
        : theme.color.textMuted;
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 10px",
        borderRadius: theme.radius.pill,
        border: `1px solid ${active ? theme.color.primary : theme.color.border}`,
        background: active ? theme.color.primary : theme.color.bg,
        color: active ? "white" : theme.color.text,
        fontSize: theme.fontSize.sm,
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.12s",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span>{label}</span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          padding: "1px 6px",
          borderRadius: theme.radius.pill,
          background: active ? "rgba(255,255,255,0.25)" : toneColor + "22",
          color: active ? "white" : toneColor,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function DensityToggle({
  density,
  onChange,
}: {
  density: Density;
  onChange: (d: Density) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        padding: 2,
        background: theme.color.bg,
      }}
    >
      {(["dense", "cozy"] as Density[]).map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          style={{
            padding: "4px 10px",
            borderRadius: theme.radius.sm,
            border: "none",
            background: density === d ? theme.color.primary : "transparent",
            color: density === d ? "white" : theme.color.textMuted,
            fontSize: theme.fontSize.xs,
            fontWeight: 500,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
          title={d === "dense" ? "Vue dense" : "Vue aeree"}
        >
          {d === "dense" ? <Eye size={12} /> : <EyeOff size={12} />}
          {d === "dense" ? "Dense" : "Aeree"}
        </button>
      ))}
    </div>
  );
}

function ProposalsTable({
  proposals,
  selectedId,
  onSelect,
  density,
}: {
  proposals: ReviewProposal[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  density: Density;
}) {
  const rowPadding = density === "dense" ? "7px 12px" : "12px 14px";
  const font = density === "dense" ? theme.fontSize.sm : theme.fontSize.base;

  return (
    <div
      style={{
        background: theme.color.bg,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: font }}>
        <thead>
          <tr
            style={{
              background: theme.color.bgSoft,
              borderBottom: `1px solid ${theme.color.border}`,
            }}
          >
            <Th>Date</Th>
            <Th>Description</Th>
            <Th align="right">Montant</Th>
            <Th>PCG</Th>
            <Th>Statut</Th>
            <Th>Conf.</Th>
          </tr>
        </thead>
        <tbody>
          {proposals.map((p) => {
            const leg = p.se_raw_payload?.legs?.[0];
            const amount = leg?.amount ?? 0;
            const currency = leg?.currency ?? "EUR";
            const desc = leg?.description ?? p.se_raw_payload?.reference ?? "-";
            const date = new Date(p.se_occurred_at);
            const isSelected = p.id === selectedId;
            const pcgDebit = p.proposed_lines[0]?.account_pcg ?? "-";
            const pcgCredit = p.proposed_lines[1]?.account_pcg ?? "-";
            return (
              <tr
                key={p.id}
                onClick={() => onSelect(p.id)}
                style={{
                  borderBottom: `1px solid ${theme.color.borderSoft}`,
                  cursor: "pointer",
                  background: isSelected ? theme.color.bgTint : "transparent",
                  borderLeft: isSelected
                    ? `3px solid ${theme.color.primary}`
                    : "3px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = theme.color.bgSoft;
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <Td padding={rowPadding}>
                  <div style={{ color: theme.color.text, fontWeight: 500 }}>
                    {date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </div>
                  {density === "cozy" && (
                    <div
                      style={{
                        color: theme.color.textSoft,
                        fontSize: theme.fontSize.xs,
                      }}
                    >
                      {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </Td>
                <Td padding={rowPadding}>
                  <div
                    style={{
                      color: theme.color.text,
                      maxWidth: density === "dense" ? 360 : 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {desc}
                  </div>
                  {density === "cozy" && <RevolutTypeBadge type={p.se_raw_payload?.type ?? "-"} />}
                </Td>
                <Td padding={rowPadding} align="right">
                  <span
                    style={{
                      fontWeight: 600,
                      color: amount < 0 ? theme.color.danger : theme.color.success,
                      fontFamily: "ui-monospace, Menlo, monospace",
                    }}
                  >
                    {formatAmount(amount, currency)}
                  </span>
                </Td>
                <Td padding={rowPadding}>
                  <span
                    style={{
                      fontFamily: "ui-monospace, Menlo, monospace",
                      fontSize: theme.fontSize.xs,
                      color: theme.color.textMuted,
                    }}
                  >
                    {pcgDebit} / {pcgCredit}
                  </span>
                </Td>
                <Td padding={rowPadding}>
                  <StatusBadge status={p.status} pieceRef={p.je_piece_reference} />
                </Td>
                <Td padding={rowPadding}>
                  <ConfidenceDot level={p.confidence_level} />
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
        padding: "9px 12px",
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
  padding,
}: {
  children: React.ReactNode;
  align?: "right";
  padding: string;
}) {
  return (
    <td style={{ textAlign: align ?? "left", padding, verticalAlign: "middle" }}>{children}</td>
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
        display: "inline-block",
        marginTop: 2,
        fontSize: 10,
        padding: "1px 6px",
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

function StatusBadge({ status, pieceRef }: { status: string; pieceRef: string | null }) {
  if (status === "reviewed") {
    return (
      <span style={badgeStyle("success")} title={pieceRef ?? undefined}>
        Validee{pieceRef ? ` · ${pieceRef}` : ""}
      </span>
    );
  }
  if (status === "ready_to_post") return <span style={badgeStyle("info")}>Auto-postee</span>;
  if (status === "rejected") return <span style={badgeStyle("danger")}>Rejetee</span>;
  if (status === "review_required") return <span style={badgeStyle("warning")}>A revoir</span>;
  return <span style={badgeStyle("soft")}>{status}</span>;
}

function ConfidenceDot({ level }: { level: "low" | "medium" | "high" | null }) {
  const color =
    level === "high"
      ? theme.color.success
      : level === "medium"
        ? theme.color.warning
        : level === "low"
          ? theme.color.danger
          : theme.color.textFaint;
  const label =
    level === "high" ? "Elevee" : level === "medium" ? "Moyenne" : level === "low" ? "Faible" : "-";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: theme.fontSize.xs,
        color: theme.color.textMuted,
      }}
      title={`Confiance : ${label}`}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
        }}
      />
      {label}
    </span>
  );
}

// ============================================================
// Drawer
// ============================================================
type DrawerProps = {
  proposal: ReviewProposal;
  currentIndex: number;
  totalCount: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onApprove: (override?: ProposedLine[]) => void;
  onReject: (reason: string) => void;
  onUndo: () => void;
  actionInProgress: boolean;
};

function ProposalDrawer({
  proposal,
  currentIndex,
  totalCount,
  onClose,
  onNext,
  onPrev,
  onApprove,
  onReject,
  onUndo,
  actionInProgress,
}: DrawerProps) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [editingLines, setEditingLines] = useState<ProposedLine[] | null>(null);

  useEffect(() => {
    setRejectMode(false);
    setRejectReason("");
    setEditingLines(null);
  }, [proposal.id]);

  const leg = proposal.se_raw_payload?.legs?.[0];
  const amount = leg?.amount ?? 0;
  const currency = leg?.currency ?? "EUR";
  const desc = leg?.description ?? proposal.se_raw_payload?.reference ?? "Transaction";
  const lines = editingLines ?? proposal.proposed_lines;
  const sumDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const sumCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
  const balanced = Math.abs(sumDebit - sumCredit) < 0.01 && sumDebit > 0;
  const ruleApp = proposal.rule_applications?.[0];
  const isApprovable =
    proposal.status === "review_required" || proposal.status === "ready_to_post";
  const isUndoable = proposal.status === "reviewed" && proposal.je_status !== "locked";

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.35)", zIndex: 40 }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(100%, 560px)",
          background: theme.color.bg,
          borderLeft: `1px solid ${theme.color.border}`,
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-10px 0 40px rgba(15,23,42,0.15)",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${theme.color.borderSoft}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            position: "relative",
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
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: theme.fontSize.xs,
                color: theme.color.textSoft,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>
                {currentIndex + 1} / {totalCount}
              </span>
              <span style={{ color: theme.color.textFaint }}>·</span>
              <span>{new Date(proposal.se_occurred_at).toLocaleDateString("fr-FR")}</span>
              <span style={{ color: theme.color.textFaint }}>·</span>
              <RevolutTypeBadge type={proposal.se_raw_payload?.type ?? "-"} />
            </div>
            <h2
              style={{
                fontSize: theme.fontSize.lg,
                fontWeight: 700,
                color: theme.color.text,
                margin: "4px 0 0",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {desc}
            </h2>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={onPrev}
              disabled={currentIndex <= 0}
              style={{
                ...iconButtonStyle,
                opacity: currentIndex <= 0 ? 0.3 : 1,
                cursor: currentIndex <= 0 ? "not-allowed" : "pointer",
                transform: "rotate(180deg)",
              }}
              title="Precedent (K)"
            >
              <ArrowRight size={14} />
            </button>
            <button
              onClick={onNext}
              disabled={currentIndex >= totalCount - 1}
              style={{
                ...iconButtonStyle,
                opacity: currentIndex >= totalCount - 1 ? 0.3 : 1,
                cursor: currentIndex >= totalCount - 1 ? "not-allowed" : "pointer",
              }}
              title="Suivant (J)"
            >
              <ArrowRight size={14} />
            </button>
            <button onClick={onClose} style={iconButtonStyle} title="Fermer (Esc)">
              <X size={14} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: theme.fontSize.hero,
                fontWeight: 700,
                color: amount < 0 ? theme.color.danger : theme.color.success,
                fontFamily: "ui-monospace, Menlo, monospace",
                lineHeight: 1,
              }}
            >
              {formatAmount(amount, currency)}
            </span>
            <ConfidenceDot level={proposal.confidence_level} />
          </div>
          <div
            style={{ fontSize: theme.fontSize.xs, color: theme.color.textSoft, marginBottom: 20 }}
          >
            ID Revolut&nbsp;
            <code
              style={{
                padding: "1px 5px",
                borderRadius: theme.radius.sm,
                background: theme.color.bgSoft,
                fontSize: 10,
              }}
            >
              {proposal.se_external_id}
            </code>
          </div>

          <Section title="Proposition comptable">
            <LinesEditor
              lines={lines}
              onChange={(next) => setEditingLines(next)}
              readonly={!isApprovable}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
                fontSize: theme.fontSize.xs,
                color: balanced ? theme.color.success : theme.color.danger,
                fontWeight: 500,
              }}
            >
              <span>Debit : {formatAmount(sumDebit, currency)}</span>
              <span>Credit : {formatAmount(sumCredit, currency)}</span>
              <span>
                {balanced
                  ? "Equilibree"
                  : `Ecart : ${formatAmount(Math.abs(sumDebit - sumCredit), currency)}`}
              </span>
            </div>
          </Section>

          {ruleApp && (
            <Section title="Regle appliquee">
              <DetailRow label="Code" value={<Code>{ruleApp.rule_code ?? "-"}</Code>} />
              <DetailRow label="Version" value={<Code>{ruleApp.rule_version ?? "-"}</Code>} />
              {ruleApp.context_snapshot && (
                <details style={{ marginTop: 8 }}>
                  <summary
                    style={{
                      fontSize: theme.fontSize.xs,
                      color: theme.color.textMuted,
                      cursor: "pointer",
                    }}
                  >
                    <ChevronDown size={12} style={{ verticalAlign: -2 }} /> Contexte applique
                  </summary>
                  <pre
                    style={{
                      marginTop: 6,
                      padding: 10,
                      background: theme.color.bgSoft,
                      borderRadius: theme.radius.sm,
                      fontSize: 10,
                      color: theme.color.textMuted,
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(ruleApp.context_snapshot, null, 2)}
                  </pre>
                </details>
              )}
            </Section>
          )}

          {proposal.je_piece_reference && (
            <Section title="Ecriture comptable">
              <DetailRow label="Piece" value={<Code>{proposal.je_piece_reference}</Code>} />
              <DetailRow
                label="Journal"
                value={proposal.journal_label ?? proposal.journal_code ?? "-"}
              />
              <DetailRow
                label="Statut"
                value={<StatusBadge status={proposal.je_status ?? ""} pieceRef={null} />}
              />
            </Section>
          )}

          {proposal.status === "rejected" && proposal.rejection_reason && (
            <Section title="Motif de rejet">
              <div style={{ fontSize: theme.fontSize.sm, color: theme.color.danger }}>
                {proposal.rejection_reason}
              </div>
            </Section>
          )}
        </div>

        <div
          style={{
            padding: "12px 20px",
            borderTop: `1px solid ${theme.color.borderSoft}`,
            background: theme.color.bgSoft,
          }}
        >
          {rejectMode ? (
            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              <input
                autoFocus
                placeholder="Motif de rejet (obligatoire)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  border: `1px solid ${theme.color.border}`,
                  borderRadius: theme.radius.md,
                  fontSize: theme.fontSize.sm,
                  outline: "none",
                }}
              />
              <Button variant="ghost" onClick={() => setRejectMode(false)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                disabled={!rejectReason.trim() || actionInProgress}
                onClick={() => onReject(rejectReason.trim())}
              >
                Confirmer rejet
              </Button>
            </div>
          ) : isApprovable ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="ghost"
                onClick={() => setRejectMode(true)}
                disabled={actionInProgress}
              >
                <XCircle size={14} style={{ marginRight: 5, verticalAlign: -2 }} />
                Rejeter (R)
              </Button>
              <div style={{ flex: 1 }} />
              <Button
                onClick={() => onApprove(editingLines ?? undefined)}
                disabled={!balanced || actionInProgress}
              >
                <CheckCircle2 size={14} style={{ marginRight: 5, verticalAlign: -2 }} />
                {currentIndex < totalCount - 1 ? "Valider et suivant (V)" : "Valider (V)"}
              </Button>
            </div>
          ) : isUndoable ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" onClick={onUndo} disabled={actionInProgress}>
                <Undo2 size={14} style={{ marginRight: 5, verticalAlign: -2 }} />
                Annuler la validation
              </Button>
              <div style={{ flex: 1 }} />
              <Button variant="ghost" onClick={onNext}>
                Suivant <ArrowRight size={14} style={{ marginLeft: 5, verticalAlign: -2 }} />
              </Button>
            </div>
          ) : (
            <div style={{ textAlign: "right" }}>
              <Button variant="ghost" onClick={onNext}>
                Suivant <ArrowRight size={14} style={{ marginLeft: 5, verticalAlign: -2 }} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function LinesEditor({
  lines,
  onChange,
  readonly,
}: {
  lines: ProposedLine[];
  onChange: (next: ProposedLine[]) => void;
  readonly: boolean;
}) {
  const setLine = (idx: number, patch: Partial<ProposedLine>) => {
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  return (
    <div
      style={{
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "90px 1fr 110px 110px",
          background: theme.color.bgSoft,
          padding: "8px 12px",
          fontSize: 10,
          fontWeight: 700,
          color: theme.color.textMuted,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          gap: 8,
        }}
      >
        <span>Compte</span>
        <span>Libelle</span>
        <span style={{ textAlign: "right" }}>Debit</span>
        <span style={{ textAlign: "right" }}>Credit</span>
      </div>
      {lines.map((line, idx) => (
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: "90px 1fr 110px 110px",
            padding: "8px 12px",
            borderTop: idx === 0 ? "none" : `1px solid ${theme.color.borderSoft}`,
            gap: 8,
            alignItems: "center",
          }}
        >
          <input
            value={line.account_pcg}
            onChange={(e) => setLine(idx, { account_pcg: e.target.value })}
            readOnly={readonly}
            style={{
              ...cellInputStyle,
              fontFamily: "ui-monospace, Menlo, monospace",
              fontWeight: 600,
            }}
          />
          <input
            value={line.label ?? ""}
            onChange={(e) => setLine(idx, { label: e.target.value })}
            readOnly={readonly}
            style={cellInputStyle}
          />
          <input
            type="number"
            step="0.01"
            value={line.debit || ""}
            onChange={(e) => setLine(idx, { debit: Number(e.target.value) || 0 })}
            readOnly={readonly}
            style={{
              ...cellInputStyle,
              textAlign: "right",
              fontFamily: "ui-monospace, Menlo, monospace",
            }}
          />
          <input
            type="number"
            step="0.01"
            value={line.credit || ""}
            onChange={(e) => setLine(idx, { credit: Number(e.target.value) || 0 })}
            readOnly={readonly}
            style={{
              ...cellInputStyle,
              textAlign: "right",
              fontFamily: "ui-monospace, Menlo, monospace",
            }}
          />
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
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

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        fontSize: theme.fontSize.sm,
      }}
    >
      <span style={{ color: theme.color.textSoft }}>{label}</span>
      <span style={{ color: theme.color.text, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        padding: "1px 6px",
        borderRadius: theme.radius.sm,
        background: theme.color.bgSoft,
        fontFamily: "ui-monospace, Menlo, monospace",
        fontSize: theme.fontSize.xs,
        color: theme.color.textMuted,
      }}
    >
      {children}
    </code>
  );
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 60,
        maxWidth: 420,
      }}
    >
      {toasts.map((t) => {
        const palette =
          t.tone === "success"
            ? { bg: "#065f46", text: "#ffffff", accent: theme.color.success }
            : t.tone === "error"
              ? { bg: "#991b1b", text: "#ffffff", accent: theme.color.danger }
              : { bg: theme.color.text, text: "#ffffff", accent: theme.color.primary };
        return (
          <div
            key={t.id}
            style={{
              background: palette.bg,
              color: palette.text,
              padding: "10px 14px",
              borderRadius: theme.radius.md,
              boxShadow: "0 10px 30px rgba(15,23,42,0.25)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: theme.fontSize.sm,
              fontWeight: 500,
              borderLeft: `3px solid ${palette.accent}`,
            }}
          >
            <span style={{ flex: 1 }}>{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action?.onClick();
                  onDismiss(t.id);
                }}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  color: "white",
                  border: "none",
                  padding: "4px 10px",
                  borderRadius: theme.radius.sm,
                  cursor: "pointer",
                  fontSize: theme.fontSize.xs,
                  fontWeight: 600,
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => onDismiss(t.id)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                cursor: "pointer",
                opacity: 0.7,
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts: Array<[string, string]> = [
    ["V", "Valider la proposition selectionnee"],
    ["R", "Rejeter (demande un motif)"],
    ["U", "Annuler la derniere validation"],
    ["J ou ↓", "Proposition suivante"],
    ["K ou ↑", "Proposition precedente"],
    ["Esc", "Fermer le panneau / cet ecran"],
    ["?", "Afficher/masquer cet ecran"],
  ];
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.5)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.color.bg,
          borderRadius: theme.radius.lg,
          padding: 24,
          minWidth: 360,
          maxWidth: 480,
          width: "100%",
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: theme.fontSize.lg, fontWeight: 700 }}>
            Raccourcis clavier
          </h3>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={iconButtonStyle}>
            <X size={14} />
          </button>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {shortcuts.map(([key, label]) => (
            <div
              key={key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                fontSize: theme.fontSize.sm,
                borderBottom: `1px solid ${theme.color.borderSoft}`,
              }}
            >
              <span style={{ color: theme.color.text }}>{label}</span>
              <kbd
                style={{
                  fontFamily: "ui-monospace, Menlo, monospace",
                  fontSize: theme.fontSize.xs,
                  padding: "3px 8px",
                  background: theme.color.bgSoft,
                  border: `1px solid ${theme.color.border}`,
                  borderRadius: theme.radius.sm,
                  color: theme.color.textMuted,
                }}
              >
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Styles helpers
// ============================================================
const iconButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  padding: 6,
  cursor: "pointer",
  color: theme.color.textMuted,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const cellInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "5px 8px",
  border: `1px solid ${theme.color.borderSoft}`,
  borderRadius: theme.radius.sm,
  fontSize: theme.fontSize.sm,
  outline: "none",
  background: theme.color.bg,
  boxSizing: "border-box",
};

function badgeStyle(
  tone: "success" | "warning" | "danger" | "info" | "soft",
): React.CSSProperties {
  const p = {
    success: { bg: "#ecfdf5", fg: "#065f46", border: "#10b98155" },
    warning: { bg: "#fffbeb", fg: "#92400e", border: "#f59e0b55" },
    danger: { bg: "#fef2f2", fg: "#991b1b", border: "#dc262655" },
    info: { bg: "#eff6ff", fg: "#1e40af", border: "#3b82f655" },
    soft: { bg: theme.color.bgSoft, fg: theme.color.textMuted, border: theme.color.border },
  }[tone];
  return {
    display: "inline-block",
    fontSize: theme.fontSize.xs,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: theme.radius.sm,
    background: p.bg,
    color: p.fg,
    border: `1px solid ${p.border}`,
  };
}

function formatAmount(amount: number, currency: string): string {
  const sign = amount < 0 ? "" : "+";
  const abs = Math.abs(amount).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? "-" : sign}${abs} ${currency}`;
}

function errorMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
