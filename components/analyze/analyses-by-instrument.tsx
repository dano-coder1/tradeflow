"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, FolderOpen, GitBranch, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AnalysisByInstrument, AnalysisEntry } from "@/app/api/analyses/by-instrument/route";
import type { ChartAnalysis } from "@/types/ai";

function InstrumentFolder({ group }: { group: AnalysisByInstrument }) {
  const [open, setOpen] = useState(false);

  function handleContinue(a: AnalysisEntry, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("tf:continue-analysis", {
        detail: {
          analysis: a.output_json,
          symbol: group.symbol,
          fromId: a.id,
        },
      })
    );
    // Scroll to analyzer
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-accent/30"
      >
        <div className="flex items-center gap-2.5">
          <FolderOpen className="h-4 w-4 text-primary/60 shrink-0" />
          <span className="font-mono font-bold tracking-wide">{group.symbol}</span>
          <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {group.count}
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="divide-y divide-border/30 bg-muted/10">
          {group.analyses.map((a) => {
            const pct = Math.round(a.confidence * 100);
            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 px-5 py-2.5 transition-colors hover:bg-accent/20"
              >
                <Link
                  href={`/dashboard/analyze/${a.id}`}
                  className="flex flex-1 items-center gap-2.5 min-w-0"
                >
                  {a.continued_from && (
                    <span title="Continuation">
                      <GitBranch className="h-3 w-3 shrink-0 text-primary/50" />
                    </span>
                  )}
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase",
                      a.bias === "bullish"
                        ? "bg-emerald-400/15 text-emerald-400"
                        : a.bias === "bearish"
                          ? "bg-red-400/15 text-red-400"
                          : "bg-yellow-400/15 text-yellow-400"
                    )}
                  >
                    {a.bias}
                  </span>
                  {a.no_trade && (
                    <span className="shrink-0 rounded-full bg-orange-400/10 px-2 py-0.5 text-[11px] font-semibold text-orange-400">
                      NO TRADE
                    </span>
                  )}
                  <span className="truncate text-xs text-muted-foreground">
                    {a.telegram_block}
                  </span>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-[11px] text-muted-foreground/50">{pct}%</p>
                  </div>
                  <button
                    onClick={(e) => handleContinue(a, e)}
                    title="Continue this analysis with new screenshots"
                    className="flex items-center gap-1 rounded-md border border-primary/25 bg-primary/5 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/10"
                  >
                    <Play className="h-3 w-3" />
                    Continue
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AnalysesByInstrument() {
  const [groups, setGroups] = useState<AnalysisByInstrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchGroups() {
    setError(null);
    try {
      const r = await fetch("/api/analyses/by-instrument", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? "Failed to load");
        return;
      }
      if (Array.isArray(data)) setGroups(data);
      else setError(data.error ?? "Failed to load");
    } catch {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchGroups();

    function handleUpdate() {
      setLoading(true);
      fetchGroups();
    }
    window.addEventListener("tf:analyses-updated", handleUpdate);
    return () => window.removeEventListener("tf:analyses-updated", handleUpdate);
  }, []);

  if (loading) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        Loading instrument folders…
      </p>
    );
  }

  if (error) {
    return <p className="text-xs text-destructive">{error}</p>;
  }

  if (groups.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        No tagged analyses yet. Enter an instrument symbol when you analyze a chart.
      </p>
    );
  }

  return (
    <Card>
      <div className="divide-y divide-border/40">
        {groups.map((g) => (
          <InstrumentFolder key={g.symbol} group={g} />
        ))}
      </div>
    </Card>
  );
}
