// Paperasse — Configuration centralisée de la navigation applicative.
// Modifier ici et les changements se propagent au Sidebar, au Breadcrumb et au router.
import {
  LayoutDashboard,
  BookOpen,
  Landmark,
  Receipt,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavRoute =
  | "dashboard"
  | "accounting"
  | "bank"
  | "tva"
  | "documents"
  | "settings"
  | "settings-company"
  | "settings-integrations";

export type NavItem = {
  route: NavRoute;
  label: string;
  icon: LucideIcon;
  status: "active" | "coming_soon";
  // Sections prévues v2/v3 mais placeholder v1
  since?: "v1" | "v2" | "v3";
};

export const NAV_ITEMS: NavItem[] = [
  { route: "dashboard",  label: "Tableau de bord", icon: LayoutDashboard, status: "active",      since: "v1" },
  { route: "accounting", label: "Comptabilité",    icon: BookOpen,        status: "coming_soon", since: "v2" },
  { route: "bank",       label: "Banque",          icon: Landmark,        status: "active",      since: "v2" },
  { route: "tva",        label: "TVA",             icon: Receipt,         status: "coming_soon", since: "v2" },
  { route: "documents",  label: "Documents",       icon: FileText,        status: "coming_soon", since: "v2" },
  { route: "settings",   label: "Paramètres",      icon: Settings,        status: "active",      since: "v1" },
];

// Routes internes des sous-pages Paramètres
export const SETTINGS_SUBROUTES: { route: NavRoute; label: string }[] = [
  { route: "settings-company", label: "Société" },
  { route: "settings-integrations", label: "Intégrations" },
];

// Parsing du hash
export function parseRoute(hash: string): NavRoute | "home" | "login" | "onboarding" {
  const h = hash.replace(/^#/, "");
  if (h === "") return "home";
  if (h === "login") return "login";
  if (h === "onboarding") return "onboarding";
  const item = NAV_ITEMS.find((n) => n.route === h);
  if (item) return item.route;
  const sub = SETTINGS_SUBROUTES.find((s) => s.route === h);
  if (sub) return sub.route;
  return "home";
}

// Breadcrumb calculé selon la route
export function breadcrumbForRoute(route: NavRoute): { label: string; route?: NavRoute }[] {
  if (route === "settings-company") {
    return [
      { label: "Paramètres", route: "settings" },
      { label: "Société" },
    ];
  }
  if (route === "settings-integrations") {
    return [
      { label: "Paramètres", route: "settings" },
      { label: "Intégrations" },
    ];
  }
  const item = NAV_ITEMS.find((n) => n.route === route);
  return item ? [{ label: item.label }] : [{ label: "Accueil" }];
}

// Page title (onglet navigateur)
export function titleForRoute(route: NavRoute): string {
  if (route === "settings-company") return "Société — Paramètres";
  if (route === "settings-integrations") return "Intégrations — Paramètres";
  const item = NAV_ITEMS.find((n) => n.route === route);
  return item?.label ?? "Paperasse";
}
