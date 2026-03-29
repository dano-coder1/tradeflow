"use client";

import { useState } from "react";
import { ChevronDown, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { POSITIVE_TAGS, NEGATIVE_TAGS, tagLabel } from "@/lib/trade-tags";
import type { Trade, TradeReview } from "@/types/trade";

interface MyPatternsProps {
  trades: Trade[];
}

export function MyPatterns({ trades }: MyPatternsProps) {
  const [expanded, setExpanded] = useState(false);

  // Aggregate behavior tags from all autopsied trades
  const tagCounts = new Map<string, number>();
  let autopsiedCount = 0;

  for (const trade of trades) {
    const autopsy = trade.autopsy_json as TradeReview | null;
    if (!autopsy?.behavior_tags) continue;
    autopsiedCount++;
    for (const tag of autopsy.behavior_tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  if (autopsiedCount === 0) return null;

  // Split into positive and negative, sort by count
  const positiveEntries = Array.from(tagCounts.entries())
    .filter(([tag]) => POSITIVE_TAGS.has(tag))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const negativeEntries = Array.from(tagCounts.entries())
    .filter(([tag]) => NEGATIVE_TAGS.has(tag))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#8B5CF6]" />
          <span className="text-sm font-bold text-foreground">My Patterns</span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted-foreground">
            {autopsiedCount} autopsied
          </span>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
          {/* Negative patterns */}
          {negativeEntries.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Top Mistakes</p>
              </div>
              <div className="space-y-1.5">
                {negativeEntries.map(([tag, count]) => (
                  <div key={tag} className="flex items-center justify-between">
                    <span className="text-xs text-foreground">{tagLabel(tag)}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full bg-red-400/60" style={{ width: `${Math.min((count / autopsiedCount) * 100, 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono w-6 text-right">{count}×</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Positive patterns */}
          {positiveEntries.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Top Strengths</p>
              </div>
              <div className="space-y-1.5">
                {positiveEntries.map(([tag, count]) => (
                  <div key={tag} className="flex items-center justify-between">
                    <span className="text-xs text-foreground">{tagLabel(tag)}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-400/60" style={{ width: `${Math.min((count / autopsiedCount) * 100, 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono w-6 text-right">{count}×</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {negativeEntries.length === 0 && positiveEntries.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No patterns detected yet</p>
          )}
        </div>
      )}
    </div>
  );
}
