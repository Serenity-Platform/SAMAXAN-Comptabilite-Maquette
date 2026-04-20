// Paperasse — État vide standardisé
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { theme } from "../lib/theme";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
};

export function EmptyState({ icon: Icon, title, description, action, compact }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: compact ? "28px 20px" : "48px 24px",
        background: theme.color.bgSoft,
        border: `1px dashed ${theme.color.border}`,
        borderRadius: theme.radius.md,
        gap: 10,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          background: theme.color.bg,
          border: `1px solid ${theme.color.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.color.textSoft,
        }}
      >
        <Icon size={20} />
      </div>
      <div
        style={{
          fontSize: theme.fontSize.md,
          fontWeight: 600,
          color: theme.color.text,
        }}
      >
        {title}
      </div>
      {description && (
        <p
          style={{
            fontSize: theme.fontSize.sm,
            color: theme.color.textSoft,
            margin: 0,
            maxWidth: 420,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}
