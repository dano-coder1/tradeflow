"use client";

import Link from "next/link";
import { TraderProfile } from "@/types/trader-profile";
import { Brain, Pencil, CheckCircle2 } from "lucide-react";

export function StrategyCard({ profile }: { profile: TraderProfile }) {
  return (
    <details className="group rounded-xl border border-border/50 bg-card">
      <summary className="flex cursor-pointer items-center justify-between px-4 py-3 select-none">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Brain className="h-3 w-3 text-primary" />
          </div>
          <p className="text-sm font-semibold">Your Strategy</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/strategy"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Link>
          <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180">▾</span>
        </div>
      </summary>

      <div className="border-t border-border/50 px-4 py-3 space-y-3">
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
    </details>
  );
}
