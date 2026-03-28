import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatsCards } from "@/components/trades/stats-cards";
import { TradeList } from "@/components/trades/trade-list";
import { StrategyChat } from "@/components/strategy/strategy-chat";
import { StrategyCard } from "@/components/strategy/strategy-card";
import { ActiveAlertsPanel } from "@/components/dashboard/active-alerts-panel";
import { MT5ImportButton } from "@/components/trades/mt5-import-button";
import { MyPatterns } from "@/components/trades/my-patterns";
import { Plus, Brain } from "lucide-react";
import { Trade } from "@/types/trade";
import { TraderProfile } from "@/types/trader-profile";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: trades }, { data: profileData, error: profileError }] = await Promise.all([
    supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .order("trade_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("trader_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single(),
  ]);

  if (profileError && profileError.code !== "PGRST116") {
    // PGRST116 = no rows found, which is fine; anything else is a real error
    console.error("[dashboard] failed to fetch trader profile:", profileError);
  }

  const typedTrades = (trades ?? []) as Trade[];
  const profile = profileData as TraderProfile | null;
  const hasProfile = !!profile;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gradient">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <MT5ImportButton />
          <Link
            href="/trades/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Trade
          </Link>
        </div>
      </div>

      {/* Stats bar — full width */}
      <StatsCards trades={typedTrades} />

      {/* Patterns — from autopsy data */}
      <MyPatterns trades={typedTrades} />

      {/* 2-column layout */}
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">

        {/* ── LEFT (60%): Trade History ── */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Trade History</h2>
          <TradeList initialTrades={typedTrades} />
        </div>

        {/* ── RIGHT (40%): Alerts + Coach + Strategy ── */}
        <div className="flex flex-col gap-5">
          <ActiveAlertsPanel />
          <StrategyChat hasProfile={hasProfile} />

          {!hasProfile && (
            <Link
              href="/dashboard/strategy"
              className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-4 transition-colors hover:border-primary/40 hover:bg-primary/8"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Set up your strategy</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  The coach needs your rules to give specific feedback.
                </p>
              </div>
            </Link>
          )}

          {hasProfile && profile && <StrategyCard profile={profile} />}
        </div>

      </div>
    </div>
  );
}
