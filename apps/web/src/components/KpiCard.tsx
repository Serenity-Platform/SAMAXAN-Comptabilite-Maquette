// Paperasse — Carte KPI dense (format Pennylane/Linear)
import type { ReactNode } from "react";
import { theme } from "../lib/theme";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "soft";
};

export function KpiCard({ label, value, hint, icon, tone = "default" }: Props) {
  return (
    <div
      style={{
        background: tone === "soft" ? theme.color.bgSoft : theme.color.bg,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.md,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: theme.fontSize.xs,
            color: theme.color.textSoft,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            fontWeight: 600,
          }}
        >
          {label}
        </div>
        {icon && (
          <div style={{ color: theme.color.textSoft, display: "flex" }}>{icon}</div>
        )}
      </div>
      <div
        style={{
          fontSize: theme.fontSize.xl,
          fontWeight: 700,
          color: theme.color.text,
          lineHeight: 1.1,
          letterSpacing: -0.3,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          style={{
            fontSize: theme.fontSize.xs,
            color: theme.color.textFaint,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
