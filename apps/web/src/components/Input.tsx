import type { CSSProperties, InputHTMLAttributes } from "react";
import { theme } from "../lib/theme";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  wrapperStyle?: CSSProperties;
};

export function Input({ label, hint, error, wrapperStyle, ...rest }: Props) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, ...wrapperStyle }}>
      {label && (
        <span style={{ fontSize: theme.fontSize.sm, fontWeight: 600, color: theme.color.text }}>
          {label}
        </span>
      )}
      <input
        {...rest}
        style={{
          padding: "10px 12px",
          fontSize: theme.fontSize.base,
          border: `1px solid ${error ? theme.color.danger : theme.color.border}`,
          borderRadius: theme.radius.md,
          outline: "none",
          background: rest.disabled ? theme.color.bgSoft : "white",
          color: theme.color.text,
          transition: "border-color 0.15s",
          ...rest.style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = theme.color.primary;
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? theme.color.danger : theme.color.border;
          rest.onBlur?.(e);
        }}
      />
      {error ? (
        <span style={{ fontSize: theme.fontSize.xs, color: theme.color.danger }}>{error}</span>
      ) : hint ? (
        <span style={{ fontSize: theme.fontSize.xs, color: theme.color.textSoft }}>{hint}</span>
      ) : null}
    </label>
  );
}
