// Paperasse — Écran générique pour les sections à venir (lots 2+)
import type { LucideIcon } from "lucide-react";
import { theme } from "../lib/theme";

type Props = {
  title: string;
  description: string;
  comingIn: string;
  icon: LucideIcon;
};

export function PagePlaceholder({ title, description, comingIn, icon: Icon }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "80px 24px",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: theme.radius.md,
          background: theme.color.bgTint,
          border: `1px solid ${theme.color.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.color.primary,
        }}
      >
        <Icon size={24} />
      </div>
      <h1
        style={{
          fontSize: theme.fontSize.xl,
          fontWeight: 700,
          color: theme.color.text,
          margin: 0,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          fontSize: theme.fontSize.base,
          color: theme.color.textSoft,
          margin: 0,
          maxWidth: 480,
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>
      <div
        style={{
          fontSize: theme.fontSize.xs,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: theme.color.accent,
          background: theme.color.bgTint,
          padding: "6px 14px",
          borderRadius: theme.radius.pill,
        }}
      >
        Disponible {comingIn}
      </div>
    </div>
  );
}
