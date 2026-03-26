"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { getAlerts, removeAlert, type StoredAlert } from "@/lib/alert-store";
import { Button } from "@/components/ui/button";
import { TrendingUp, LayoutDashboard, ScanLine, Brain, BarChart3, Plus, LogOut, Bell, X, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard",          label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/analyze",  label: "Analyzer",  icon: ScanLine        },
  { href: "/dashboard/strategy", label: "Strategy",  icon: Brain           },
  { href: "/dashboard/markets",  label: "Markets",   icon: BarChart3       },
];

function AlertsIndicator() {
  const [alerts, setAlerts] = useState<StoredAlert[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function refresh() {
    setAlerts(getAlerts());
  }

  useEffect(() => {
    refresh();
    window.addEventListener("tf:alerts-changed", refresh);
    return () => window.removeEventListener("tf:alerts-changed", refresh);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleRemove(id: string) {
    removeAlert(id);
    refresh();
  }

  const bySymbol = new Map<string, StoredAlert[]>();
  for (const a of alerts) {
    const arr = bySymbol.get(a.symbol) ?? [];
    arr.push(a);
    bySymbol.set(a.symbol, arr);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-lg transition-all duration-200",
          alerts.length > 0
            ? "text-[#0EA5E9] hover:bg-[#0EA5E9]/10"
            : "text-muted-foreground hover:bg-white/[0.05]"
        )}
        title={`${alerts.length} active alert${alerts.length !== 1 ? "s" : ""}`}
      >
        <Bell className="h-4 w-4" />
        {alerts.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0EA5E9] px-1 text-[10px] font-bold text-white">
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="glass-strong absolute right-0 top-full mt-2 w-72 rounded-xl shadow-xl shadow-black/30 overflow-hidden z-50">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
            <p className="text-xs font-semibold text-foreground">Active Alerts</p>
            <span className="rounded-full bg-[#0EA5E9]/15 px-2 py-0.5 text-[10px] font-bold text-[#0EA5E9]">
              {alerts.length}
            </span>
          </div>

          {alerts.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              No active alerts. Set them from an analysis result.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-white/[0.04]">
              {Array.from(bySymbol.entries()).map(([symbol, symbolAlerts]) => (
                <div key={symbol} className="px-4 py-2.5">
                  <p className="mb-1.5 font-mono text-xs font-bold text-foreground">{symbol}</p>
                  <div className="space-y-1">
                    {symbolAlerts.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className={cn(
                            "w-8 shrink-0 font-semibold",
                            a.label === "SL" ? "text-red-400" : a.label.startsWith("TP") ? "text-emerald-400" : "text-foreground"
                          )}>
                            {a.label}
                          </span>
                          <span className="font-mono">{a.level.toFixed(2)}</span>
                        </div>
                        <button
                          onClick={() => handleRemove(a.id)}
                          className="rounded p-1.5 text-muted-foreground/40 transition-colors hover:bg-white/[0.06] hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClientSupabaseClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="glass-strong sticky top-0 z-50">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 font-extrabold tracking-tight"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[#0EA5E9] to-[#8B5CF6]">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
              <span className="text-gradient">TradeFlow</span>
            </Link>
            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-0.5">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-all duration-200",
                    pathname === href
                      ? "bg-white/[0.06] text-foreground font-medium glow-blue-sm"
                      : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertsIndicator />
            <Link
              href="/trades/new"
              className="btn-gradient inline-flex h-9 md:h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Trade</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Logout"
              className="hidden md:flex"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            {/* Mobile hamburger */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex md:hidden h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/[0.05]"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60] md:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute right-0 top-0 h-full w-64 glass-strong border-l border-white/[0.06] p-5 space-y-6 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Menu</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/[0.06]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setDrawerOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-all",
                    pathname === href
                      ? "bg-white/[0.06] text-foreground font-medium"
                      : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>

            <div className="border-t border-white/[0.06] pt-4">
              <button
                onClick={() => { handleLogout(); setDrawerOpen(false); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-muted-foreground transition-all hover:bg-white/[0.04] hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
