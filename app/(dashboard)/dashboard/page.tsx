import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StatsCards } from "@/components/trades/stats-cards";
import { TradeList } from "@/components/trades/trade-list";
import { StrategyChat } from "@/components/strategy/strategy-chat";
import { Plus, Brain, Pencil, CheckCircle2 } from "lucide-react";
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
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Link
          href="/trades/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Trade
        </Link>
      </div>

      {/* 3-column layout */}
      <div className="grid gap-5 lg:grid-cols-[260px_1fr_260px]">

        {/* ── LEFT: Stats + Trade History ── */}
        <div className="flex flex-col gap-4 order-2 lg:order-none">
          <StatsCards trades={typedTrades} />
          <div>
            <h2 className="mb-2 text-sm font-semibold">Trade History</h2>
            <TradeList initialTrades={typedTrades} />
          </div>
        </div>

        {/* ── CENTER: Strategy Coach ── */}
        <div className="order-1 lg:order-none">
          <StrategyChat hasProfile={hasProfile} />
        </div>

        {/* ── RIGHT: Strategy summary / CTA ── */}
        <div className="flex flex-col gap-4 order-3 lg:order-none">
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

          {hasProfile && profile && (
            <div className="rounded-xl border border-border/50 bg-card px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Brain className="h-3 w-3 text-primary" />
                  </div>
                  <p className="text-sm font-semibold">Your Strategy</p>
                </div>
                <Link
                  href="/dashboard/strategy"
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Link>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                  {profile.style}
                </span>
                <span className="rounded-full bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {profile.experience_level}
                </span>
              </div>

              {(profile.strategy_json?.entry_rules ?? []).length > 0 && (
                <ul className="space-y-1">
                  {profile.strategy_json.entry_rules.slice(0, 4).map((rule, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-success/50" />
                      {rule}
                    </li>
                  ))}
                  {profile.strategy_json.entry_rules.length > 4 && (
                    <li className="pl-5 text-xs text-muted-foreground/50">
                      +{profile.strategy_json.entry_rules.length - 4} more rules
                    </li>
                  )}
                </ul>
              )}

              <p className="text-[10px] text-muted-foreground/40">
                Updated{" "}
                {new Date(profile.updated_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
