// Paperasse — Design tokens, alignés palette Serenity
export const theme = {
  color: {
    primary: "#431E96",
    accent: "#A202C7",
    text: "#0f172a",
    textMuted: "#475569",
    textSoft: "#64748b",
    textFaint: "#94a3b8",
    bg: "#ffffff",
    bgSoft: "#f8fafc",
    bgTint: "#faf5ff",
    border: "#e2e8f0",
    borderSoft: "#f1f5f9",
    success: "#059669",
    warning: "#d97706",
    danger: "#dc2626",
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 16,
    pill: 999,
  },
  shadow: {
    card: "0 10px 40px rgba(15, 23, 42, 0.08)",
    subtle: "0 1px 2px rgba(15, 23, 42, 0.04)",
  },
  fontSize: {
    xs: 11,
    sm: 12,
    base: 14,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
    hero: 36,
  },
  gradient: {
    // Liseré Serenity violet -> fuchsia (pour top borders des cartes)
    serenityHorizontal: "linear-gradient(90deg, #431E96 0%, #A202C7 100%)",
    // Version plus douce pour fonds (usage ponctuel)
    serenitySoft: "linear-gradient(135deg, #431E9608 0%, #A202C710 100%)",
  },
  accent: {
    // Épaisseur du liseré supérieur sur les cartes
    topBorderHeight: 2,
  },
} as const;
