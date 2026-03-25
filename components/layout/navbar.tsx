"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { TrendingUp, LayoutDashboard, ScanLine, Brain, Plus, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard",          label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/analyze",  label: "Analyzer",  icon: ScanLine        },
  { href: "/dashboard/strategy", label: "Strategy",  icon: Brain           },
];

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClientSupabaseClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
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
          <nav className="flex items-center gap-0.5">
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
        <div className="flex items-center gap-2">
          <Link
            href="/trades/new"
            className="btn-gradient inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            New Trade
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
