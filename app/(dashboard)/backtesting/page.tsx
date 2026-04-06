"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createChart, createSeriesMarkers, LineSeries, type IChartApi } from "lightweight-charts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Metrics {
  total_trades: number;
  win_rate: number;
  profit_factor: number;
  max_drawdown: number;
  net_profit: number;
  avg_win: number;
  avg_loss: number;
}

interface Trade {
  entry_ts: string;
  exit_ts: string;
  direction: string;
  entry_price: number;
  exit_price: number;
  pnl: number;
  rr: number;
  result: "win" | "loss";
}

interface EquityPoint {
  ts: string;
  equity: number;
}

interface BacktestResults {
  metrics: Metrics;
  equity_curve: (EquityPoint | number)[];
  trades: Trade[];
}

type JobStatus = "idle" | "pending" | "running" | "completed" | "failed";

interface ParsedDSL {
  market?: string;
  timeframe?: string;
  date_range?: { from: string; to: string };
  entry?: {
    direction?: string;
    conditions?: Array<Record<string, unknown>>;
  };
  exit?: {
    stop_loss?: { type: string; value: number };
    take_profit?: { type: string; ratio: number };
  };
  filters?: Array<{ type: string; sessions?: string[] }>;
  commission_pct?: number;
}

interface ParseResult {
  dsl: ParsedDSL;
  assumptions: string[];
  warnings: string[];
  needs_confirmation: boolean;
}

interface SavedStrategy {
  id: string;
  name: string;
  dsl: ParsedDSL;
  created_at: string;
}

