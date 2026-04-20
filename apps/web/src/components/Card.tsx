import type { CSSProperties, ReactNode } from "react";
import { theme } from "../lib/theme";

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: theme.color.bg,
        borderRadius: theme.radius.xl,
        padding: "32px 40px",
        boxShadow: theme.shadow.card,
        border: `1px solid ${theme.color.border}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
