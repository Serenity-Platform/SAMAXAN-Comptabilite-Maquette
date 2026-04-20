// Paperasse — Topbar applicative : breadcrumb, date courante, menu user
import { useState } from "react";
import { Menu, ChevronDown, LogOut, UserCircle } from "lucide-react";
import { theme } from "../lib/theme";
import { breadcrumbForRoute, type NavRoute } from "../lib/navigation";

type Props = {
  currentRoute: NavRoute;
  userEmail: string;
  onOpenSidebarMobile: () => void;
  onNavigate: (route: NavRoute) => void;
  onSignOut: () => Promise<void> | void;
  // Hidden slot pour v2 (sélecteur tenant)
  showMobileMenu: boolean;
};

export function Topbar({
  currentRoute,
  userEmail,
  onOpenSidebarMobile,
  onNavigate,
  onSignOut,
  showMobileMenu,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const crumbs = breadcrumbForRoute(currentRoute);
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 24px",
        background: theme.color.bg,
        borderBottom: `1px solid ${theme.color.border}`,
        minHeight: 56,
      }}
    >
      {/* Left : menu mobile + breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
        {showMobileMenu && (
          <button
            onClick={onOpenSidebarMobile}
            aria-label="Ouvrir le menu"
            style={{
              background: "transparent",
              border: "none",
              padding: 6,
              cursor: "pointer",
              color: theme.color.text,
              display: "flex",
            }}
          >
            <Menu size={20} />
          </button>
        )}

        <nav aria-label="Fil d'Ariane" style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {crumbs.map((c, idx) => (
            <span key={idx} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              {c.route ? (
                <button
                  onClick={() => onNavigate(c.route!)}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    color: theme.color.textSoft,
                    fontSize: theme.fontSize.base,
                    cursor: "pointer",
                  }}
                >
                  {c.label}
                </button>
              ) : (
                <span
                  style={{
                    color: theme.color.text,
                    fontSize: theme.fontSize.base,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.label}
                </span>
              )}
              {idx < crumbs.length - 1 && (
                <span style={{ color: theme.color.textFaint, fontSize: theme.fontSize.sm }}>/</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* Right : date + user menu */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            fontSize: theme.fontSize.sm,
            color: theme.color.textSoft,
            textTransform: "capitalize",
            whiteSpace: "nowrap",
          }}
          className="paperasse-hide-on-mobile"
        >
          {today}
        </div>

        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              background: menuOpen ? theme.color.bgTint : "transparent",
              border: `1px solid ${menuOpen ? theme.color.border : "transparent"}`,
              borderRadius: theme.radius.md,
              cursor: "pointer",
              fontSize: theme.fontSize.sm,
              color: theme.color.text,
            }}
          >
            <UserCircle size={18} color={theme.color.textSoft} />
            <span
              style={{
                maxWidth: 160,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {userEmail}
            </span>
            <ChevronDown size={14} color={theme.color.textSoft} />
          </button>

          {menuOpen && (
            <>
              <div
                onClick={() => setMenuOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 40 }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: 220,
                  background: theme.color.bg,
                  border: `1px solid ${theme.color.border}`,
                  borderRadius: theme.radius.md,
                  boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
                  zIndex: 50,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "10px 14px",
                    borderBottom: `1px solid ${theme.color.borderSoft}`,
                    fontSize: theme.fontSize.xs,
                    color: theme.color.textSoft,
                  }}
                >
                  Connecté en tant que
                  <div style={{ color: theme.color.text, fontWeight: 600, marginTop: 2 }}>
                    {userEmail}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    await onSignOut();
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: theme.fontSize.sm,
                    color: theme.color.danger,
                    textAlign: "left",
                  }}
                >
                  <LogOut size={14} />
                  Se déconnecter
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
