// Paperasse — Layout applicatif principal. Sidebar + Topbar + zone contenu.
// Responsive : sidebar collapsible en drawer sur < 1024px.
import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { theme } from "../lib/theme";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import type { NavRoute } from "../lib/navigation";
import { getSupabase } from "../lib/supabaseClient";

type Props = {
  currentRoute: NavRoute;
  onNavigate: (route: NavRoute) => void;
  session: Session;
  tenantName: string;
  onSignedOut: () => void;
  children: ReactNode;
};

export function AppShell({
  currentRoute,
  onNavigate,
  session,
  tenantName,
  onSignedOut,
  children,
}: Props) {
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < 1024 : false,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Fermer le drawer au changement de route
  useEffect(() => {
    setDrawerOpen(false);
  }, [currentRoute]);

  const handleSignOut = async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    onSignedOut();
  };

  const userEmail = session.user.email ?? session.user.id;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: theme.color.bgSoft,
      }}
    >
      {/* Style global pour masquer la date sur mobile */}
      <style>{`
        @media (max-width: 720px) {
          .paperasse-hide-on-mobile { display: none !important; }
        }
      `}</style>

      {/* Sidebar desktop */}
      {!isMobile && (
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            flexShrink: 0,
          }}
        >
          <Sidebar
            currentRoute={currentRoute}
            onNavigate={onNavigate}
            tenantName={tenantName}
          />
        </div>
      )}

      {/* Sidebar mobile (drawer) */}
      {isMobile && drawerOpen && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.35)",
              zIndex: 60,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              height: "100vh",
              zIndex: 70,
              boxShadow: "0 0 24px rgba(15,23,42,0.15)",
            }}
          >
            <Sidebar
              currentRoute={currentRoute}
              onNavigate={(r) => {
                onNavigate(r);
                setDrawerOpen(false);
              }}
              tenantName={tenantName}
            />
          </div>
        </>
      )}

      {/* Zone principale : topbar + contenu */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Topbar
          currentRoute={currentRoute}
          userEmail={userEmail}
          onOpenSidebarMobile={() => setDrawerOpen(true)}
          onNavigate={onNavigate}
          onSignOut={handleSignOut}
          showMobileMenu={isMobile}
        />

        <main
          style={{
            flex: 1,
            padding: isMobile ? "20px 16px 48px" : "28px 32px 48px",
            overflow: "auto",
            maxWidth: 1280,
            width: "100%",
            margin: "0 auto",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
