import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Moon, Sun, LogOut, User, ShieldCheck, ChevronDown, Home as HomeIcon, Landmark, Briefcase, Menu, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRODUCTS = [
  { href: "/home-loan",      label: "Home Loan",             sub: "From 8.40% p.a.",  Icon: HomeIcon  },
  { href: "/lap",            label: "Loan Against Property", sub: "From 9.00% p.a.",  Icon: Landmark  },
  { href: "/business-loan",  label: "Business Loan",         sub: "From 11.00% p.a.", Icon: Briefcase },
  { href: "/personal-loan",  label: "Personal Loan",         sub: "From 10.50% p.a.", Icon: User      },
];

export function Navbar() {
  const [location, navigate] = useLocation();
  const { setTheme } = useTheme();
  const { user, admin, logoutUser, logoutAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = location.startsWith("/admin");
  const close = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 relative">

        {/* Logo */}
        <div className="flex items-center gap-6 md:gap-10">
          <Link href="/" className="flex items-center gap-2.5" onClick={close}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#0F172A"/>
              <defs>
                <linearGradient id="kf-nav" x1="10" y1="16" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="white"/>
                  <stop offset="100%" stopColor="#00D2FF"/>
                </linearGradient>
              </defs>
              <line x1="10" y1="8" x2="10" y2="24" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <line x1="10" y1="16" x2="23" y2="8" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <path d="M10 16 Q16 21 23 24" stroke="url(#kf-nav)" strokeWidth="3" strokeLinecap="round" fill="none"/>
              <path d="M8 28 Q14 25.5 20 28 Q24 29.5 27 28" stroke="#00D2FF" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7"/>
            </svg>
            <span className="font-bold text-xl tracking-tight select-none">
              <span className="text-foreground">Kredi</span>
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">flo</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <DropdownMenu>
              <DropdownMenuTrigger className={`flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary outline-none ${["/home-loan","/lap","/business-loan","/personal-loan"].some(p => location === p) ? "text-primary" : "text-muted-foreground"}`}>
                Products <ChevronDown className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 p-2">
                {PRODUCTS.map(({ href, label, sub, Icon }) => (
                  <DropdownMenuItem key={href} asChild>
                    <Link href={href} className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer w-full">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-cyan-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-none">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Link href="/apply" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/apply" ? "text-primary" : "text-muted-foreground"}`}>
              Apply Now
            </Link>
            <Link href="/dashboard" className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith("/dashboard") ? "text-primary" : "text-muted-foreground"}`}>
              My Dashboard
            </Link>
            {(admin || isAdmin) && (
              <Link href="/admin" className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith("/admin") ? "text-primary" : "text-muted-foreground"}`}>
                Admin
              </Link>
            )}
          </nav>
        </div>

        {/* Desktop right controls */}
        <div className="hidden md:flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {admin ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-primary/30 text-primary">
                  <ShieldCheck className="w-4 h-4" />
                  {admin.name}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">{admin.email}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { logoutAdmin(); navigate("/"); }} className="text-red-500">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="w-4 h-4" />
                  {user.firstName}
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  {user.mobile} · {user.pan}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                  My Applications
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/profile/detail-sheet")}>
                  My Detail Sheet
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { logoutUser(); navigate("/"); }} className="text-red-500">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={() => navigate("/login")} className="gap-2">
              <User className="w-4 h-4" />
              Sign In
            </Button>
          )}
        </div>

        {/* Mobile: hamburger button */}
        <button
          className="md:hidden flex items-center justify-center w-11 h-11 rounded-md text-foreground hover:bg-accent transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown menu + backdrop */}
      {mobileOpen && (
        <>
          {/* Tap-outside backdrop */}
          <div
            className="md:hidden fixed inset-0 z-30"
            onClick={close}
            aria-hidden="true"
          />
          <div className="md:hidden absolute left-0 right-0 top-full bg-background/98 backdrop-blur border-b border-border/40 shadow-xl z-40 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="container mx-auto px-4 pb-6 pt-3">

            {/* Products grid */}
            <div className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">Products</p>
              <div className="grid grid-cols-2 gap-1">
                {PRODUCTS.map(({ href, label, sub, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={close}
                    className="flex items-center gap-2 p-3 rounded-xl hover:bg-accent transition-colors min-h-[56px]"
                  >
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-cyan-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{sub}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Primary nav links */}
            <div className="border-t border-border/40 pt-3 mb-4 space-y-1">
              <Link
                href="/apply"
                onClick={close}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-accent min-h-[44px] ${location === "/apply" ? "text-primary bg-accent" : "text-foreground"}`}
              >
                Apply Now
              </Link>
              <Link
                href="/dashboard"
                onClick={close}
                className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-accent min-h-[44px] ${location.startsWith("/dashboard") ? "text-primary bg-accent" : "text-foreground"}`}
              >
                My Dashboard
              </Link>
              {user && (
                <Link
                  href="/profile/detail-sheet"
                  onClick={close}
                  className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-accent min-h-[44px] ${location === "/profile/detail-sheet" ? "text-primary bg-accent" : "text-foreground"}`}
                >
                  My Detail Sheet
                </Link>
              )}
              {(admin || isAdmin) && (
                <Link
                  href="/admin"
                  onClick={close}
                  className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-accent min-h-[44px] ${location.startsWith("/admin") ? "text-primary bg-accent" : "text-foreground"}`}
                >
                  Admin Portal
                </Link>
              )}
            </div>

            {/* Theme + Auth */}
            <div className="border-t border-border/40 pt-3 flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-11 w-11 p-0 shrink-0">
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {admin ? (
                <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{admin.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 h-11 shrink-0"
                    onClick={() => { logoutAdmin(); navigate("/"); close(); }}
                  >
                    <LogOut className="w-4 h-4 mr-1" /> Sign Out
                  </Button>
                </div>
              ) : user ? (
                <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.mobile}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 h-11 shrink-0"
                    onClick={() => { logoutUser(); navigate("/"); close(); }}
                  >
                    <LogOut className="w-4 h-4 mr-1" /> Sign Out
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="flex-1 h-11 gap-2"
                  onClick={() => { navigate("/login"); close(); }}
                >
                  <User className="w-4 h-4" /> Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
        </>
      )}
    </header>
  );
}
