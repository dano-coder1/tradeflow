"use client";

import { useState } from "react";
import { ChartAnalysis } from "@/types/ai";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Copy,
  Check,
  MapPin,
  Crosshair,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Telegram formatter (unchanged — logic must stay stable) ─────────────────

export function formatTelegramBlock(r: ChartAnalysis): string {
  const biasEmoji =
    r.bias === "bullish" ? "📈" : r.bias === "bearish" ? "📉" : "➡️";
  const pct = Math.round(r.confidence * 100);
  const bool = (v: boolean) => (v ? "✅" : "❌");

  const lines: string[] = [
    `${biasEmoji} ${r.bias.toUpperCase()}`,
    `Confidence: ${pct}%`,
    r.no_trade ? `⛔ NO TRADE` : "",
    ``,
    `📍 Decision Zone:`,
    r.decision_zone,
    ``,
    `🎯 Sniper Entry:`,
    r.sniper_entry,
    ``,
    `🛑 SL: ${r.sl}`,
    ``,
    `🎯 TP1: ${r.tp1}`,
    `🎯 TP2: ${r.tp2}`,
    `🎯 TP3: ${r.tp3}`,
    ``,
    `🚫 No-Trade Condition:`,
    r.no_trade_condition,
  ];

  if (r.no_trade && r.reason_if_no_trade) {
    lines.push(``, `⚠️ Reason:`, r.reason_if_no_trade);
  }

  lines.push(
    ``,
    `✅ SMC Checklist:`,
    `- Liquidity Sweep: ${bool(r.smc_reasons.liquidity_sweep)}`,
    `- BOS: ${bool(r.smc_reasons.bos)}`,
    `- CHoCH: ${bool(r.smc_reasons.choch)}`,
    `- Order Block: ${bool(r.smc_reasons.order_block)}`,
    `- FVG: ${bool(r.smc_reasons.fvg)}`,
    `- HTF Alignment: ${bool(r.smc_reasons.htf_alignment)}`
  );

  return lines.filter((l) => l !== undefined).join("\n");
}

// ─── Kept exports (used by other files) ──────────────────────────────────────

export const SMC_LABELS: Record<keyof ChartAnalysis["smc_reasons"], string> = {
  liquidity_sweep: "Liquidity Sweep",
  bos: "BOS",
  choch: "CHoCH",
  order_block: "Order Block",
  fvg: "FVG",
  htf_alignment: "HTF Alignment",
};

export function BiasBadge({ bias }: { bias: ChartAnalysis["bias"] }) {
  const map = {
    bullish: "bg-success/20 text-success border-success/30",
    bearish: "bg-destructive/20 text-destructive border-destructive/30",
    neutral: "bg-warning/20 text-warning border-warning/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold uppercase tracking-wide",
        map[bias]
      )}
    >
      {bias}
    </span>
  );
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 70 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-destructive";
  const label =
    pct >= 85 ? "High" : pct >= 70 ? "Good" : pct >= 50 ? "Moderate" : "Low";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Confidence</span>
        <span className={cn("font-semibold", pct >= 50 ? "text-foreground" : "text-destructive")}>
          {pct}% — {label}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function SmcRow({ label, active, note }: { label: string; active: boolean; note?: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {active ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/30" />
      )}
      <div>
        <span className={cn("text-sm font-medium", !active && "text-muted-foreground/50")}>{label}</span>
        {note && active && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
    </div>
  );
}

export function TelegramBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="relative">
      <pre className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
        {text}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {copied ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
      </button>
    </div>
  );
}

// ─── Main result component ────────────────────────────────────────────────────