type Tab = "templates" | "saved" | "describe";

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const TEMPLATES: { name: string; summary: string; dsl: ParsedDSL }[] = [
  {
    name: "EMA Crossover",
    summary: "EMA 20/50, RSI > 50, SL 0.5%, RR 2, London",
    dsl: {
      market: "XAUUSD",
      timeframe: "15m",
      entry: {
        direction: "long",
        conditions: [
          { type: "ema_cross", fast: 20, slow: 50 },
          { type: "rsi_above", period: 14, value: 50 },
        ],
      },
      exit: {
        stop_loss: { type: "fixed_pct", value: 0.5 },
        take_profit: { type: "rr", ratio: 2.0 },
      },
      filters: [{ type: "session", sessions: ["london"] }],
      commission_pct: 0.07,
    },
  },
  {
    name: "RSI Trend Filter",
    summary: "EMA 50/200, RSI > 55, SL 0.8%, RR 2.5, London + NY",
    dsl: {
      market: "XAUUSD",
      timeframe: "15m",
      entry: {
        direction: "long",
        conditions: [
          { type: "ema_cross", fast: 50, slow: 200 },
          { type: "rsi_above", period: 14, value: 55 },
        ],
      },
      exit: {
        stop_loss: { type: "fixed_pct", value: 0.8 },
        take_profit: { type: "rr", ratio: 2.5 },
      },
      filters: [{ type: "session", sessions: ["london", "new_york"] }],
      commission_pct: 0.07,
    },
  },
  {
    name: "Breakout Session",
    summary: "EMA 20/50, SL 1%, RR 3, London NY overlap",
    dsl: {
      market: "XAUUSD",
      timeframe: "15m",
      entry: {
        direction: "long",
        conditions: [{ type: "ema_cross", fast: 20, slow: 50 }],
      },
      exit: {
        stop_loss: { type: "fixed_pct", value: 1.0 },
        take_profit: { type: "rr", ratio: 3.0 },
      },
      filters: [{ type: "session", sessions: ["london_ny_overlap"] }],
      commission_pct: 0.07,
    },
  },
  {
    name: "Conservative Scalp",
    summary: "EMA 10/20, RSI > 50, SL 0.3%, RR 1.5, London",
    dsl: {
      market: "XAUUSD",
      timeframe: "15m",
      entry: {
        direction: "long",
        conditions: [
          { type: "ema_cross", fast: 10, slow: 20 },
          { type: "rsi_above", period: 14, value: 50 },
        ],
      },
      exit: {
        stop_loss: { type: "fixed_pct", value: 0.3 },
        take_profit: { type: "rr", ratio: 1.5 },
      },
      filters: [{ type: "session", sessions: ["london"] }],
      commission_pct: 0.07,
    },
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BacktestingPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<Tab>("describe");

  // Form state
  const [symbol, setSymbol] = useState("XAUUSD");
  const [timeframe, setTimeframe] = useState("15m");
  const [dateFrom, setDateFrom] = useState("2024-01-01");
  const [dateTo, setDateTo] = useState("2024-12-31");
  const [emaFast, setEmaFast] = useState(20);
  const [emaSlow, setEmaSlow] = useState(50);
  const [rsiThreshold, setRsiThreshold] = useState(50);
  const [slPct, setSlPct] = useState(0.5);
  const [rrRatio, setRrRatio] = useState(2.0);

  // AI parser state
  const [promptText, setPromptText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  // Saved strategies
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  // Save strategy
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Chart marker filter
  const [markerDay, setMarkerDay] = useState("all");
  const [selectedTradeIdx, setSelectedTradeIdx] = useState<number | null>(null);

  // Job state
  const [status, setStatus] = useState<JobStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<BacktestResults | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApi = useRef<IChartApi | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // -----------------------------------------------------------------------
  // Fill form from DSL
  // -----------------------------------------------------------------------

  const fillFormFromDSL = useCallback((d: ParsedDSL) => {
    if (d.market) setSymbol(d.market);
    if (d.timeframe) setTimeframe(d.timeframe);
    if (d.date_range?.from) setDateFrom(d.date_range.from);
    if (d.date_range?.to) setDateTo(d.date_range.to);

    if (d.entry?.conditions) {
      for (const c of d.entry.conditions) {
        if (c.type === "ema_cross") {
          if (typeof c.fast === "number") setEmaFast(c.fast);
          if (typeof c.slow === "number") setEmaSlow(c.slow);
        }
        if (c.type === "rsi_above" || c.type === "rsi_below") {
          if (typeof c.value === "number") setRsiThreshold(c.value);
        }
      }
    }

    if (d.exit?.stop_loss?.value != null) setSlPct(d.exit.stop_loss.value);
    if (d.exit?.take_profit?.ratio != null) setRrRatio(d.exit.take_profit.ratio);

    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  // Check for prefilled DSL from strategy library
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("tf:backtest-prefill");
      if (!raw) return;
      sessionStorage.removeItem("tf:backtest-prefill");
      const dsl = JSON.parse(raw) as ParsedDSL;
      fillFormFromDSL(dsl);
    } catch {
      // ignore
    }
  }, [fillFormFromDSL]);

  // Check for AI parse request from strategy library
  useEffect(() => {
    const text = sessionStorage.getItem("tf:backtest-ai-parse");
    if (!text) return;
    sessionStorage.removeItem("tf:backtest-ai-parse");

    setActiveTab("describe");
    setPromptText(text);
    setParsing(true);
    setParseError("");
    setParseResult(null);

    fetch("/api/backtest/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error === true && data.message) {
          setParseError("This strategy cannot yet be converted into a backtestable rule set.");
        } else if (data.dsl) {
          setParseResult(data as ParseResult);
        } else {
          setParseError("This strategy cannot yet be converted into a backtestable rule set.");
        }
      })
      .catch(() => {
        setParseError("This strategy cannot yet be converted into a backtestable rule set.");
      })
      .finally(() => setParsing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // Fetch saved strategies
  // -----------------------------------------------------------------------

  const fetchSaved = useCallback(async () => {
    setSavedLoading(true);
    try {
      const res = await fetch("/api/backtest/strategies");
      if (res.ok) {
        const data = await res.json();
        setSavedStrategies(data);
      }
    } catch {
      // silent
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "saved") fetchSaved();
  }, [activeTab, fetchSaved]);

  // -----------------------------------------------------------------------
  // AI Parse
  // -----------------------------------------------------------------------

  const handleParse = useCallback(async () => {
    if (!promptText.trim()) return;
    setParsing(true);
    setParseError("");
    setParseResult(null);

    try {
      const res = await fetch("/api/backtest/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: promptText }),
      });

      const data = await res.json();

      if (data.error === true && data.message) {
        setParseError(data.message);
        return;
      }

      if (!res.ok) {
        setParseError(data.error ?? "Parse failed");
        return;
      }

      setParseResult(data as ParseResult);
    } catch {
      setParseError("Failed to reach parser");
    } finally {
      setParsing(false);
    }
  }, [promptText]);

  // -----------------------------------------------------------------------
  // Confirm parsed DSL
  // -----------------------------------------------------------------------

  const handleConfirm = useCallback(() => {
    if (!parseResult?.dsl) return;
    fillFormFromDSL(parseResult.dsl);
    setParseResult(null);
  }, [parseResult, fillFormFromDSL]);

  // -----------------------------------------------------------------------
  // Save strategy
  // -----------------------------------------------------------------------

  const handleSaveStrategy = useCallback(async () => {
    setSaving(true);
    setSaveSuccess(false);

    const dsl = {
      market: symbol,
      timeframe,
      entry: {
        direction: "long",
        conditions: [
          { type: "ema_cross", fast: emaFast, slow: emaSlow },
          { type: "rsi_above", period: 14, value: rsiThreshold },
        ],
      },
      exit: {
        stop_loss: { type: "fixed_pct", value: slPct },
        take_profit: { type: "rr", ratio: rrRatio },
      },
      filters: [],
      commission_pct: 0.07,
    };

    try {
      const res = await fetch("/api/backtest/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dsl, saveOnly: true }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        fetchSaved();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, [symbol, timeframe, emaFast, emaSlow, rsiThreshold, slPct, rrRatio, fetchSaved]);

  // -----------------------------------------------------------------------
  // Submit backtest
  // -----------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    setStatus("pending");
    setErrorMsg("");
    setResults(null);
    setMarkerDay("all");
    setSelectedTradeIdx(null);

    const dsl = {
      market: symbol,
      timeframe,
      date_range: { from: dateFrom, to: dateTo },
      entry: {
        direction: "long" as const,
        conditions: [
          { type: "ema_cross", fast: emaFast, slow: emaSlow },
          { type: "rsi_above", period: 14, value: rsiThreshold },
        ],
      },
      exit: {
        stop_loss: { type: "fixed_pct", value: slPct },
        take_profit: { type: "rr", ratio: rrRatio },
      },
      filters: [],
      commission_pct: 0.07,
    };

    try {
      const createRes = await fetch("/api/backtest/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dsl }),
      });
      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error ?? "Failed to create job");
      }
      const { job_id } = await createRes.json();

      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/backtest/status/${job_id}`);
          if (!statusRes.ok) return;
          const statusData = await statusRes.json();
          setStatus(statusData.status);

          if (statusData.status === "completed") {
            if (pollRef.current) clearInterval(pollRef.current);
            const resultsRes = await fetch(`/api/backtest/results/${job_id}`);
            if (resultsRes.ok) {
              const r = await resultsRes.json();
              setResults(r);
            }
          } else if (statusData.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            setErrorMsg(statusData.error_message ?? "Unknown error");
          }
        } catch {
          // keep polling
        }
      }, 2000);
    } catch (err) {
      setStatus("failed");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }, [symbol, timeframe, dateFrom, dateTo, emaFast, emaSlow, rsiThreshold, slPct, rrRatio]);

  // -----------------------------------------------------------------------
  // Equity Chart
  // -----------------------------------------------------------------------

  // Detect legacy equity curve format
  const isLegacyEquity = results
    && Array.isArray(results.equity_curve)
    && results.equity_curve.length > 0
    && typeof results.equity_curve[0] === "number";

  useEffect(() => {
    if (!results || !chartRef.current || isLegacyEquity) return;

    const raw = results.equity_curve;
    if (!raw || !Array.isArray(raw) || raw.length === 0) return;

    // Parse any timestamp as UTC seconds — normalize to ISO 8601 with Z
    function toUtcSeconds(ts: string): number {
      // Replace space separator with T for ISO compliance
      let s = ts.replace(" ", "T");
      // Append Z if no timezone suffix present
      if (!s.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(s)) {
        s += "Z";
      }
      return Math.floor(Date.parse(s) / 1000);
    }

    const normalized = (raw as EquityPoint[])
      .map((pt) => {
        if (!pt?.ts) return null;
        const time = toUtcSeconds(pt.ts);
        if (isNaN(time)) return null;
        return { time, value: pt.equity };
      })
      .filter((p): p is { time: number; value: number } => p !== null)
      .sort((a, b) => a.time - b.time);

    if (normalized.length === 0) return;

    // Downsample large equity curves to keep the chart responsive
    const maxPoints = 500;
    let sampled: { time: number; value: number }[];
    if (normalized.length <= maxPoints) {
      sampled = normalized;
    } else {
      sampled = [normalized[0]];
      const step = (normalized.length - 1) / (maxPoints - 1);
      for (let j = 1; j < maxPoints - 1; j++) {
        sampled.push(normalized[Math.round(j * step)]);
      }
      sampled.push(normalized[normalized.length - 1]);
    }

    if (chartApi.current) {
      chartApi.current.remove();
      chartApi.current = null;
    }

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 300,
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(255,255,255,0.5)",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number) => {
          const d = new Date(time * 1000);
          const day = d.getUTCDate();
          const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
          const hh = String(d.getUTCHours()).padStart(2, "0");
          const mm = String(d.getUTCMinutes()).padStart(2, "0");
          return `${day} ${mon} ${hh}:${mm}`;
        },
      },
    });

    const series = chart.addSeries(LineSeries, {
      color: "#0EA5E9",
      lineWidth: 2,
    });

    series.setData(sampled as { time: import("lightweight-charts").Time; value: number }[]);

    // Trade markers — strict 1:1 from trades array
    if (results.trades.length > 0) {
      type Marker = { time: import("lightweight-charts").Time; position: "belowBar" | "aboveBar"; color: string; shape: "arrowUp" | "circle"; text: string };

      function utcHHmm(utcSec: number): string {
        const d = new Date(utcSec * 1000);
        return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
      }

      function utcDate(utcSec: number): string {
        return new Date(utcSec * 1000).toISOString().slice(0, 10);
      }

      // Filter trades based on selected day or selected trade row
      const visibleTrades = results.trades.filter((t, i) => {
        if (selectedTradeIdx !== null) return i === selectedTradeIdx;
        if (markerDay === "all") return true;
        const entryDay = utcDate(toUtcSeconds(t.entry_ts));
        const exitDay = utcDate(toUtcSeconds(t.exit_ts));
        return entryDay === markerDay || exitDay === markerDay;
      });

      const markers: Marker[] = [];

      for (const t of visibleTrades) {
        const entryUtc = toUtcSeconds(t.entry_ts);
        const exitUtc = toUtcSeconds(t.exit_ts);

        if (!isNaN(entryUtc)) {
          markers.push({
            time: entryUtc as unknown as import("lightweight-charts").Time,
            position: "belowBar",
            color: "#3b82f6",
            shape: "arrowUp",
            text: `Entry ${utcHHmm(entryUtc)}`,
          });
        }

        if (!isNaN(exitUtc)) {
          const label = t.pnl > 0 ? "WIN" : "LOSS";
          markers.push({
            time: exitUtc as unknown as import("lightweight-charts").Time,
            position: "aboveBar",
            color: t.pnl > 0 ? "#22c55e" : "#ef4444",
            shape: "circle",
            text: `${label} ${utcHHmm(exitUtc)}`,
          });
        }
      }

      // Apply time jitter to separate markers at the same timestamp
      markers.sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));
      for (let i = 1; i < markers.length; i++) {
        const prev = markers[i - 1].time as unknown as number;
        const curr = markers[i].time as unknown as number;
        if (curr <= prev) {
          (markers[i] as { time: unknown }).time = (prev + 1) as unknown as import("lightweight-charts").Time;
        }
      }

      if (markers.length > 0) {
        createSeriesMarkers(series, markers);
      }
    }

    chart.timeScale().fitContent();
    chartApi.current = chart;

    const onResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartApi.current = null;
    };
  }, [results, isLegacyEquity, markerDay, selectedTradeIdx]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const isRunning = status === "pending" || status === "running";
  const isBusy = isRunning || parsing;
  const tabs: { key: Tab; label: string }[] = [
    { key: "templates", label: "Templates" },
    { key: "saved", label: "Recent" },
    { key: "describe", label: "Describe" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gradient">Backtesting</h1>
        <p className="text-sm text-muted-foreground">Test strategies against historical data</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-white/[0.03] p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === t.key
                ? "bg-white/[0.08] text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.name}
              disabled={isBusy}
              onClick={() => {
                if (isBusy) return;
                fillFormFromDSL(tmpl.dsl);
                setActiveTab("describe");
              }}
              className={`text-left glass rounded-xl p-4 border border-white/[0.06] transition-all duration-200 group ${isBusy ? "opacity-40 cursor-not-allowed" : "hover:border-[#0EA5E9]/30"}`}
            >
              <p className="font-semibold text-sm group-hover:text-[#0EA5E9] transition-colors">{tmpl.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{tmpl.dsl.market} {tmpl.dsl.timeframe}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tmpl.summary}</p>
            </button>
          ))}
        </div>
      )}

      {/* Saved Tab */}
      {activeTab === "saved" && (
        <div>
          {savedLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!savedLoading && savedStrategies.length === 0 && (
            <p className="text-sm text-muted-foreground">No recent strategies yet. Run a backtest to see them here.</p>
          )}
          {!savedLoading && savedStrategies.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {savedStrategies.map((s) => (
                <button
                  key={s.id}
                  disabled={isBusy}
                  onClick={() => {
                    if (isBusy) return;
                    fillFormFromDSL(s.dsl);
                    setActiveTab("describe");
                  }}
                  className={`text-left glass rounded-xl p-4 border border-white/[0.06] transition-all duration-200 group ${isBusy ? "opacity-40 cursor-not-allowed" : "hover:border-[#0EA5E9]/30"}`}
                >
                  <p className="font-semibold text-sm group-hover:text-[#0EA5E9] transition-colors">{s.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {s.dsl.market} {s.dsl.timeframe}
                    {s.dsl.entry?.conditions && ` - ${s.dsl.entry.conditions.map(formatCondition).join(", ")}`}
                  </p>
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Describe Tab (AI Parser) */}
      {activeTab === "describe" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Describe your strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/30 transition-all duration-200 resize-y min-h-[80px] disabled:opacity-40 disabled:cursor-not-allowed"
              rows={3}
              placeholder="e.g. EMA 20/50 cross on gold 15m, RSI above 50, SL 0.5%, RR 1:2, London session only"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              disabled={isBusy}
            />
            <div className="mt-3">
              <Button onClick={handleParse} loading={parsing} disabled={isBusy || !promptText.trim()} variant="secondary">
                {parsing ? "Parsing..." : "Parse with AI"}
              </Button>
            </div>
            {parseError && (
              <p className="mt-3 text-sm text-destructive">{parseError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmation Panel */}
      {parseResult && (
        <Card className="border border-[#0EA5E9]/20">
          <CardHeader>
            <CardTitle className="text-sm text-gradient">Parsed Strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <ConfirmField label="Market" value={parseResult.dsl.market} />
              <ConfirmField label="Timeframe" value={parseResult.dsl.timeframe} />
              <ConfirmField label="Direction" value={parseResult.dsl.entry?.direction} />
              <ConfirmField
                label="Entry Conditions"
                value={parseResult.dsl.entry?.conditions?.map(formatCondition).join(", ")}
              />
              <ConfirmField
                label="Stop Loss"
                value={parseResult.dsl.exit?.stop_loss ? `${parseResult.dsl.exit.stop_loss.value}%` : undefined}
              />
              <ConfirmField
                label="Take Profit"
                value={parseResult.dsl.exit?.take_profit ? `RR ${parseResult.dsl.exit.take_profit.ratio}` : undefined}
              />
              <ConfirmField
                label="Sessions"
                value={
                  parseResult.dsl.filters
                    ?.filter((f) => f.type === "session")
                    .flatMap((f) => f.sessions ?? [])
                    .join(", ") || undefined
                }
              />
              <ConfirmField
                label="Commission"
                value={parseResult.dsl.commission_pct != null ? `${parseResult.dsl.commission_pct}%` : undefined}
              />
            </div>

            {parseResult.assumptions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Assumptions</p>
                <ul className="space-y-1">
                  {parseResult.assumptions.map((a, i) => (
                    <li key={i} className="text-xs text-muted-foreground">- {a}</li>
                  ))}
                </ul>
              </div>
            )}

            {parseResult.warnings.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-400 mb-1">Warnings</p>
                <ul className="space-y-1">
                  {parseResult.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-400/80">- {w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button onClick={handleConfirm} disabled={isRunning}>Confirm &amp; Fill Form</Button>
              <Button variant="ghost" onClick={() => setParseResult(null)} disabled={isRunning}>Edit manually</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Form */}
      <div ref={formRef}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Strategy Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <fieldset disabled={isRunning}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Symbol">
                <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} />
              </Field>
              <Field label="Timeframe">
                <Select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                  <option value="1m">1m</option>
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                  <option value="4h">4h</option>
                </Select>
              </Field>
              <Field label="Date From">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </Field>
              <Field label="Date To">
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </Field>
              <Field label="EMA Fast">
                <Input type="number" value={emaFast} onChange={(e) => setEmaFast(+e.target.value)} />
              </Field>
              <Field label="EMA Slow">
                <Input type="number" value={emaSlow} onChange={(e) => setEmaSlow(+e.target.value)} />
              </Field>
              <Field label="RSI Threshold">
                <Input type="number" value={rsiThreshold} onChange={(e) => setRsiThreshold(+e.target.value)} />
              </Field>
              <Field label="Stop Loss %">
                <Input type="number" step="0.1" value={slPct} onChange={(e) => setSlPct(+e.target.value)} />
              </Field>
              <Field label="RR Ratio">
                <Input type="number" step="0.1" value={rrRatio} onChange={(e) => setRrRatio(+e.target.value)} />
              </Field>
            </div>
            </fieldset>

            <div className="mt-6">
              <Button onClick={handleSubmit} loading={isRunning} disabled={isRunning}>
                {isRunning ? "Running Backtest..." : "Run Backtest"}
              </Button>
            </div>

            {status === "failed" && errorMsg && (
              <p className="mt-4 text-sm text-destructive">{errorMsg}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {results && (
        <>
          {/* Metrics */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <MetricCard label="Total Trades" value={results.metrics.total_trades} />
            <MetricCard label="Win Rate" value={`${results.metrics.win_rate}%`} />
            <MetricCard label="Profit Factor" value={results.metrics.profit_factor.toFixed(2)} />
            <MetricCard label="Max Drawdown" value={`${(results.metrics.max_drawdown * 100).toFixed(2)}%`} />
            <MetricCard
              label="Net Profit"
              value={`$${results.metrics.net_profit.toFixed(2)}`}
              positive={results.metrics.net_profit >= 0}
            />
          </div>

          {/* Backtest Insights */}
          {results.trades.length > 0 && (() => {
            const ins = computeInsights(results.trades, results.metrics);
            if (!ins) return null;
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Backtest Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                    <MiniStat label="Avg Win" value={`$${ins.avgWin.toFixed(2)}`} positive />
                    <MiniStat label="Avg Loss" value={`$${ins.avgLoss.toFixed(2)}`} positive={false} />
                    <MiniStat label="Best Trade" value={`$${ins.bestTrade.pnl.toFixed(2)}`} positive />
                    <MiniStat label="Worst Trade" value={`$${ins.worstTrade.pnl.toFixed(2)}`} positive={false} />
                    <MiniStat label="Win Streak" value={`${ins.longestWin}`} />
                    <MiniStat label="Loss Streak" value={`${ins.longestLoss}`} />
                    <MiniStat label="Best Day" value={`$${ins.bestDay.pnl.toFixed(2)}`} sub={ins.bestDay.day} positive />
                    <MiniStat label="Worst Day" value={`$${ins.worstDay.pnl.toFixed(2)}`} sub={ins.worstDay.day} positive={false} />
                  </div>
                  <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] px-4 py-3 space-y-1">
                    {ins.bullets.map((b, i) => (
                      <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                        <span className="text-[#0EA5E9] mr-1.5">&#x2022;</span>{b}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Save Strategy + Equity Curve */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSaveStrategy} loading={saving} disabled={saving} variant="outline" size="sm">
              {saving ? "Saving..." : "Save Strategy"}
            </Button>
            {saveSuccess && <span className="text-xs text-emerald-400">Strategy saved!</span>}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Equity Curve</CardTitle>
              {!isLegacyEquity && results.trades.length > 0 && (
                <div className="flex items-center gap-2">
                  {selectedTradeIdx !== null && (
                    <button
                      onClick={() => setSelectedTradeIdx(null)}
                      className="text-[10px] text-muted-foreground hover:text-foreground underline"
                    >
                      Clear selection
                    </button>
                  )}
                  <select
                    value={selectedTradeIdx !== null ? "__trade__" : markerDay}
                    onChange={(e) => {
                      setSelectedTradeIdx(null);
                      setMarkerDay(e.target.value);
                    }}
                    className="h-7 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 text-[11px] text-foreground focus:outline-none focus:border-[#0EA5E9]/50"
                  >
                    <option value="all">All days</option>
                    {(() => {
                      const days = new Set<string>();
                      for (const t of results.trades) {
                        const s = t.entry_ts.replace(" ", "T");
                        const d = s.endsWith("Z") ? s : s + "Z";
                        const day = new Date(d).toISOString().slice(0, 10);
                        if (day !== "Invalid") days.add(day);
                      }
                      return Array.from(days).sort().map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ));
                    })()}
                  </select>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isLegacyEquity ? (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  This result uses an older equity format. Please rerun the backtest to view the chart.
                </p>
              ) : (
                <div ref={chartRef} />
              )}
            </CardContent>
          </Card>

          {/* Trades Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Trades ({results.trades.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Entry</th>
                    <th className="pb-2 pr-4">Exit</th>
                    <th className="pb-2 pr-4">Dir</th>
                    <th className="pb-2 pr-4 text-right">PnL</th>
                    <th className="pb-2 pr-4 text-right">RR</th>
                    <th className="pb-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.trades.map((t, i) => (
                    <tr
                      key={i}
                      onClick={() => setSelectedTradeIdx(selectedTradeIdx === i ? null : i)}
                      className={`border-b border-white/[0.03] cursor-pointer transition-colors ${selectedTradeIdx === i ? "bg-[#0EA5E9]/10" : "hover:bg-white/[0.02]"}`}
                    >
                      <td className="py-2 pr-4 text-muted-foreground">{formatTs(t.entry_ts)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatTs(t.exit_ts)}</td>
                      <td className="py-2 pr-4 uppercase">{t.direction}</td>
                      <td className={`py-2 pr-4 text-right font-mono ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono">{t.rr.toFixed(2)}</td>
                      <td className="py-2">
                        <Badge variant={t.result === "win" ? "success" : "destructive"}>
                          {t.result}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function MetricCard({ label, value, positive }: { label: string; value: string | number; positive?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${positive === true ? "text-emerald-400" : positive === false ? "text-red-400" : "text-foreground"}`}>
        {value}
      </p>
    </Card>
  );
}

function MiniStat({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${positive === true ? "text-emerald-400" : positive === false ? "text-red-400" : "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}

function ConfirmField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "-"}</p>
    </div>
  );
}

function computeInsights(trades: Trade[], metrics: Metrics) {
  if (trades.length === 0) return null;

  const wins = trades.filter((t) => t.result === "win");
  const losses = trades.filter((t) => t.result === "loss");

  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;

  const bestTrade = trades.reduce((best, t) => (t.pnl > best.pnl ? t : best), trades[0]);
  const worstTrade = trades.reduce((worst, t) => (t.pnl < worst.pnl ? t : worst), trades[0]);

  // Streaks
  let longestWin = 0, longestLoss = 0, curWin = 0, curLoss = 0;
  for (const t of trades) {
    if (t.result === "win") { curWin++; curLoss = 0; longestWin = Math.max(longestWin, curWin); }
    else { curLoss++; curWin = 0; longestLoss = Math.max(longestLoss, curLoss); }
  }

  // Daily PnL
  const dayPnl = new Map<string, number>();
  for (const t of trades) {
    const day = t.exit_ts.replace(" ", "T").slice(0, 10);
    dayPnl.set(day, (dayPnl.get(day) ?? 0) + t.pnl);
  }
  let bestDay = { day: "", pnl: -Infinity };
  let worstDay = { day: "", pnl: Infinity };
  for (const [day, pnl] of dayPnl) {
    if (pnl > bestDay.pnl) bestDay = { day, pnl };
    if (pnl < worstDay.pnl) worstDay = { day, pnl };
  }

  // Actionable coaching insights (max 4)
  const avgRR = wins.length > 0 ? wins.reduce((s, t) => s + t.rr, 0) / wins.length : 0;
  const bullets: string[] = [];

  // Edge quality
  if (metrics.profit_factor < 1.05) {
    bullets.push(`Profit factor is only ${metrics.profit_factor.toFixed(2)}, meaning the strategy barely breaks even after costs. You need either higher RR or better entry filtering.`);
  } else if (metrics.profit_factor >= 2.0) {
    bullets.push(`Profit factor of ${metrics.profit_factor.toFixed(2)} is strong — winners carry the strategy. Focus on preserving this edge by not widening stops.`);
  }

  // Win rate vs RR
  if (metrics.win_rate < 35) {
    if (avgRR >= 2.5) {
      bullets.push(`Win rate is ${metrics.win_rate}% with avg RR ${avgRR.toFixed(1)}. This is a valid low-frequency, high-reward model — but requires iron discipline through loss streaks.`);
    } else {
      bullets.push(`Win rate is ${metrics.win_rate}% with avg RR ${avgRR.toFixed(1)}. This combination is fragile — either improve entry accuracy or increase your reward target.`);
    }
  }

  // Drawdown
  if (metrics.max_drawdown > 0.1) {
    bullets.push(`Max drawdown hit ${(metrics.max_drawdown * 100).toFixed(1)}%. At 1% risk per trade, this would feel like a ${Math.round(metrics.max_drawdown * 100)}% account loss. Consider tighter position sizing or adding a daily loss limit.`);
  } else if (metrics.max_drawdown > 0.05) {
    bullets.push(`Max drawdown of ${(metrics.max_drawdown * 100).toFixed(1)}% is moderate. Manageable with proper sizing, but watch for clustering losses.`);
  }

  // Loss streaks
  if (longestLoss >= 8) {
    bullets.push(`Longest loss streak is ${longestLoss} trades. Most traders abandon strategies after 5-6 losses. If you can't stomach this, reduce risk per trade or add a cooldown rule.`);
  } else if (longestLoss >= 5) {
    bullets.push(`Longest loss streak is ${longestLoss} trades — mentally demanding. Consider halving size after 3 consecutive losses as a circuit breaker.`);
  }

  if (bullets.length === 0) {
    if (metrics.win_rate >= 50 && metrics.profit_factor >= 1.3) {
      bullets.push(`Win rate ${metrics.win_rate}% with profit factor ${metrics.profit_factor.toFixed(2)} — this is a tradeable edge. Stay consistent with execution.`);
    } else {
      bullets.push("Metrics are within normal range. Run a longer backtest period to validate consistency.");
    }
  }

  // Cap at 4
  bullets.length = Math.min(bullets.length, 4);

  return { avgWin, avgLoss, bestTrade, worstTrade, longestWin, longestLoss, bestDay, worstDay, bullets };
}

function formatCondition(c: Record<string, unknown>): string {
  if (c.type === "ema_cross") return `EMA ${c.fast}/${c.slow}`;
  if (c.type === "rsi_above") return `RSI > ${c.value}`;
  if (c.type === "rsi_below") return `RSI < ${c.value}`;
  return String(c.type);
}

function formatTs(ts: string): string {
  if (!ts) return "-";
  return ts.replace("T", " ").slice(0, 16);
}
