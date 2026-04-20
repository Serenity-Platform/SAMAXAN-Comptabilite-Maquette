// Paperasse — Page Paramètres (hub)
import { Building2, ChevronRight, Plug, type LucideIcon } from "lucide-react";
import { theme } from "../lib/theme";
import { PageHeader } from "../components/PageHeader";

type Props = {
  onNavigateCompany: () => void;
  onNavigateIntegrations: () => void;
};

export function Settings({ onNavigateCompany, onNavigateIntegrations }: Props) {
  return (
    <>
      <PageHeader
        title="Paramètres"
        subtitle="Configuration de votre tenant et de ses sociétés"
      />

      <div
        style={{
          display: "grid",
          gap: 8,
        }}
      >
        <SettingsItem
          icon={Building2}
          title="Société"
          description="Raison sociale, SIREN, régimes fiscaux, adresse, facturation."
          onClick={onNavigateCompany}
        />

        <DisabledSettingsItem
          title="Équipe"
          description="Inviter un comptable ou un viewer (bientôt)."
          badge="Lot 5.x"
        />

        <SettingsItem
          icon={Plug}
          title="Intégrations"
          description="Revolut Business connecté. Cdiscount, Octopia et facturation électronique à venir."
          onClick={onNavigateIntegrations}
        />

        <DisabledSettingsItem
          title="Règles TVA"
          description="Consultation et personnalisation (tenant_owner)."
          badge="Lot 3.x"
        />
      </div>
    </>
  );
}

function SettingsItem({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: theme.color.bg,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 0.12s, background 0.12s",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = theme.color.primary;
        e.currentTarget.style.background = theme.color.bgTint;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = theme.color.border;
        e.currentTarget.style.background = theme.color.bg;
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 3,
          background: theme.gradient.serenityHorizontal,
        }}
      />
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: theme.radius.md,
          background: theme.color.bgTint,
          color: theme.color.primary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
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
            marginTop: 2,
          }}
        >
          {description}
        </div>
      </div>
      <ChevronRight size={16} color={theme.color.textFaint} />
    </button>
  );
}

function DisabledSettingsItem({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: theme.color.bgSoft,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        opacity: 0.75,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: theme.fontSize.base,
            fontWeight: 600,
            color: theme.color.textMuted,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: theme.fontSize.sm,
            color: theme.color.textSoft,
            marginTop: 2,
          }}
        >
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
          flexShrink: 0,
        }}
      >
        {badge}
      </span>
    </div>
  );
}
