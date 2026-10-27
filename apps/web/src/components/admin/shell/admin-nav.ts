import {
  Building2,
  ChartLine,
  CreditCard,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  type LucideIcon,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** The nine admin modules, in sidebar order (spec section 21). */
export const adminNav: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/analytics", label: "Analytics", icon: ChartLine },
  { href: "/admin/health", label: "System Health", icon: HeartPulse },
  { href: "/admin/security", label: "Security & Audit", icon: ShieldCheck },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/settings", label: "Configuration", icon: Settings },
];

/** The module a path belongs to; Overview only for /admin itself. */
export function activeNavItem(pathname: string): AdminNavItem | undefined {
  return adminNav.find((item) =>
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

const detailLabels: Record<string, string> = {
  "/admin/tenants": "Account details",
  "/admin/users": "User details",
  "/admin/support": "Case details",
};

export interface Crumb {
  label: string;
  href?: string;
}

/** Admin, then the module, then a detail page when the path goes deeper. */
export function adminCrumbs(pathname: string): Crumb[] {
  const item = activeNavItem(pathname);
  const crumbs: Crumb[] = [{ label: "Admin", href: "/admin" }];
  if (!item) return crumbs;
  const deeper = pathname !== item.href;
  crumbs.push({ label: item.label, href: deeper ? item.href : undefined });
  if (deeper) crumbs.push({ label: detailLabels[item.href] ?? "Details" });
  return crumbs;
}
