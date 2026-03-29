"use client";

import { useState } from "react";
import { Trade, TradeSource } from "@/types/trade";
import { TrendingUp, TrendingDown, Target, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SourceFilter = "real" | "sim" | "all";

function fmt(n: number | null, decimals = 2) {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

function filterBySource(trades: Trade[], filter: SourceFilter): Trade[] {
  if (filter === "all") return trades;
  if (filter === "sim") return trades.filter((t) => t.source === "sim");
  // "real" = everything except sim
  return trades.filter((t) => t.source !== "sim");
}

export function StatsCards({ trades }: { trades: Trade[] }) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("real");
  const filtered = filterBySource(trades, sourceFilter);
  const hasSim = trades.some((t) => t.source === "sim");

  const closed = filtered.filter((t) => t.status === "closed");
  const wins = closed.filter((t) => t.result === "win").length;
  const losses = closed.filter((t) => t.result === "loss").length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : null;
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const avgRR =
    closed.length > 0
      ? closed.reduce((sum, t) => sum + (t.rr ?? 0), 0) / closed.length
      : null;

  const stats = [
    {
      label: "Total Trades",
      value: filtered.length.toString(),
      sub: `${closed.length} closed`,
      icon: BarChart2,
      color: "text-[#0EA5E9]",
      glow: "group-hover:shadow-[0_0_20px_rgba(14,165,233,0.1)]",
    },
    {
      label: "Win Rate",
      value: winRate != null ? `${winRate.toFixed(1)}%` : "—",
      sub: `${wins}W / ${losses}L`,
      icon: Target,
      color: winRate != null && winRate >= 50 ? "text-emerald-400" : "text-red-400",
      glow: winRate != null && winRate >= 50
        ? "group-hover:shadow-[0_0_20px_rgba(34,197,94,0.1)]"
        : "group-hover:shadow-[0_0_20px_rgba(239,68,68,0.1)]",
    },
    {
      label: "Total PnL",
      value: `${totalPnl >= 0 ? "+" : ""}${fmt(totalPnl)}`,
      sub: "closed trades",
      icon: totalPnl >= 0 ? TrendingUp : TrendingDown,
      color: totalPnl >= 0 ? "text-emerald-400" : "text-red-400",
      glow: totalPnl >= 0
        ? "group-hover:shadow-[0_0_20px_rgba(34,197,94,0.1)]"
        : "group-hover:shadow-[0_0_20px_rgba(239,68,68,0.1)]",
    },
    {
      label: "Avg R:R",
      value: avgRR != null ? `1:${fmt(avgRR)}` : "—",
      sub: "closed trades",
      icon: BarChart2,
      color: "text-amber-400",
      glow: "group-hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]",
    },
  ];

  return (
    <div className="space-y-2">
      {/* Source toggle — only show if sim trades exist */}
      {hasSim && (
        <div className="flex items-center gap-1">
          {(["real", "sim", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setSourceFilter(f)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                sourceFilter === f
                  ? f === "sim"
                    ? "bg-[#8B5CF6]/15 text-[#8B5CF6]"
                    : "bg-[#0EA5E9]/15 text-[#0EA5E9]"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
              )}
            >
              {f === "real" ? "Real" : f === "sim" ? "Demo" : "All"}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 w-full">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn(
              "group glass rounded-xl p-5 transition-all duration-300",
              s.glow
            )}
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{s.label}</p>
                <p className={`mt-2 text-3xl font-extrabold tracking-tight ${s.color}`}>{s.value}</p>
                <p className="mt-1 text-xs text-muted-foreground/60">{s.sub}</p>
              </div>
              <div className={cn("rounded-lg bg-white/[0.04] p-2", s.color)}>
                <s.icon className="h-4 w-4 opacity-60" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
