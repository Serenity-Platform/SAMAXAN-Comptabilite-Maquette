import type { ButtonHTMLAttributes, ReactNode } from "react";
import { theme } from "../lib/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

const variantStyles: Record<Variant, { bg: string; color: string; border: string; hoverBg: string }> = {
  primary: {
    bg: theme.color.primary,
    color: "white",
    border: theme.color.primary,
    hoverBg: "#361881",
  },
  secondary: {
    bg: "white",
    color: theme.color.primary,
    border: theme.color.border,
    hoverBg: theme.color.bgSoft,
  },
  ghost: {
    bg: "transparent",
    color: theme.color.textMuted,
    border: "transparent",
    hoverBg: theme.color.bgSoft,
  },
  danger: {
    bg: theme.color.danger,
    color: "white",
    border: theme.color.danger,
    hoverBg: "#b91c1c",
  },
};

export function Button({ variant = "primary", children, style, onMouseEnter, onMouseLeave, disabled, ...rest }: Props) {
  const v = variantStyles[variant];
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        padding: "10px 18px",
        fontSize: theme.fontSize.base,
        fontWeight: 600,
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        borderRadius: theme.radius.md,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "background-color 0.15s, transform 0.05s",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = v.hoverBg;
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = v.bg;
        onMouseLeave?.(e);
      }}
    >
      {children}
    </button>
  );
}
