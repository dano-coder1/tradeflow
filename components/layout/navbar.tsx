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
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-primary"
          >
            <TrendingUp className="h-5 w-5" />
            TradeFlow
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  pathname === href
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
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
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
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
