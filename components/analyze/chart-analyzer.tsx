"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChartAnalysis, SmcReasons } from "@/types/ai";
import { AnalysisRun } from "@/app/api/ai/analyze-chart/history/route";
import { CoachChat } from "@/components/analyze/coach-chat";
import { AnalysisResult, SMC_LABELS } from "@/components/analyze/analysis-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { playSound } from "@/lib/sounds";
import {
  Upload,
  X,
  ScanLine,
  AlertTriangle,
  History,
  ChevronDown,
  ChevronUp,
  Save,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Circle,
  TrendingUp,
  TrendingDown,
  Minus,
  GitBranch,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { addAlerts, extractNumericLevel, type StoredAlert } from "@/lib/alert-store";

// ─── History panel (unchanged) ───────────────────────────────────────────────

function HistoryPanel({
  onLoad,
}: {
  onLoad: (analysis: ChartAnalysis, id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchHistory() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/analyze-chart/history");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load history");
      setRuns(json as AnalysisRun[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && runs.length === 0) fetchHistory();
  }

  return (
    <Card>
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Recent Analyses
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <CardContent className="pt-0 pb-3">
          {loading && (
            <p className="py-4 text-center text-xs text-muted-foreground">Loading…</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {!loading && !error && runs.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">No analyses yet.</p>
          )}
          {!loading && runs.length > 0 && (
            <div className="divide-y divide-border">
              {runs.map((run) => (
                <div key={run.id} className="flex items-center justify-between gap-2 py-2.5">
                  <button
                    onClick={() => onLoad(run.output_json, run.id)}
                    className="flex flex-1 items-center gap-2 text-left text-sm transition-colors hover:text-foreground"
                  >
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-bold uppercase",
                        run.bias === "bullish"
                          ? "bg-success/15 text-success"
                          : run.bias === "bearish"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-warning/15 text-warning"
                      )}
                    >
                      {run.bias}
                    </span>
                    {run.no_trade && (
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                        NO TRADE
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{run.image_count} img</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {new Date(run.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                  <Link
                    href={`/dashboard/analyze/${run.id}`}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="View full detail"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Changes diff helper ──────────────────────────────────────────────────────

function computeChanges(prev: ChartAnalysis, next: ChartAnalysis): string[] {
  const out: string[] = [];
  if (prev.bias !== next.bias) out.push(`Bias: ${prev.bias} → ${next.bias}`);
  const pp = Math.round(prev.confidence * 100);
  const np = Math.round(next.confidence * 100);
  if (Math.abs(pp - np) >= 5) out.push(`Confidence: ${pp}% → ${np}%`);
  if (prev.no_trade !== next.no_trade)
    out.push(next.no_trade ? "Downgraded to NO TRADE" : "Upgraded — trade now valid");
  if (prev.sl !== next.sl && next.sl !== "N/A") out.push(`SL: ${prev.sl} → ${next.sl}`);
  if (prev.tp1 !== next.tp1 && next.tp1 !== "N/A") out.push(`TP1: ${prev.tp1} → ${next.tp1}`);
  if (prev.tp2 !== next.tp2 && next.tp2 !== "N/A") out.push(`TP2: ${prev.tp2} → ${next.tp2}`);
  if (prev.tp3 !== next.tp3 && next.tp3 !== "N/A") out.push(`TP3: ${prev.tp3} → ${next.tp3}`);
  return out;
}

// ─── Verdict derivation ───────────────────────────────────────────────────────

type Verdict = "EXECUTE" | "WAIT" | "NO_TRADE";

function deriveVerdict(result: ChartAnalysis): Verdict {
  if (result.no_trade) return "NO_TRADE";
  const pct = Math.round(result.confidence * 100);
  return pct >= 70 ? "EXECUTE" : "WAIT";
}

const VERDICT_CONFIG: Record<Verdict, { label: string; border: string; bg: string; text: string; desc: string }> = {
  EXECUTE:  { label: "EXECUTE",  border: "border-success/35",     bg: "bg-success/8",     text: "text-success",     desc: "Setup is valid — execute at zone confirmation." },
  WAIT:     { label: "WAIT",     border: "border-warning/35",     bg: "bg-warning/8",     text: "text-warning",     desc: "Moderate confluence — wait for stronger confirmation." },
  NO_TRADE: { label: "NO TRADE", border: "border-destructive/35", bg: "bg-destructive/8", text: "text-destructive", desc: "Setup does not meet minimum criteria — stand aside." },
};

// ─── LEFT: Execution panel ────────────────────────────────────────────────────

function ExecutionPanel({ result }: { result: ChartAnalysis }) {
  const [loggedResult, setLoggedResult] = useState<"win" | "loss" | "breakeven" | null>(null);

  const verdict = deriveVerdict(result);
  const cfg = VERDICT_CONFIG[verdict];
  const pct = Math.round(result.confidence * 100);

  const BiasIcon =
    result.bias === "bullish" ? TrendingUp : result.bias === "bearish" ? TrendingDown : Minus;
  const biasColor =
    result.bias === "bullish" ? "text-success" : result.bias === "bearish" ? "text-destructive" : "text-warning";
  const confColor = pct >= 70 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-destructive";
  const confTextColor = pct >= 70 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive";

  const levels = [
    { label: "Entry",  value: result.sniper_entry, color: "text-foreground"                                             },
    { label: "SL",     value: result.sl,            color: result.sl  !== "N/A" ? "text-destructive"  : "text-muted-foreground/30" },
    { label: "TP1",    value: result.tp1,           color: result.tp1 !== "N/A" ? "text-success"      : "text-muted-foreground/30" },
    { label: "TP2",    value: result.tp2,           color: result.tp2 !== "N/A" ? "text-success"      : "text-muted-foreground/30" },
    { label: "TP3",    value: result.tp3,           color: result.tp3 !== "N/A" ? "text-success/70"   : "text-muted-foreground/30" },
  ];

  function handleLog(r: "win" | "loss" | "breakeven") {
    const next = loggedResult === r ? null : r;
    setLoggedResult(next);
    if (next) playSound(next === "win" ? "success" : next === "loss" ? "mistake" : "warning");
  }

  return (
    <div className="space-y-3 lg:sticky lg:top-20">

      {/* Verdict */}
      <div className={cn("rounded-xl border px-4 py-4 space-y-3", cfg.border, cfg.bg)}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
          Verdict
        </p>
        <p className={cn("text-xl font-bold tracking-wider", cfg.text)}>
          {cfg.label}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground/70">{cfg.desc}</p>

        <div className="pt-1">
          <div className="mb-1 flex items-center gap-1.5">
            <BiasIcon className={cn("h-3.5 w-3.5", biasColor)} />
            <span className={cn("text-xs font-bold uppercase tracking-wide", biasColor)}>
              {result.bias}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Confidence</span>
            <span className={cn("font-semibold", confTextColor)}>{pct}%</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted/50">
            <div className={cn("h-full rounded-full transition-all", confColor)} style={{ width: `${pct}%` }} />
          </div>
        </div>

        {result.no_trade && result.reason_if_no_trade && (
          <p className="border-t border-border/30 pt-2.5 text-xs leading-relaxed text-muted-foreground">
            {result.reason_if_no_trade}
          </p>
        )}
      </div>

      {/* Key levels */}
      <div className="rounded-xl border border-border/50 bg-card px-4 py-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
          Key Levels
        </p>
        {levels.map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground/70 w-8 shrink-0">{label}</span>
            <span className={cn("font-mono text-xs font-semibold truncate text-right", color)}>
              {value === "N/A" ? "—" : value}
            </span>
          </div>
        ))}
      </div>

      {/* Trade result logger */}
      <div className="rounded-xl border border-border/50 bg-card px-4 py-3 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
          Log Result
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ["win",        "WIN",  "border-success/40 text-success bg-success/10",          "border-success/20 text-success/50 hover:border-success/35"        ],
              ["loss",       "LOSS", "border-destructive/40 text-destructive bg-destructive/10", "border-destructive/20 text-destructive/50 hover:border-destructive/35"],
              ["breakeven",  "BE",   "border-warning/40 text-warning bg-warning/10",           "border-warning/20 text-warning/50 hover:border-warning/35"        ],
            ] as const
          ).map(([value, label, activeClass, inactiveClass]) => (
            <button
              key={value}
              onClick={() => handleLog(value)}
              className={cn(
                "rounded-lg border py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors",
                loggedResult === value ? activeClass : inactiveClass
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {loggedResult && (
          <p className={cn(
            "text-xs leading-relaxed",
            loggedResult === "win" ? "text-success" : loggedResult === "loss" ? "text-destructive" : "text-warning"
          )}>
            {loggedResult === "win"
              ? "Execution recorded. Review what you did right."
              : loggedResult === "loss"
                ? "Loss recorded. Identify which rule was broken."
                : "Break-even. Analyze what delayed your exit."}
          </p>
        )}
      </div>

    </div>
  );
}

// ─── RIGHT: SMC confluence only (compact validation panel) ───────────────────

function SmcAutopsyPanel({ result }: { result: ChartAnalysis }) {
  const confirmed = (Object.keys(SMC_LABELS) as Array<keyof SmcReasons>).filter(
    (k) => result.smc_reasons[k]
  );
  const missing = (Object.keys(SMC_LABELS) as Array<keyof SmcReasons>).filter(
    (k) => !result.smc_reasons[k]
  );

  const confluenceScore = confirmed.length;
  const totalSignals = Object.keys(SMC_LABELS).length;
  const scoreColor =
    confluenceScore >= 5 ? "text-success" : confluenceScore >= 3 ? "text-warning" : "text-destructive";
  const scoreBarColor =
    confluenceScore >= 5 ? "bg-success" : confluenceScore >= 3 ? "bg-warning" : "bg-destructive";

  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-4 space-y-4 lg:sticky lg:top-20">

      {/* Header + confluence score */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
          SMC Confluence
        </p>
        <div className="text-right">
          <p className={cn("text-sm font-bold tabular-nums", scoreColor)}>
            {confluenceScore}/{totalSignals}
          </p>
          <p className="text-[9px] uppercase tracking-wide text-muted-foreground/50">signals</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted/50">
        <div
          className={cn("h-full rounded-full transition-all", scoreBarColor)}
          style={{ width: `${(confluenceScore / totalSignals) * 100}%` }}
        />
      </div>

      {/* What confirms */}
      {confirmed.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-success/80">
            <CheckCircle2 className="h-3 w-3" />
            Confirmed
          </p>
          <div className="flex flex-wrap gap-1.5">
            {confirmed.map((k) => (
              <span
                key={k}
                title={result.smc_notes[k] ?? undefined}
                className="flex items-center gap-1 rounded-full border border-success/25 bg-success/8 px-2 py-0.5 text-[10px] font-medium text-success"
              >
                {SMC_LABELS[k]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* What's missing */}
      {missing.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/40">
            <Circle className="h-3 w-3" />
            Missing
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((k) => (
              <span
                key={k}
                className="flex items-center gap-1 rounded-full border border-border/40 bg-muted/20 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/40"
              >
                {SMC_LABELS[k]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Biggest risk / Why no trade */}
      <div className={cn(
        "rounded-lg border px-3 py-2.5",
        result.no_trade
          ? "border-destructive/20 bg-destructive/5"
          : "border-warning/20 bg-warning/5"
      )}>
        <p className={cn(
          "mb-1.5 text-[10px] font-bold uppercase tracking-wide",
          result.no_trade ? "text-destructive" : "text-warning"
        )}>
          {result.no_trade ? "Why No Trade" : "Biggest Risk"}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {result.no_trade
            ? (result.reason_if_no_trade || result.no_trade_condition)
            : result.no_trade_condition}
        </p>
      </div>

      {/* AI read */}
      {result.reasoning && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            AI Read
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">{result.reasoning}</p>
        </div>
      )}

      {/* Signal notes */}
      {confirmed.some((k) => result.smc_notes[k]) && (
        <div className="border-t border-border/30 pt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
            Signal Notes
          </p>
          {confirmed.map((k) => {
            const note = result.smc_notes[k];
            if (!note) return null;
            return (
              <div key={k} className="flex gap-2.5">
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-success/60 pt-0.5 w-14">
                  {SMC_LABELS[k]}
                </span>
                <span className="text-[11px] leading-relaxed text-muted-foreground">{note}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Symbol detection from AI output ────────────────────────────────────────

// Ordered longest-first so "XAUUSD" matches before "XAU", "BTCUSDT" before "BTC", etc.
const KNOWN_INSTRUMENTS = [
  "XAUUSD", "XAGUSD",
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCHF", "USDCAD", "NZDUSD",
  "EURGBP", "EURJPY", "GBPJPY", "CHFJPY", "AUDJPY",
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
  "BTCUSD", "ETHUSD",
  "NAS100", "US500", "SPX500", "US30", "DXY", "USOIL", "UKOIL",
  "BTC", "ETH", "BNB", "SOL", "XRP",
];

// Word aliases for common names the AI uses in free text
const ALIASES: Array<[RegExp, string]> = [
  [/\bGOLD\b/i,         "XAUUSD"],
  [/\bSILVER\b/i,       "XAGUSD"],
  [/\bBITCOIN\b/i,      "BTCUSDT"],
  [/\bETHEREUM\b/i,     "ETHUSDT"],
  [/\bNASDAQ\b/i,       "NAS100"],
  [/\bDOW\s*JONES\b/i,  "US30"],
  [/\bS&P\b/i,          "US500"],
  [/\bCRUDE\s*OIL\b/i,  "USOIL"],
];

function detectSymbol(analysis: ChartAnalysis): string | null {
  // Collect every text field — the AI mentions the instrument in free text
  const parts: string[] = [
    analysis.telegram_block,
    analysis.decision_zone,
    analysis.long_scenario,
    analysis.short_scenario,
    analysis.sniper_entry,
    analysis.no_trade_condition,
    analysis.reasoning ?? "",
    analysis.reason_if_no_trade ?? "",
    ...Object.values(analysis.smc_notes).filter((v): v is string => !!v),
  ];
  const fullText = parts.join(" ");

  // 1. Word-alias pass on original text (catches "Gold", "Bitcoin", etc.)
  for (const [pattern, canonical] of ALIASES) {
    if (pattern.test(fullText)) return canonical;
  }

  // 2. Normalise: remove slashes so "XAU/USD" → "XAUUSD", "EUR/USD" → "EURUSD"
  const normalized = fullText.replace(/\//g, "").toUpperCase();

  // 3. Known-instrument pass on normalised text
  for (const sym of KNOWN_INSTRUMENTS) {
    if (normalized.includes(sym)) return sym;
  }

  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChartAnalyzer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ChartAnalysis | null>(null);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [changes, setChanges] = useState<string[]>([]);
  const [historyKey, setHistoryKey] = useState(0);
  const [symbol, setSymbol] = useState("");
  const [symbolSaved, setSymbolSaved] = useState<string | null>(null);
  const [alertsSet, setAlertsSet] = useState<string | null>(null);
  const [alertSymbol, setAlertSymbol] = useState("");

  function handleSetAlerts() {
    if (!result) return;
    const sym = symbolSaved || alertSymbol.trim().toUpperCase();
    if (!sym) return;
    const levels: { label: string; field: string | undefined }[] = [
      { label: "Entry", field: result.sniper_entry },
      { label: "SL", field: result.sl },
      { label: "TP1", field: result.tp1 },
      { label: "TP2", field: result.tp2 },
      { label: "TP3", field: result.tp3 },
    ];
    const alerts: StoredAlert[] = [];
    const desc: string[] = [];
    for (const { label, field } of levels) {
      const n = extractNumericLevel(field);
      if (n == null) continue;
      alerts.push({
        id: `${activeAnalysisId}_${label}`,
        symbol: sym,
        level: n,
        label,
        analysisId: activeAnalysisId ?? "",
        createdAt: new Date().toISOString(),
      });
      desc.push(`${label} ${n}`);
    }
    if (alerts.length === 0) return;
    addAlerts(alerts);
    setAlertsSet(`Alerts set for ${sym}: ${desc.join(", ")}`);
  }

  const [continuingFrom, setContinuingFrom] = useState<{
    analysis: ChartAnalysis;
    symbol: string;
    fromId: string;
  } | null>(null);

  // Listen for "Continue" clicks from instrument folders
  useEffect(() => {
    function handleContinue(e: Event) {
      const detail = (e as CustomEvent).detail as {
        analysis: ChartAnalysis;
        symbol: string;
        fromId: string;
      };
      setContinuingFrom(detail);
      setResult(null);
      setActiveAnalysisId(null);
      setImages([]);
      setSaved(false);
      setSaveError(null);
      setChanges([]);
      setSymbolSaved(null);
      setSymbol(detail.symbol);
    }
    window.addEventListener("tf:continue-analysis", handleContinue);
    return () => window.removeEventListener("tf:continue-analysis", handleContinue);
  }, []);

  async function handleFiles(files: FileList) {
    const remaining = 6 - images.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      const uploaded = await Promise.all(
        toUpload.map(async (file) => {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Upload failed");
          return json.imageUrl as string;
        })
      );
      setImages((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
    setActiveAnalysisId(null);
    setSaved(false);
    setSaveError(null);
    setChanges([]);
    setSymbolSaved(null);
  }

  async function handleAnalyze() {
    if (images.length === 0) return;

    // Same-session: user adds screenshots to an active analysis → UPDATE existing record
    const isSameSession = result !== null && activeAnalysisId !== null && !continuingFrom;
    // Folder continuation: user clicked Continue in a folder → NEW record with prev context
    const isFolderContinuation = continuingFrom !== null;
    const prevSnapshot = isSameSession ? result : null;

    setAnalyzing(true);
    setError(null);
    setSaved(false);
    setSaveError(null);
    setChanges([]);
    setSymbolSaved(null);
    setAlertsSet(null);
    setAlertSymbol("");

    if (!isSameSession && !isFolderContinuation) {
      setResult(null);
      setActiveAnalysisId(null);
    }

    try {
      const payload: Record<string, unknown> = { imageUrls: images };
      if (isSameSession) {
        payload.previousAnalysis = result;
        payload.analysisId = activeAnalysisId;
      } else if (isFolderContinuation) {
        // Send previous analysis as context but NO analysisId → creates new record
        payload.previousAnalysis = continuingFrom.analysis;
      }

      const res = await fetch("/api/ai/analyze-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analysis failed");
      const analysis = json as ChartAnalysis;
      setResult(analysis);

      // Sound feedback on new analysis
      const pct = Math.round(analysis.confidence * 100);
      if (analysis.no_trade) playSound("mistake");
      else if (pct >= 70) playSound("success");
      else playSound("warning");

      if (analysis.analysisId) {
        setActiveAnalysisId(analysis.analysisId);
        setSaved(true);
        setHistoryKey((k) => k + 1);

        // Auto-detect symbol from AI output if user hasn't typed one
        const detectedSymbol = detectSymbol(analysis);
        const symbolToTag = symbol.trim().toUpperCase() || detectedSymbol;
        console.log("[chart-analyzer] symbol tagging:", {
          manualSymbol: symbol.trim().toUpperCase() || null,
          detectedSymbol,
          symbolToTag,
          analysisId: analysis.analysisId,
        });
        if (symbolToTag) {
          setSymbol(symbolToTag);
          try {
            const tagRes = await fetch("/api/ai/analyze-chart/tag-symbol", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                analysisId: analysis.analysisId,
                symbol: symbolToTag,
                ...(isFolderContinuation ? { continuedFrom: continuingFrom.fromId } : {}),
              }),
            });
            const tagJson = await tagRes.json().catch(() => ({}));
            if (!tagRes.ok) {
              console.error("[chart-analyzer] tag-symbol failed:", tagRes.status, tagJson);
              setSaveError(`Symbol tag failed: ${tagJson.error ?? tagRes.status}`);
            } else {
              console.log("[chart-analyzer] tag-symbol success:", tagJson);
              setSymbolSaved(symbolToTag);
              // Notify the instrument folder view to re-fetch
              window.dispatchEvent(new CustomEvent("tf:analyses-updated"));
            }
          } catch (tagEx) {
            console.error("[chart-analyzer] tag-symbol network error:", tagEx);
          }
        } else {
          console.log("[chart-analyzer] no symbol to tag — enter one manually or AI output had none");
        }
      } else {
        setSaveError("Analysis complete but could not be saved to history.");
      }

      if (isSameSession && prevSnapshot) {
        setChanges(computeChanges(prevSnapshot, analysis));
      }
      if (isFolderContinuation) {
        setContinuingFrom(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  const isContinuation = (result !== null && activeAnalysisId !== null) || continuingFrom !== null;
  const slots = Array.from({ length: 6 });

  return (
    <div className="space-y-5">

      {/* ── History panel ── */}
      <HistoryPanel
        key={historyKey}
        onLoad={(analysis, id) => {
          setResult(analysis);
          setActiveAnalysisId(id);
          setSaved(false);
          setSaveError(null);
          const detected = detectSymbol(analysis);
          if (detected) setSymbol(detected);
        }}
      />

      {/* ── Folder continuation banner ── */}
      {continuingFrom && (
        <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4 text-primary" />
            <span>
              Continuing <span className="font-mono font-bold text-primary">{continuingFrom.symbol}</span> analysis
            </span>
            <span className="text-xs text-muted-foreground">— upload new screenshots and click Analyze</span>
          </div>
          <button
            onClick={() => {
              setContinuingFrom(null);
              setSymbol("");
            }}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Upload section ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            Screenshots (1 – 6)
            {isContinuation && images.length < 6 && (
              <span className="text-xs font-normal text-muted-foreground">
                Add a screenshot to refine this analysis
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {slots.map((_, i) => {
              const url = images[i];
              return url ? (
                <div
                  key={i}
                  className="relative aspect-video overflow-hidden rounded-lg border border-border"
                >
                  <Image src={url} alt={`Chart ${i + 1}`} fill className="object-cover" unoptimized />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5 backdrop-blur-sm hover:bg-background"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <span className="absolute bottom-1 left-1 rounded bg-background/70 px-1 text-xs backdrop-blur-sm">
                    {i + 1}
                  </span>
                </div>
              ) : (
                <button
                  key={i}
                  onClick={() => images.length === i && inputRef.current?.click()}
                  disabled={uploading || images.length !== i}
                  className={cn(
                    "flex aspect-video flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed text-xs text-muted-foreground transition-colors",
                    images.length === i
                      ? "border-border hover:border-primary/50 hover:text-foreground"
                      : "border-border/30 opacity-30"
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {images.length === i ? (uploading ? "…" : `+${i + 1}`) : ""}
                </button>
              );
            })}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center gap-2">
            <label className="shrink-0 text-xs font-medium text-muted-foreground">Instrument</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. XAUUSD (auto-detected)"
              className="h-8 w-44 rounded-md border border-border bg-transparent px-2.5 font-mono text-sm font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            {symbol && (
              <button
                onClick={() => setSymbol("")}
                className="text-[11px] text-muted-foreground/50 hover:text-foreground"
              >
                ✕ clear
              </button>
            )}
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={images.length === 0 || uploading}
            loading={analyzing}
            className="w-full gap-2"
          >
            {isContinuation ? <RefreshCw className="h-4 w-4" /> : <ScanLine className="h-4 w-4" />}
            {analyzing
              ? isContinuation ? "Refining…" : "Analyzing…"
              : isContinuation ? "Continue Analysis" : "Analyze"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Result area ── */}
      {result && (
        <>
          {/* Status bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {saved && activeAnalysisId && (
              <div className="flex items-center gap-2 text-success">
                <Save className="h-3.5 w-3.5" />
                Saved to history
                <Link
                  href={`/dashboard/analyze/${activeAnalysisId}`}
                  className="flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View detail
                </Link>
              </div>
            )}
            {symbolSaved && (
              <div className="flex items-center gap-1.5 text-primary">
                <span className="font-mono font-bold">{symbolSaved}</span>
                <span className="text-muted-foreground">saved to instrument folder</span>
              </div>
            )}
            {saved && !symbolSaved && !saveError && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" />
                No instrument detected — type a symbol above and re-analyze, or enter it in the field
              </div>
            )}
            {saveError && (
              <div className="flex items-center gap-1.5 text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                {saveError}
              </div>
            )}
          </div>

          {/* Continuation refinements */}
          {changes.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                <RefreshCw className="h-3.5 w-3.5" />
                Refinements
              </p>
              <ul className="space-y-0.5">
                {changes.map((c) => (
                  <li key={c} className="text-xs text-muted-foreground">· {c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Set Price Alerts ── */}
          {saved && !alertsSet && (
            <div className="flex w-full flex-col sm:flex-row items-stretch sm:items-center gap-3 rounded-xl border border-[#0EA5E9]/20 bg-gradient-to-r from-[#0EA5E9]/10 via-[#0EA5E9]/5 to-[#8B5CF6]/10 px-5 py-4">
              {!symbolSaved && (
                <input
                  type="text"
                  value={alertSymbol}
                  onChange={(e) => setAlertSymbol(e.target.value.toUpperCase())}
                  placeholder="Symbol, e.g. XAUUSD"
                  className="h-10 w-full sm:w-40 rounded-lg border border-[#0EA5E9]/20 bg-black/30 px-3 font-mono text-sm font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-[#0EA5E9]/40"
                />
              )}
              <button
                onClick={handleSetAlerts}
                disabled={!symbolSaved && !alertSymbol.trim()}
                className="flex flex-1 items-center justify-center gap-3 rounded-lg px-4 py-2.5 text-sm font-semibold text-[#0EA5E9] transition-all duration-200 hover:bg-[#0EA5E9]/10 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Bell className="h-5 w-5" />
                {symbolSaved
                  ? `Set Price Alerts for ${symbolSaved}`
                  : alertSymbol.trim()
                    ? `Set Price Alerts for ${alertSymbol.trim()}`
                    : "Enter symbol to set alerts"}
              </button>
            </div>
          )}
          {alertsSet && (
            <div className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#0EA5E9]/20 bg-[#0EA5E9]/5 px-6 py-4 text-sm text-[#0EA5E9]">
              <Bell className="h-5 w-5 shrink-0" />
              {alertsSet}
            </div>
          )}

          {/* ── 3-column layout ── */}
          {/*
            LEFT  (200px) : ExecutionPanel — verdict + key levels + log result
            CENTER (1fr)  : AnalysisResult + CoachChat — main content + interactive assistant
            RIGHT (260px) : SmcAutopsyPanel — compact SMC confluence validation
          */}
          <div className="grid gap-5 lg:grid-cols-[200px_1fr_260px]">

            {/* LEFT: Execution panel — shown 1st on mobile (verdict first), col 1 on desktop */}
            <div className="order-1 lg:order-none">
              <ExecutionPanel result={result} />
            </div>

            {/* CENTER: Analysis + Coach — shown 2nd on mobile, col 2 on desktop */}
            <div className="order-2 lg:order-none space-y-5">
              <AnalysisResult result={result} />
              <CoachChat analysisId={activeAnalysisId} />
            </div>

            {/* RIGHT: SMC Confluence — shown 3rd on mobile, col 3 on desktop */}
            <div className="order-3 lg:order-none">
              <SmcAutopsyPanel result={result} />
            </div>

          </div>
        </>
      )}

    </div>
  );
}
