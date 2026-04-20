import type { CSSProperties, SelectHTMLAttributes, ReactNode } from "react";
import { theme } from "../lib/theme";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  error?: string;
  wrapperStyle?: CSSProperties;
  children: ReactNode;
};

export function Select({ label, hint, error, wrapperStyle, children, ...rest }: Props) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, ...wrapperStyle }}>
      {label && (
        <span style={{ fontSize: theme.fontSize.sm, fontWeight: 600, color: theme.color.text }}>
          {label}
        </span>
      )}
      <select
        {...rest}
        style={{
          padding: "10px 12px",
          fontSize: theme.fontSize.base,
          border: `1px solid ${error ? theme.color.danger : theme.color.border}`,
          borderRadius: theme.radius.md,
          outline: "none",
          background: "white",
          color: theme.color.text,
          cursor: "pointer",
          ...rest.style,
        }}
      >
        {children}
      </select>
      {error ? (
        <span style={{ fontSize: theme.fontSize.xs, color: theme.color.danger }}>{error}</span>
      ) : hint ? (
        <span style={{ fontSize: theme.fontSize.xs, color: theme.color.textSoft }}>{hint}</span>
      ) : null}
    </label>
  );
}
