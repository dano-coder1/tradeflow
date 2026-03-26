"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, TrendingUp, PenTool, ArrowLeftRight, Brain, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useMarketData } from "./useMarketData";
import { formatPrice } from "./MarketCard";
import { TradingViewChart, getTradingViewSymbol } from "./TradingViewChart";
import { LightweightChart, type LightweightChartHandle } from "@/components/chart/LightweightChart";
import { TimeframeBar, TV_INTERVAL_MAP, TIMEFRAMES, type Timeframe } from "@/components/chart/TimeframeBar";
import { CaptureActions, type CapturedShot } from "@/components/chart/CaptureActions";

type ChartMode = null | "tradingview" | "advanced";

interface SymbolDetailProps {
  symbol: string;
}

// ── Chart selection screen ──────────────────────────────────────────────────

function ChartSelector({ onSelect }: { onSelect: (mode: ChartMode) => void }) {
  const cards: { mode: ChartMode; icon: typeof TrendingUp; label: string; desc: string }[] = [
    { mode: "tradingview", icon: TrendingUp, label: "TradingView", desc: "Quick view with basic tools" },
    { mode: "advanced", icon: PenTool, label: "Advanced Chart", desc: "Full control with drawings and saved analysis" },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div>
        <h2 className="text-lg font-bold text-foreground text-center">Choose Chart Mode</h2>
        <p className="text-sm text-muted-foreground text-center mt-1">Select how you want to view this symbol</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
        {cards.map(({ mode, icon: Icon, label, desc }) => (
          <button
            key={mode}
            onClick={() => onSelect(mode)}
            className="glass rounded-xl p-6 text-left transition-all duration-200 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-black/20 border border-white/[0.06] hover:border-[#0EA5E9]/30 group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#0EA5E9]/15 to-[#8B5CF6]/15 mb-3 transition-colors group-hover:from-[#0EA5E9]/25 group-hover:to-[#8B5CF6]/25">
              <Icon className="h-5 w-5 text-[#0EA5E9]" />
            </div>
            <p className="text-sm font-bold text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-1">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function summarizeDrawings(drawings: { type: string; price: number; price2?: number }[]): string {
  if (!drawings.length) return "";
  const lines = drawings.filter((d) => d.type === "line");
  const zones = drawings.filter((d) => d.type === "zone");
  const parts: string[] = [];
  if (lines.length) parts.push(`${lines.length} level(s) at ${lines.map((l) => l.price.toFixed(2)).join(", ")}`);
  if (zones.length) parts.push(`${zones.length} zone(s): ${zones.map((z) => `${z.price.toFixed(2)}-${z.price2?.toFixed(2)}`).join(", ")}`);
  return parts.join("; ");
}

const DRAFT_KEY = "tf:analyzer-drafts";

function saveDrafts(shots: CapturedShot[]) {
  try {
    // Store only metadata (data URLs are large, limit to 6)
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(shots.slice(-6)));
  } catch {}
}

function loadDrafts(): CapturedShot[] {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ── Main component ──────────────────────────────────────────────────────────

export function SymbolDetail({ symbol }: SymbolDetailProps) {
  const router = useRouter();
  const tvSymbol = getTradingViewSymbol(symbol);
  const symbols = useMemo(() => [symbol], [symbol]);
  const data = useMarketData(symbols);
  const instrument = data[symbol];
  const [chartMode, setChartMode] = useState<ChartMode>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [drafts, setDrafts] = useState<CapturedShot[]>(() => loadDrafts());
  const lwChartRef = useRef<LightweightChartHandle>(null);

  // ── Context builders ──────────────────────────────────────────────────────

  const buildContext = useCallback(async () => {
    try {
      const res = await fetch(`/api/drawings?symbol=${encodeURIComponent(symbol)}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.drawings) && json.drawings.length > 0)
          return json.drawings as { type: string; price: number; price2?: number }[];
      }
    } catch {}
    return [];
  }, [symbol]);

  const handleAnalyze = useCallback(async () => {
    const drawings = await buildContext();
    const price = instrument?.price;
    const params = new URLSearchParams();
    params.set("symbol", symbol);
    if (price) params.set("price", price.toString());
    if (chartMode) params.set("chartMode", chartMode);
    const summary = summarizeDrawings(drawings);
    if (summary) params.set("context", `Chart drawings on ${symbol}: ${summary}`);
    router.push(`/dashboard/strategy?${params.toString()}`);
  }, [symbol, instrument, chartMode, buildContext, router]);

  const handleCreateTrade = useCallback(async () => {
    const drawings = await buildContext();
    const params = new URLSearchParams();
    params.set("symbol", symbol);
    const summary = summarizeDrawings(drawings);
    if (summary) params.set("notes", `Chart analysis: ${summary}`);
    router.push(`/trades/new?${params.toString()}`);
  }, [symbol, buildContext, router]);

  // ── Screenshot capture ────────────────────────────────────────────────────

  const captureAdvancedChart = useCallback((): string | null => {
    return lwChartRef.current?.takeScreenshot() ?? null;
  }, []);

  const captureCurrent = useCallback(async (): Promise<CapturedShot | null> => {
    if (chartMode !== "advanced") {
      // TradingView is an iframe — can't screenshot due to cross-origin
      alert("Screenshot capture requires Advanced Chart mode. Switch to Advanced Chart first.");
      return null;
    }
    const dataUrl = captureAdvancedChart();
    if (!dataUrl) return null;
    const shot: CapturedShot = {
      dataUrl,
      symbol,
      timeframe,
      chartMode: chartMode!,
      timestamp: Date.now(),
    };
    setDrafts((prev) => {
      const next = [...prev, shot].slice(-6);
      saveDrafts(next);
      return next;
    });
    return shot;
  }, [chartMode, captureAdvancedChart, symbol, timeframe]);

  const captureFullSet = useCallback(async (): Promise<CapturedShot[]> => {
    if (chartMode !== "advanced") {
      alert("Full set capture requires Advanced Chart mode.");
      return [];
    }
    const shots: CapturedShot[] = [];
    for (const tf of TIMEFRAMES) {
      setTimeframe(tf);
      // Wait for chart to re-render with new timeframe
      await new Promise((r) => setTimeout(r, 1200));
      const dataUrl = captureAdvancedChart();
      if (dataUrl) {
        shots.push({
          dataUrl,
          symbol,
          timeframe: tf,
          chartMode: "advanced",
          timestamp: Date.now(),
        });
      }
    }
    setDrafts((prev) => {
      const next = [...prev, ...shots].slice(-6);
      saveDrafts(next);
      return next;
    });
    return shots;
  }, [chartMode, captureAdvancedChart, symbol]);

  const analyzeNow = useCallback(async () => {
    let shots = drafts;
    // If no drafts, capture current first
    if (shots.length === 0) {
      const shot = await captureCurrent();
      if (shot) shots = [shot];
    }
    if (shots.length === 0) return;
    // Store drafts for the analyzer page to pick up
    saveDrafts(shots);
    router.push("/dashboard/analyze");
  }, [drafts, captureCurrent, router]);

  // ── Unsupported symbol ────────────────────────────────────────────────────

  if (!tvSymbol) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/markets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Markets
        </Link>
        <div className="flex items-center justify-center rounded-xl border border-dashed border-white/[0.08] py-24">
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground mb-1">{symbol}</p>
            <p className="text-sm text-muted-foreground">Unsupported symbol</p>
          </div>
        </div>
      </div>
    );
  }

  const price = instrument?.price ?? null;
  const change = instrument?.change ?? null;
  const changePercent = instrument?.changePercent ?? null;
  const marketStatus = instrument?.marketStatus ?? "closed";
  const loading = instrument?.loading ?? true;
  const isPositive = (change ?? 0) >= 0;

  return (
    <div className="space-y-3">
      {/* Back link */}
      <Link href="/dashboard/markets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to Markets
      </Link>

      {/* Header: symbol + price + change */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold text-foreground">{symbol}</h1>
          <Badge variant={marketStatus === "open" ? "success" : "secondary"}>{marketStatus}</Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-3">
            {loading && price === null ? (
              <div className="h-8 w-32 animate-pulse rounded bg-white/[0.06]" />
            ) : price !== null ? (
              <>
                <span className="font-mono text-3xl font-bold text-foreground tabular-nums">
                  {formatPrice(price, symbol)}
                </span>
                {change !== null && changePercent !== null && (
                  <span className={cn("font-mono text-sm font-semibold tabular-nums", isPositive ? "text-emerald-400" : "text-red-400")}>
                    {isPositive ? "+" : ""}{changePercent.toFixed(2)}%
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Price unavailable</span>
            )}
          </div>

          {chartMode && (
            <button
              onClick={() => setChartMode(null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Change Mode
            </button>
          )}
        </div>
      </div>

      {/* Toolbar row: TF + Actions + Workflow */}
      {chartMode && (
        <div className="flex flex-wrap items-center gap-2">
          <TimeframeBar active={timeframe} onChange={setTimeframe} />
          <CaptureActions
            onCaptureCurrent={captureCurrent}
            onCaptureFullSet={captureFullSet}
            onAnalyzeNow={analyzeNow}
            drafts={drafts}
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleAnalyze}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B5CF6]/15 px-3 py-1.5 text-xs font-semibold text-[#8B5CF6] transition-colors hover:bg-[#8B5CF6]/25"
            >
              <Brain className="h-3.5 w-3.5" />
              Coach
            </button>
            <button
              onClick={handleCreateTrade}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0EA5E9]/15 px-3 py-1.5 text-xs font-semibold text-[#0EA5E9] transition-colors hover:bg-[#0EA5E9]/25"
            >
              <Plus className="h-3.5 w-3.5" />
              Trade
            </button>
          </div>
        </div>
      )}

      {/* Chart area */}
      {chartMode === null && <ChartSelector onSelect={setChartMode} />}

      {chartMode === "tradingview" && (
        <div className="glass rounded-xl overflow-hidden" style={{ height: "calc(100vh - 120px)", width: "100%" }}>
          <TradingViewChart symbol={symbol} interval={TV_INTERVAL_MAP[timeframe]} />
        </div>
      )}

      {chartMode === "advanced" && (
        <LightweightChart ref={lwChartRef} symbol={symbol} timeframe={timeframe} />
      )}
    </div>
  );
}
