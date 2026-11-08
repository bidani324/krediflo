import { Link, useLocation } from "wouter";
import { Home, FilePlus2, LayoutList, UserRound, LogIn, Gauge, Files, Users, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Tab = { href: string; label: string; Icon: typeof Home; match: (l: string) => boolean };

export function MobileTabBar() {
  const [location] = useLocation();
  const { user, admin } = useAuth();
  if (location === "/login" || location === "/admin/login") return null;
  const inAdmin = location.startsWith("/admin");
  let tabs: Tab[];
  if (admin && inAdmin) {
    tabs = [
      { href: "/admin", label: "Overview", Icon: Gauge, match: l => l === "/admin" },
      { href: "/admin/loans", label: "Loans", Icon: Files, match: l => l.startsWith("/admin/loans") },
      { href: "/admin/create", label: "Create", Icon: FilePlus2, match: l => l === "/admin/create" },
      { href: "/admin/users", label: "Users", Icon: Users, match: l => l === "/admin/users" },
      { href: "/admin/quick-check", label: "Quick Check", Icon: Zap, match: l => l === "/admin/quick-check" },
    ];
  } else if (admin) {
    tabs = [
      { href: "/", label: "Home", Icon: Home, match: l => l === "/" },
      { href: "/admin", label: "Admin", Icon: Gauge, match: () => false },
    ];
  } else if (inAdmin) {
    return null;
  } else {
    tabs = [
      { href: "/", label: "Home", Icon: Home, match: l => l === "/" },
      { href: "/apply", label: "Apply", Icon: FilePlus2, match: l => l === "/apply" },
      user
        ? { href: "/dashboard", label: "Applications", Icon: LayoutList, match: l => l.startsWith("/dashboard") }
        : { href: "/login", label: "Sign In", Icon: LogIn, match: () => false },
      ...(user ? [{ href: "/profile/detail-sheet", label: "Profile", Icon: UserRound, match: (l: string) => l.startsWith("/profile") }] : []),
    ];
  }
  return (
    <nav className="kf-tabbar md:hidden" aria-label="Primary">
      {tabs.map(({ href, label, Icon, match }) => (
        <Link key={href} href={href} data-testid={`tab-${label.toLowerCase()}`} className={`kf-tab ${match(location) ? "is-active" : ""}`}>
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
