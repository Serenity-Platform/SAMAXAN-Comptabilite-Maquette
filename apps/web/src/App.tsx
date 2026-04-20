// Paperasse — Router avec guard auth (Lot 1.3)
import { useEffect, useState } from "react";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";
import { Dashboard } from "./pages/Dashboard";
import { useSession } from "./lib/useSession";
import { theme } from "./lib/theme";

type Route = "home" | "login" | "onboarding" | "dashboard";

function parseRoute(hash: string): Route {
  const h = hash.replace(/^#/, "");
  if (h === "login") return "login";
  if (h === "onboarding") return "onboarding";
  if (h === "dashboard") return "dashboard";
  return "home";
}

export default function App() {
  const session = useSession();
  const [route, setRoute] = useState<Route>(() => parseRoute(typeof window !== "undefined" ? window.location.hash : ""));

  useEffect(() => {
    const onHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const goTo = (r: Route) => {
    setRoute(r);
    window.location.hash = r === "home" ? "" : `#${r}`;
    window.scrollTo({ top: 0 });
  };

  // Loading initial : session en cours de chargement
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

  // Après login réussi : rediriger vers dashboard si l'utilisateur arrive sur home ou login
  if (session.status === "authenticated" && (route === "home" || route === "login")) {
    // On laisse l'utilisateur cliquer volontairement, mais on bascule sur dashboard si on vient de login
    if (route === "login") {
      goTo("dashboard");
      return null;
    }
  }

  // Routes qui exigent l'auth
  if ((route === "onboarding" || route === "dashboard") && session.status === "unauthenticated") {
    goTo("login");
    return null;
  }

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

  if (route === "dashboard" && session.status === "authenticated") {
    return (
      <Dashboard
        session={session.session}
        onSignOut={() => goTo("home")}
        onStartOnboarding={() => goTo("onboarding")}
      />
    );
  }

  // Default : home
  return (
    <Home
      onStartOnboarding={() => {
        if (session.status === "authenticated") {
          goTo("onboarding");
        } else {
          goTo("login");
        }
      }}
      onOpenDashboard={session.status === "authenticated" ? () => goTo("dashboard") : undefined}
      onSignIn={session.status === "unauthenticated" ? () => goTo("login") : undefined}
      userEmail={session.status === "authenticated" ? session.session.user.email ?? null : null}
    />
  );
}
