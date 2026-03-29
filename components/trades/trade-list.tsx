"use client";

import { Trade } from "@/types/trade";
import { TradeCard } from "./trade-card";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Filter = "all" | "open" | "closed" | "win" | "loss";
type SourceFilter = "real" | "sim" | "all";

export function TradeList({ initialTrades }: { initialTrades: Trade[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("real");
  const hasSim = initialTrades.some((t) => t.source === "sim");

  const filtered = initialTrades.filter((t) => {
    // Source filter
    if (sourceFilter === "sim" && t.source !== "sim") return false;
    if (sourceFilter === "real" && t.source === "sim") return false;

    // Status filter
    if (filter === "all") return true;
    if (filter === "open") return t.status === "open";
    if (filter === "closed") return t.status === "closed";
    if (filter === "win") return t.result === "win";
    if (filter === "loss") return t.result === "loss";
    return true;
  });

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "closed", label: "Closed" },
    { key: "win", label: "Wins" },
    { key: "loss", label: "Losses" },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap pb-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "shrink-0 rounded-md px-3 py-2 min-h-[44px] text-sm font-medium transition-colors",
                filter === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Source toggle */}
        {hasSim && (
          <div className="flex items-center gap-0.5 ml-auto">
            {(["real", "sim", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSourceFilter(f)}
                className={cn(
                  "rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                  sourceFilter === f
                    ? f === "sim"
                      ? "bg-[#8B5CF6]/15 text-[#8B5CF6]"
                      : "bg-[#0EA5E9]/15 text-[#0EA5E9]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "real" ? "Real" : f === "sim" ? "Demo" : "All"}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-sm text-muted-foreground">No trades found.</p>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {filtered.map((trade) => (
            <TradeCard key={trade.id} trade={trade} />
          ))}
        </div>
      )}
    </div>
  );
}
