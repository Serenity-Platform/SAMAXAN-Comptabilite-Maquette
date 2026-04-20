// Paperasse — Header standardisé pour chaque page
import type { ReactNode } from "react";
import { theme } from "../lib/theme";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        marginBottom: 24,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            fontSize: theme.fontSize.xl,
            fontWeight: 700,
            color: theme.color.text,
            margin: 0,
            letterSpacing: -0.2,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: theme.fontSize.base,
              color: theme.color.textSoft,
              margin: "4px 0 0",
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{actions}</div>
      )}
    </div>
  );
}
