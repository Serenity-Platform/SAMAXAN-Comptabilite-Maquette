// Paperasse — Router avec auth guard et AppShell (Lot 1.4)
import { useEffect, useState } from "react";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
import { SettingsCompany } from "./pages/SettingsCompany";
import { SettingsIntegrations } from "./pages/SettingsIntegrations";
import { PlaceholderAccounting } from "./pages/PlaceholderAccounting";
import { Bank } from "./pages/Bank";
import { PlaceholderTva } from "./pages/PlaceholderTva";
import { PlaceholderDocuments } from "./pages/PlaceholderDocuments";
import { AppShell } from "./layouts/AppShell";
import { useSession } from "./lib/useSession";
import { getSupabase } from "./lib/supabaseClient";
import { theme } from "./lib/theme";
import { titleForRoute, type NavRoute } from "./lib/navigation";

type Route = "home" | "login" | "onboarding" | NavRoute;

const APP_ROUTES: NavRoute[] = [
  "dashboard",
  "accounting",
  "bank",
  "tva",
  "documents",
  "settings",
  "settings-company",
];

function parseRoute(hash: string): Route {
  const h = hash.replace(/^#/, "");
  if (h === "login") return "login";
  if (h === "onboarding") return "onboarding";
  if ((APP_ROUTES as string[]).includes(h)) return h as NavRoute;
  return "home";
}

export default function App() {
  const session = useSession();
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(typeof window !== "undefined" ? window.location.hash : ""),
  );
  const [tenantName, setTenantName] = useState<string>("Paperasse");

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Titre onglet synchronisé avec la route
  useEffect(() => {
    let title = "Paperasse";
    if ((APP_ROUTES as string[]).includes(route)) {
      title = `${titleForRoute(route as NavRoute)} · Paperasse`;
    } else if (route === "login") {
      title = "Connexion · Paperasse";
    } else if (route === "onboarding") {
      title = "Création de société · Paperasse";
    }
    document.title = title;
  }, [route]);

  // Charger le nom du tenant pour la sidebar (dès qu'authentifié)
  useEffect(() => {
    if (session.status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      const supabase = getSupabase();
      const { data } = await supabase
        .from("compta_tenants_v")
        .select("name")
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data?.name) setTenantName(data.name);
      else setTenantName("Aucune société");
    })();
    return () => { cancelled = true; };
  }, [session.status]);

  const goTo = (r: Route) => {
    setRoute(r);
    window.location.hash = r === "home" ? "" : `#${r}`;
    window.scrollTo({ top: 0 });
  };

  // Loading initial
  if (session.status === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: theme.fontSize.base,
          color: theme.color.textSoft,
        }}
      >
        Chargement…
      </div>
    );
  }

  // Post-login : bascule vers dashboard
  if (session.status === "authenticated" && route === "login") {
    goTo("dashboard");
    return null;
  }

  // Routes protégées
  if (
    (APP_ROUTES as string[]).includes(route) &&
    session.status === "unauthenticated"
  ) {
    goTo("login");
    return null;
  }

  // Pages hors-shell : home, login, onboarding
  if (route === "login") {
    return <Login onBack={() => goTo("home")} onSignedIn={() => goTo("dashboard")} />;
  }

  if (route === "onboarding" && session.status === "authenticated") {
    return (
      <Onboarding
        onExit={() => goTo("dashboard")}
        onComplete={() => goTo("dashboard")}
      />
    );
  }

  if (route === "home") {
    return (
      <Home
        onStartOnboarding={() => {
          if (session.status === "authenticated") goTo("onboarding");
          else goTo("login");
        }}
        onOpenDashboard={session.status === "authenticated" ? () => goTo("dashboard") : undefined}
        onSignIn={session.status === "unauthenticated" ? () => goTo("login") : undefined}
        userEmail={session.status === "authenticated" ? session.session.user.email ?? null : null}
      />
    );
  }

  // Pages sous AppShell (routes d'app authentifiées)
  if (session.status === "authenticated" && (APP_ROUTES as string[]).includes(route)) {
    return (
      <AppShell
        currentRoute={route as NavRoute}
        onNavigate={(r) => goTo(r)}
        session={session.session}
        tenantName={tenantName}
        onSignedOut={() => goTo("home")}
      >
        {route === "dashboard" && (
          <Dashboard onNavigateSettings={() => goTo("settings-company")} />
        )}
        {route === "settings" && (
          <Settings
            onNavigateCompany={() => goTo("settings-company")}
            onNavigateIntegrations={() => goTo("settings-integrations")}
          />
        )}
        {route === "settings-company" && (
          <SettingsCompany onBack={() => goTo("settings")} />
        )}
        {route === "settings-integrations" && (
          <SettingsIntegrations onBack={() => goTo("settings")} />
        )}
        {route === "accounting" && <PlaceholderAccounting />}
        {route === "bank" && <Bank />}
        {route === "tva" && <PlaceholderTva />}
        {route === "documents" && <PlaceholderDocuments />}
      </AppShell>
    );
  }

  // Fallback
  return (
    <Home
      onStartOnboarding={() => goTo("login")}
      onSignIn={() => goTo("login")}
      userEmail={null}
    />
  );
}
