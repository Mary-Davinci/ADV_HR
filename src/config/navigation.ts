import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  LayoutDashboard,
  ListTodo,
  MessagesSquare,
  Settings,
  UserSearch,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { Permission } from "@/lib/auth/permissions";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Voce visibile solo con questo permesso (verificato anche server-side nella pagina). */
  permission: Permission;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Struttura della sidebar. Nuovi moduli si aggiungono qui, raggruppati
 * per area, senza toccare i componenti di layout.
 */
export const MAIN_NAVIGATION: NavGroup[] = [
  {
    label: "Generale",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "candidate.read" }],
  },
  {
    label: "Ricerca & Selezione",
    items: [
      { title: "Candidati", href: "/recruiting", icon: UserSearch, permission: "candidate.read" },
      { title: "Selezioni", href: "/selections", icon: Briefcase, permission: "selection.read" },
      { title: "Colloqui", href: "/interviews", icon: MessagesSquare, permission: "interview.read" },
      { title: "Calendario", href: "/calendar", icon: CalendarDays, permission: "interview.read" },
      { title: "Talent pool", href: "/talent-pools", icon: UsersRound, permission: "talentPool.read" },
    ],
  },
  {
    label: "Operatività",
    items: [
      { title: "Task", href: "/tasks", icon: ListTodo, permission: "task.read" },
      { title: "Aziende", href: "/companies", icon: Building2, permission: "company.read" },
    ],
  },
  {
    label: "Analisi",
    items: [{ title: "Report", href: "/reports", icon: BarChart3, permission: "reports.read" }],
  },
];

export const SECONDARY_NAVIGATION: NavItem[] = [
  { title: "Impostazioni", href: "/settings", icon: Settings, permission: "settings.read" },
];

const ALL_ITEMS = [...MAIN_NAVIGATION.flatMap((group) => group.items), ...SECONDARY_NAVIGATION];

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface Crumb {
  label: string;
  href?: string;
}

const DETAIL_LABELS: Record<string, string> = {
  "/recruiting": "Scheda candidato",
  "/companies": "Scheda azienda",
  "/talent-pools": "Talent pool",
  "/interviews": "Colloquio",
};

/** Breadcrumb derivato dal percorso; le pagine di dettaglio aggiungono livelli generici. */
export function getBreadcrumbs(pathname: string): Crumb[] {
  const item = ALL_ITEMS.find((navItem) => isNavItemActive(pathname, navItem.href));
  if (!item) return pathname === "/forbidden" ? [{ label: "Accesso negato" }] : [];
  if (pathname === item.href) return [{ label: item.title }];

  if (item.href === "/companies" && pathname.includes("/selections/")) {
    const companyPath = pathname.split("/selections/")[0] ?? item.href;
    return [
      { label: item.title, href: item.href },
      { label: "Scheda azienda", href: companyPath },
      { label: "Selezione" },
    ];
  }
  return [{ label: item.title, href: item.href }, { label: DETAIL_LABELS[item.href] ?? "Dettaglio" }];
}
