import { useEffect, useState } from "react";
import { Home } from "./pages/Home";
import { Onboarding } from "./pages/Onboarding";

type Route = "home" | "onboarding";

export default function App() {
  const [route, setRoute] = useState<Route>(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    return hash === "#onboarding" ? "onboarding" : "home";
  });

  // Sync hash <-> route (permet refresh + back-button)
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash;
      setRoute(hash === "#onboarding" ? "onboarding" : "home");
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const goTo = (r: Route) => {
    setRoute(r);
    window.location.hash = r === "onboarding" ? "#onboarding" : "";
    window.scrollTo({ top: 0 });
  };

  if (route === "onboarding") {
    return <Onboarding onExit={() => goTo("home")} />;
  }
  return <Home onStartOnboarding={() => goTo("onboarding")} />;
}
