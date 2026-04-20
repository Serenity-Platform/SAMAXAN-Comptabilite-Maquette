// Paperasse — Sidebar applicative (desktop fixe, mobile drawer via parent)
import { theme } from "../lib/theme";
import { NAV_ITEMS, type NavRoute } from "../lib/navigation";

type Props = {
  currentRoute: NavRoute;
  onNavigate: (route: NavRoute) => void;
  tenantName: string;
};

export function Sidebar({ currentRoute, onNavigate, tenantName }: Props) {
  return (
    <nav
      aria-label="Navigation principale"
      style={{
        width: 240,
        minWidth: 240,
        height: "100vh",
        background: theme.color.bg,
        borderRight: `1px solid ${theme.color.border}`,
        display: "flex",
        flexDirection: "column",
        padding: "20px 0",
      }}
    >
      {/* Brand */}
      <div style={{ padding: "0 20px 20px", borderBottom: `1px solid ${theme.color.borderSoft}` }}>
        <div
          style={{
            fontSize: theme.fontSize.lg,
            fontWeight: 700,
            color: theme.color.primary,
            letterSpacing: -0.3,
            lineHeight: 1.1,
          }}
        >
          Paperasse
        </div>
        <div
          style={{
            fontSize: theme.fontSize.xs,
            color: theme.color.textSoft,
            marginTop: 2,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          {tenantName}
        </div>
      </div>

      {/* Nav items */}
      <ul style={{ listStyle: "none", margin: 0, padding: "12px 10px", display: "grid", gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const active = currentRoute === item.route ||
            (item.route === "settings" && currentRoute === "settings-company");
          const disabled = item.status === "coming_soon";
          const Icon = item.icon;
          return (
            <li key={item.route}>
              <button
                onClick={() => !disabled && onNavigate(item.route)}
                disabled={disabled}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  background: active ? theme.color.bgTint : "transparent",
                  color: active
                    ? theme.color.primary
                    : disabled
                      ? theme.color.textFaint
                      : theme.color.text,
                  border: "none",
                  borderRadius: theme.radius.md,
                  fontSize: theme.fontSize.base,
                  fontWeight: active ? 600 : 500,
                  cursor: disabled ? "not-allowed" : "pointer",
                  textAlign: "left",
                  transition: "background 0.12s",
                }}
              >
                <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {disabled && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                      background: theme.color.borderSoft,
                      color: theme.color.textSoft,
                      padding: "2px 6px",
                      borderRadius: theme.radius.sm,
                    }}
                  >
                    Bientôt
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <div
        style={{
          marginTop: "auto",
          padding: "16px 20px",
          borderTop: `1px solid ${theme.color.borderSoft}`,
          fontSize: theme.fontSize.xs,
          color: theme.color.textFaint,
          lineHeight: 1.5,
        }}
      >
        Lot 1.4 · v0.4.0
        <br />
        Module Serenity
      </div>
    </nav>
  );
}