export function AnalysisResult({ result }: { result: ChartAnalysis }) {
  const [copiedPlan, setCopiedPlan] = useState(false);
  const pct = Math.round(result.confidence * 100);
  const telegramText =
    (result.telegram_block?.match(/\n/g) ?? []).length >= 5
      ? result.telegram_block
      : formatTelegramBlock(result);

  function handleCopyPlan() {
    navigator.clipboard.writeText(telegramText);
    setCopiedPlan(true);
    setTimeout(() => setCopiedPlan(false), 2000);
  }

  const BiasIcon =
    result.bias === "bullish" ? TrendingUp : result.bias === "bearish" ? TrendingDown : Minus;
  const biasColor =
    result.bias === "bullish"
      ? "text-success border-success/20 bg-success/5"
      : result.bias === "bearish"
        ? "text-destructive border-destructive/20 bg-destructive/5"
        : "text-warning border-warning/20 bg-warning/5";
  const confColor =
    pct >= 70 ? "bg-success/10 text-success border-success/20"
    : pct >= 50 ? "bg-warning/10 text-warning border-warning/20"
    : "bg-destructive/10 text-destructive border-destructive/20";

  return (
    <div className="space-y-3">

      {/* ── Header strip ── */}
      <Card className={cn("border", biasColor)}>
        <CardContent className="px-5 py-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Bias */}
            <div className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold uppercase tracking-wide", biasColor)}>
              <BiasIcon className="h-4 w-4" />
              {result.bias}
            </div>
            {/* Confidence */}
            <div className={cn("rounded-full border px-3 py-1 text-xs font-semibold", confColor)}>
              {pct}% confidence
            </div>
            {/* NO TRADE badge */}
            {result.no_trade && (
              <div className="flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                No Trade
              </div>
            )}
          </div>
          <ConfidenceBar value={result.confidence} />
        </CardContent>
      </Card>

      {/* ── Why No Trade ── */}
      {result.no_trade && result.reason_if_no_trade && (
        <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-destructive">
            Why No Trade
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {result.reason_if_no_trade}
          </p>
        </div>
      )}

      {/* ── Decision Zone + Sniper Entry ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="px-4 py-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              Decision Zone
            </div>
            <p className="font-mono text-sm font-bold leading-snug">{result.decision_zone}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="px-4 py-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Crosshair className="h-3.5 w-3.5" />
              Sniper Entry
            </div>
            <p className="font-mono text-sm font-bold leading-snug">{result.sniper_entry}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Price Levels ── */}
      <Card>
        <CardContent className="px-4 pt-4 pb-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Levels
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "SL", value: result.sl, active: "border-destructive/30 bg-destructive/8 text-destructive", inactive: "border-border/40 text-muted-foreground" },
              { label: "TP1", value: result.tp1, active: "border-success/30 bg-success/8 text-success", inactive: "border-border/40 text-muted-foreground" },
              { label: "TP2", value: result.tp2, active: "border-success/30 bg-success/8 text-success", inactive: "border-border/40 text-muted-foreground" },
              { label: "TP3", value: result.tp3, active: "border-success/30 bg-success/8 text-success", inactive: "border-border/40 text-muted-foreground" },
            ].map(({ label, value, active, inactive }) => (
              <div
                key={label}
                className={cn(
                  "flex flex-col items-center rounded-xl border px-2 py-2.5 text-center",
                  value === "N/A" ? inactive : active
                )}
              >
                <span className="mb-1 text-xs font-semibold opacity-70">{label}</span>
                <span className={cn("font-mono text-sm font-bold", value === "N/A" && "text-muted-foreground/40")}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Scenarios ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-success/15">
          <CardHeader className="px-4 pb-2 pt-3">
            <CardTitle className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-success">
              <TrendingUp className="h-3.5 w-3.5" />
              Long Scenario
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{result.long_scenario}</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/15">
          <CardHeader className="px-4 pb-2 pt-3">
            <CardTitle className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-destructive">
              <TrendingDown className="h-3.5 w-3.5" />
              Short Scenario
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{result.short_scenario}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── No-Trade Condition ── */}
      <Card className="border-warning/20">
        <CardContent className="px-4 py-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-warning">
            <AlertTriangle className="h-3.5 w-3.5" />
            No-Trade Condition
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{result.no_trade_condition}</p>
        </CardContent>
      </Card>

      {/* ── SMC Confluence + Reasoning ── */}
      <Card>
        <CardContent className="px-4 py-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            SMC Confluence
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SMC_LABELS) as Array<keyof typeof SMC_LABELS>).map((key) => {
              const active = result.smc_reasons[key];
              const note = result.smc_notes[key];
              return (
                <div
                  key={key}
                  title={active && note ? note : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-border/40 bg-muted/20 text-muted-foreground/40"
                  )}
                >
                  {active ? (
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                  ) : (
                    <Circle className="h-3 w-3 shrink-0" />
                  )}
                  {SMC_LABELS[key]}
                </div>
              );
            })}
          </div>

          {/* ── Reasoning: AI narrative + active SMC notes ── */}
          {(result.reasoning ||
            (Object.keys(SMC_LABELS) as Array<keyof typeof SMC_LABELS>).some(
              (k) => result.smc_reasons[k] && result.smc_notes[k]
            )) && (
            <div className="mt-3 space-y-2.5 border-t border-border/40 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reasoning
              </p>
              {result.reasoning && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {result.reasoning}
                </p>
              )}
              <div className="space-y-2">
                {(Object.keys(SMC_LABELS) as Array<keyof typeof SMC_LABELS>).map(
                  (key) => {
                    const active = result.smc_reasons[key];
                    const note = result.smc_notes[key];
                    if (!active || !note) return null;
                    return (
                      <div key={key} className="flex gap-3">
                        <span className="shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                          {SMC_LABELS[key]}
                        </span>
                        <span className="text-xs leading-relaxed text-muted-foreground">
                          {note}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Execution Plan ── */}
      <Card className="border-border/60">
        <CardContent className="px-4 py-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Execution Plan
            </p>
            <button
              onClick={handleCopyPlan}
              className="flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
            >
              {copiedPlan ? (
                <><Check className="h-3 w-3" /> Copied</>
              ) : (
                <><Copy className="h-3 w-3" /> Copy for Telegram</>
              )}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div>
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Zone</p>
              <p className="font-mono text-xs font-bold leading-snug">{result.decision_zone}</p>
            </div>
            <div>
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Entry</p>
              <p className="font-mono text-xs font-bold leading-snug">{result.sniper_entry}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {[
              { label: "SL",  value: result.sl,  color: "text-destructive" },
              { label: "TP1", value: result.tp1, color: "text-success" },
              { label: "TP2", value: result.tp2, color: "text-success" },
              { label: "TP3", value: result.tp3, color: "text-success/70" },
            ].filter(({ value }) => value !== "N/A").map(({ label, value, color }) => (
              <span key={label} className="flex items-baseline gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">{label}</span>
                <span className={cn("font-mono text-xs font-bold", color)}>{value}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
