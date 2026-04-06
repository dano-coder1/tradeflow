"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createChart, createSeriesMarkers, CandlestickSeries, LineSeries, type IChartApi } from "lightweight-charts";

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

interface StrategyVersion {
  id: string;
  strategy_id: string;
  version_number: number;
  name: string;
  dsl: ParsedDSL;
  change_summary: StrategyChange[] | null;
  source_type: string;
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

  // Strategy improvement & comparison
  const [improved, setImproved] = useState<ImprovedStrategy | null>(null);
  const [comparison, setComparison] = useState<ComparisonState | null>(null);
  const compPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Price chart candles (from Twelve Data: time is unix seconds)
  const [candles, setCandles] = useState<{ time: number; open: number; high: number; low: number; close: number }[]>([]);
  const priceChartRef = useRef<HTMLDivElement | null>(null);
  const priceChartApi = useRef<IChartApi | null>(null);

  // Version history
  const [activeStrategyId, setActiveStrategyId] = useState<string | null>(null);
  const [versions, setVersions] = useState<StrategyVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<number>(1);

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
      if (compPollRef.current) clearInterval(compPollRef.current);
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
  // Run comparison backtest (improved DSL)
  // -----------------------------------------------------------------------

  const runComparisonBacktest = useCallback(async (comp: ComparisonState) => {
    const dsl = {
      ...comp.improvedDSL,
      date_range: { from: dateFrom, to: dateTo },
    };

    setComparison((prev) => prev ? { ...prev, improvedStatus: "running", improvedError: "" } : prev);

    try {
      const createRes = await fetch("/api/backtest/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dsl }),
      });
      if (!createRes.ok) {
        setComparison((prev) => prev ? { ...prev, improvedStatus: "failed", improvedError: "Failed to create job" } : prev);
        return;
      }
      const { job_id } = await createRes.json();

      compPollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/backtest/status/${job_id}`);
          if (!statusRes.ok) return;
          const statusData = await statusRes.json();

          if (statusData.status === "completed") {
            if (compPollRef.current) clearInterval(compPollRef.current);
            const resultsRes = await fetch(`/api/backtest/results/${job_id}`);
            if (resultsRes.ok) {
              const r = await resultsRes.json();
              setComparison((prev) => prev ? { ...prev, improvedResult: r, improvedStatus: "completed" } : prev);
            }
          } else if (statusData.status === "failed") {
            if (compPollRef.current) clearInterval(compPollRef.current);
            setComparison((prev) => prev ? { ...prev, improvedStatus: "failed", improvedError: statusData.error_message ?? "Backtest failed" } : prev);
          }
        } catch {
          // keep polling
        }
      }, 2000);
    } catch {
      setComparison((prev) => prev ? { ...prev, improvedStatus: "failed", improvedError: "Network error" } : prev);
    }
  }, [dateFrom, dateTo]);

  // -----------------------------------------------------------------------
  // Version history
  // -----------------------------------------------------------------------

  const fetchVersions = useCallback(async (stratId: string) => {
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/backtest/versions?strategy_id=${stratId}`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
        if (data.length > 0) {
          setCurrentVersion(data[data.length - 1].version_number);
        }
      }
    } catch {
      // silent
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  const acceptAsNewVersion = useCallback(async (
    improvedDSL: ParsedDSL,
    changes: StrategyChange[],
  ) => {
    // If no active strategy, create one first
    let stratId = activeStrategyId;
    if (!stratId) {
      const origDSL = {
        market: symbol, timeframe,
        entry: { direction: "long", conditions: [{ type: "ema_cross", fast: emaFast, slow: emaSlow }, { type: "rsi_above", period: 14, value: rsiThreshold }] },
        exit: { stop_loss: { type: "fixed_pct", value: slPct }, take_profit: { type: "rr", ratio: rrRatio } },
        filters: [], commission_pct: 0.07,
      };
      // Save original as strategy + v1
      const createRes = await fetch("/api/backtest/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dsl: origDSL, saveOnly: true }),
      });
      if (!createRes.ok) return;
      const { strategy_id } = await createRes.json();
      stratId = strategy_id;
      setActiveStrategyId(stratId);

      // Save v1
      await fetch("/api/backtest/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy_id: stratId,
          dsl: origDSL,
          name: "v1 Original",
          source_type: "original",
          change_summary: [],
        }),
      });
    }

    // Save improved as next version
    const nextV = currentVersion + 1;
    const changeLabel = changes.map((c) => c.field).join(", ");
    const res = await fetch("/api/backtest/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strategy_id: stratId,
        dsl: improvedDSL,
        name: `v${nextV} ${changeLabel}`,
        source_type: "improved",
        change_summary: changes,
      }),
    });

    if (res.ok) {
      setCurrentVersion(nextV);
      fillFormFromDSL(improvedDSL);
      setImproved(null);
      setComparison(null);
      if (stratId) fetchVersions(stratId);
      setShowHistory(true);
    }
  }, [activeStrategyId, currentVersion, symbol, timeframe, emaFast, emaSlow, rsiThreshold, slPct, rrRatio, fillFormFromDSL, fetchVersions]);

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
    setImproved(null);
    setComparison(null);

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
              // Fetch candles for price chart
              fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`)
                .then((cr) => cr.ok ? cr.json() : null)
                .then((data) => { if (data?.candles) setCandles(data.candles); })
                .catch(() => {});
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
  // Price (Candlestick) Chart
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!results || !priceChartRef.current || candles.length === 0) return;

    if (priceChartApi.current) {
      priceChartApi.current.remove();
      priceChartApi.current = null;
    }

    // Trade timestamp parser (handles both ISO and space-separated)
    function tradeToUtc(ts: string): number {
      let s = ts.replace(" ", "T");
      if (!s.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(s)) s += "Z";
      return Math.floor(Date.parse(s) / 1000);
    }

    const chart = createChart(priceChartRef.current, {
      width: priceChartRef.current.clientWidth,
      height: 400,
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
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e80",
      wickDownColor: "#ef444480",
    });

    // Candles already have time as unix seconds from /api/candles
    const sorted = [...candles].sort((a, b) => a.time - b.time);
    series.setData(sorted as { time: import("lightweight-charts").Time; open: number; high: number; low: number; close: number }[]);

    // Trade markers
    const visibleTrades = selectedTradeIdx !== null
      ? [results.trades[selectedTradeIdx]]
      : results.trades;

    type PriceMarker = { time: import("lightweight-charts").Time; position: "belowBar" | "aboveBar"; color: string; shape: "arrowUp" | "arrowDown" | "circle"; text: string };
    const markers: PriceMarker[] = [];

    // Build set of candle times for snapping trade markers to nearest candle
    const candleTimes = sorted.map((c) => c.time);
    function snapToCandle(target: number): number {
      let lo = 0, hi = candleTimes.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (candleTimes[mid] < target) lo = mid + 1;
        else hi = mid;
      }
      if (lo > 0 && Math.abs(candleTimes[lo - 1] - target) < Math.abs(candleTimes[lo] - target)) {
        return candleTimes[lo - 1];
      }
      return candleTimes[lo];
    }

    for (const t of visibleTrades) {
      const entryUtc = tradeToUtc(t.entry_ts);
      const exitUtc = tradeToUtc(t.exit_ts);
      const isWin = t.pnl > 0;

      if (!isNaN(entryUtc)) {
        markers.push({
          time: snapToCandle(entryUtc) as unknown as import("lightweight-charts").Time,
          position: t.direction === "long" ? "belowBar" : "aboveBar",
          color: isWin ? "#22c55e" : "#ef4444",
          shape: t.direction === "long" ? "arrowUp" : "arrowDown",
          text: `Entry $${t.entry_price.toFixed(2)}`,
        });
      }
      if (!isNaN(exitUtc)) {
        markers.push({
          time: snapToCandle(exitUtc) as unknown as import("lightweight-charts").Time,
          position: t.direction === "long" ? "aboveBar" : "belowBar",
          color: isWin ? "#22c55e" : "#ef4444",
          shape: "circle",
          text: `${isWin ? "WIN" : "LOSS"} $${t.exit_price.toFixed(2)}`,
        });
      }
    }

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

    // Fit to selected trade or show all
    if (selectedTradeIdx !== null) {
      const t = results.trades[selectedTradeIdx];
      const from = tradeToUtc(t.entry_ts) - 7200;
      const to = tradeToUtc(t.exit_ts) + 7200;
      chart.timeScale().setVisibleRange({
        from: from as unknown as import("lightweight-charts").Time,
        to: to as unknown as import("lightweight-charts").Time,
      });
    } else {
      chart.timeScale().fitContent();
    }

    priceChartApi.current = chart;

    const onResize = () => {
      if (priceChartRef.current) chart.applyOptions({ width: priceChartRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      priceChartApi.current = null;
    };
  }, [results, candles, selectedTradeIdx]);

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
              <div className="space-y-3">
                {/* ── ZONE A: STATUS ── */}
                <div className={`glass rounded-xl p-4 border ${ins.verdict.border}`}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${ins.verdict.color} ${ins.verdict.bg}`}>
                      {ins.verdict.icon} {ins.verdict.label}
                    </span>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>PF <span className="text-foreground font-semibold">{results.metrics.profit_factor.toFixed(2)}</span></span>
                      <span className="text-white/[0.06]">|</span>
                      <span className={`font-semibold ${ins.expectancy >= 0 ? "text-emerald-400" : "text-red-400"}`}>${ins.expectancy.toFixed(2)}</span>
                      <span className="text-muted-foreground/50">/ trade</span>
                      <span className="text-white/[0.06]">|</span>
                      <span className="text-muted-foreground/40">~${ins.expectancyPer100.toFixed(0)} per 100</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">{ins.verdict.subtext}</p>
                </div>

                {/* ── ZONE B: METRICS GRID ── */}
                <div className="grid gap-2.5 grid-cols-2 md:grid-cols-4">
                  <MiniStat label="Avg Win" value={`$${ins.avgWin.toFixed(2)}`} positive />
                  <MiniStat label="Avg Loss" value={`$${ins.avgLoss.toFixed(2)}`} positive={false} />
                  <MiniStat label="Best Trade" value={`$${ins.bestTrade.pnl.toFixed(2)}`} positive />
                  <MiniStat label="Worst Trade" value={`$${ins.worstTrade.pnl.toFixed(2)}`} positive={false} />
                  <MiniStat label="Win Streak" value={`${ins.longestWin}`} />
                  <MiniStat label="Loss Streak" value={`${ins.longestLoss}`} />
                  <MiniStat label="Best Day" value={`$${ins.bestDay.pnl.toFixed(2)}`} sub={ins.bestDay.day} positive />
                  <MiniStat label="Worst Day" value={`$${ins.worstDay.pnl.toFixed(2)}`} sub={ins.worstDay.day} positive={false} />
                </div>

                {/* ── ZONE C: TRADING COACH ── */}
                <div className="rounded-xl border border-[#8B5CF6]/15 bg-gradient-to-b from-[#8B5CF6]/[0.04] to-transparent p-[1px]">
                  <div className="rounded-[11px] bg-[#0a0a0a] space-y-0 overflow-hidden">

                    {/* 1. MAIN PROBLEM — red */}
                    <div className="bg-red-950/40 border-b border-red-500/20 px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-red-400 text-lg leading-none">&#x26A0;</span>
                        <p className="text-sm font-extrabold text-red-400 uppercase tracking-wider">
                          Main problem: {ins.mainProblem.label}
                        </p>
                      </div>
                      <p className="text-xs text-red-200/50 mt-1.5 leading-relaxed">{ins.mainProblem.detail}</p>
                      {ins.qualityScore < 50 && (
                        <p className="text-xs text-red-400/80 font-bold mt-2">You will lose money trading this live.</p>
                      )}
                    </div>

                    {/* 2. Score + Header — dark neutral */}
                    <div className="px-5 py-4 flex items-start justify-between border-b border-white/[0.04] bg-[#111]/60">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#8B5CF6] text-sm">&#x2728;</span>
                          <h3 className="text-sm font-bold text-foreground">Trading Coach</h3>
                        </div>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">Based on your backtest results</p>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className={`relative w-[4.5rem] h-[4.5rem] rounded-full flex items-center justify-center border-[3px] ${ins.qualityScore >= 75 ? "border-emerald-400/50 shadow-[0_0_30px_rgba(34,197,94,0.2)]" : ins.qualityScore >= 60 ? "border-[#0EA5E9]/50 shadow-[0_0_30px_rgba(14,165,233,0.2)]" : ins.qualityScore >= 40 ? "border-amber-400/50 shadow-[0_0_30px_rgba(245,158,11,0.2)]" : "border-red-400/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"} bg-white/[0.02]`}>
                          <span className={`text-3xl font-black leading-none ${ins.qualityScore >= 75 ? "text-emerald-400" : ins.qualityScore >= 60 ? "text-[#0EA5E9]" : ins.qualityScore >= 40 ? "text-amber-400" : "text-red-400"}`}>
                            {ins.qualityScore}
                          </span>
                        </div>
                        <p className={`text-[9px] font-bold uppercase tracking-wider mt-1.5 ${ins.qualityScore >= 75 ? "text-emerald-400/80" : ins.qualityScore >= 60 ? "text-[#0EA5E9]/80" : ins.qualityScore >= 40 ? "text-amber-400/80" : "text-red-400/80"}`}>
                          {ins.qualityLabel}
                        </p>
                        <p className="text-[9px] text-muted-foreground/50 mt-0.5">
                          {ins.tradeabilityIcon} {ins.tradeabilityText}
                        </p>
                      </div>
                    </div>

                    {/* 3. Coach voice — dark neutral */}
                    <div className="px-5 py-3.5 border-b border-white/[0.04] bg-[#0e0e0e]">
                      <div className="space-y-1.5 border-l-2 border-[#8B5CF6]/25 pl-3">
                        {ins.coachLines.map((line, i) => (
                          <p key={i} className="text-[11px] text-foreground/80 leading-relaxed">{line}</p>
                        ))}
                        <p className="text-[11px] text-red-400/70 font-semibold italic mt-0.5">{ins.realityCheck}</p>
                      </div>
                    </div>

                    {/* 4. Key insights — dark neutral */}
                    <div className="px-5 py-3.5 border-b border-white/[0.04] bg-[#0e0e0e] space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">Key Insights</p>
                      {ins.bullets.slice(0, 3).map((b, i) => (
                        <div key={i} className="flex gap-2.5 text-[11px] leading-relaxed">
                          <span className="text-[#0EA5E9] mt-0.5 shrink-0 text-[10px]">&#x25CF;</span>
                          <span className="text-muted-foreground"
                            dangerouslySetInnerHTML={{
                              __html: b.replace(/\*\*(.+?)\*\*/g, '<span class="text-foreground font-semibold">$1</span>'),
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* 5. What to fix first — amber */}
                    <div className="px-5 py-3.5 bg-amber-950/20 border-b border-amber-500/10">
                      <p className="text-[10px] font-bold text-amber-400/70 uppercase tracking-wider mb-1.5">What to fix first</p>
                      <div className="space-y-1.5">
                        {ins.fixes.slice(0, 3).map((fix, i) => (
                          <div key={i} className="flex gap-2 text-[11px] leading-relaxed">
                            <span className="text-amber-400/60 mt-0.5 shrink-0 font-bold text-[10px]">{i + 1}.</span>
                            <span className="text-muted-foreground">{fix}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 6. What to do next — blue */}
                    <div className="px-5 py-4 bg-[#0EA5E9]/[0.06]">
                      <p className="text-[10px] font-bold text-[#0EA5E9]/80 uppercase tracking-wider mb-1.5">&#x27A1; What to do next</p>
                      <p className="text-xs text-foreground/80 font-medium leading-relaxed">{ins.nextStep}</p>
                      <button
                        onClick={() => {
                          const currentDSL: ParsedDSL = {
                            market: symbol, timeframe,
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
                          const result = generateImprovedStrategy(currentDSL, results.metrics, results.trades);
                          setImproved(result);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#0EA5E9]/15 hover:bg-[#0EA5E9]/25 border border-[#0EA5E9]/20 px-4 py-2 text-xs font-semibold text-[#0EA5E9] transition-all duration-200"
                      >
                        Improve this strategy
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            );
          })()}

          {/* Suggested Improved Strategy + Comparison */}
          {improved && !comparison && (
            <Card className="border border-emerald-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-emerald-400">Suggested Improved Strategy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Changes diff */}
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] px-4 py-3 space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Changes</p>
                  {improved.changes.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="text-emerald-400 text-[10px]">&#x25B6;</span>
                      <span className="text-foreground font-semibold">{c.field}:</span>
                      <span className="text-red-400/70 line-through">{c.from}</span>
                      <span className="text-muted-foreground/40">&#x2192;</span>
                      <span className="text-emerald-400 font-semibold">{c.to}</span>
                    </div>
                  ))}
                </div>

                {/* Side-by-side summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-1">Original</p>
                    <p className="text-[11px] text-muted-foreground">{summarizeDSL({
                      market: symbol, timeframe,
                      entry: { direction: "long", conditions: [{ type: "ema_cross", fast: emaFast, slow: emaSlow }, { type: "rsi_above", period: 14, value: rsiThreshold }] },
                      exit: { stop_loss: { type: "fixed_pct", value: slPct }, take_profit: { type: "rr", ratio: rrRatio } },
                      filters: [],
                    })}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/[0.03] border border-emerald-500/10 p-3">
                    <p className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-wider mb-1">Improved</p>
                    <p className="text-[11px] text-muted-foreground">{summarizeDSL(improved.dsl)}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  <Button size="sm" variant="outline" onClick={() => { fillFormFromDSL(improved.dsl); setImproved(null); }}>
                    Use this strategy
                  </Button>
                  <Button size="sm" onClick={() => {
                    const origDSL: ParsedDSL = {
                      market: symbol, timeframe,
                      entry: { direction: "long", conditions: [{ type: "ema_cross", fast: emaFast, slow: emaSlow }, { type: "rsi_above", period: 14, value: rsiThreshold }] },
                      exit: { stop_loss: { type: "fixed_pct", value: slPct }, take_profit: { type: "rr", ratio: rrRatio } },
                      filters: [], commission_pct: 0.07,
                    };
                    const comp: ComparisonState = {
                      originalDSL: origDSL,
                      improvedDSL: improved.dsl,
                      changes: improved.changes,
                      originalResult: results!,
                      improvedResult: null,
                      improvedStatus: "idle",
                      improvedError: "",
                    };
                    setComparison(comp);
                    setImproved(null);
                    runComparisonBacktest(comp);
                  }}>
                    Compare strategies
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => acceptAsNewVersion(improved.dsl, improved.changes)}>
                    Accept as new version
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setImproved(null)}>Dismiss</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comparison Panel */}
          {comparison && (
            <Card className="border border-[#8B5CF6]/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Original vs Improved</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Changes */}
                <div className="flex flex-wrap gap-2">
                  {comparison.changes.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] px-2.5 py-0.5 text-[10px] text-muted-foreground">
                      <span className="font-semibold text-foreground">{c.field}:</span>
                      <span className="text-red-400/70 line-through">{c.from}</span>
                      <span>&#x2192;</span>
                      <span className="text-emerald-400 font-semibold">{c.to}</span>
                    </span>
                  ))}
                </div>

                {/* Side-by-side DSL */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider mb-1">Original</p>
                    <p className="text-[11px] text-muted-foreground">{summarizeDSL(comparison.originalDSL)}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/[0.03] border border-emerald-500/10 p-3">
                    <p className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-wider mb-1">Improved</p>
                    <p className="text-[11px] text-muted-foreground">{summarizeDSL(comparison.improvedDSL)}</p>
                  </div>
                </div>

                {/* Comparison metrics */}
                {comparison.improvedStatus === "running" && (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <div className="h-4 w-4 rounded-full border-2 border-[#0EA5E9] border-t-transparent animate-spin" />
                    <span className="text-xs text-muted-foreground">Running improved backtest...</span>
                  </div>
                )}
                {comparison.improvedStatus === "failed" && (
                  <p className="text-xs text-destructive">{comparison.improvedError}</p>
                )}
                {comparison.improvedResult && (() => {
                  const metrics = buildMetricComparisons(
                    comparison.originalResult.metrics,
                    comparison.improvedResult.metrics,
                    comparison.originalResult.trades,
                    comparison.improvedResult.trades,
                  );
                  const verdict = generateComparisonVerdict(metrics);
                  return (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="border-b border-white/[0.06] text-muted-foreground/60">
                              <th className="text-left pb-2 pr-4 font-medium">Metric</th>
                              <th className="text-right pb-2 pr-4 font-medium">Original</th>
                              <th className="text-right pb-2 pr-4 font-medium">Improved</th>
                              <th className="text-right pb-2 font-medium">Delta</th>
                            </tr>
                          </thead>
                          <tbody>
                            {metrics.map((m, i) => {
                              const isBetter = m.betterWhen === "higher" ? m.delta > 0.001 : m.delta < -0.001;
                              const isWorse = m.betterWhen === "higher" ? m.delta < -0.001 : m.delta > 0.001;
                              return (
                                <tr key={i} className="border-b border-white/[0.03]">
                                  <td className="py-1.5 pr-4 text-muted-foreground">{m.label}</td>
                                  <td className="py-1.5 pr-4 text-right font-mono text-foreground/70">{m.original}</td>
                                  <td className="py-1.5 pr-4 text-right font-mono text-foreground">{m.improved}</td>
                                  <td className={`py-1.5 text-right font-mono font-semibold ${isBetter ? "text-emerald-400" : isWorse ? "text-red-400" : "text-muted-foreground/50"}`}>
                                    {m.delta > 0 ? "+" : ""}{m.delta.toFixed(2)}
                                    {isBetter && " ↑"}
                                    {isWorse && " ↓"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Verdict */}
                      <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] px-4 py-2.5">
                        <p className="text-xs text-foreground/80">{verdict}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3">
                        <Button size="sm" onClick={() => { fillFormFromDSL(comparison.improvedDSL); setComparison(null); }}>
                          Use improved strategy
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => acceptAsNewVersion(comparison.improvedDSL, comparison.changes)}>
                          Accept as new version
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setComparison(null)}>
                          Dismiss
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}

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

          {/* Trade Replay Chart */}
          {candles.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Trade Replay</CardTitle>
                {selectedTradeIdx !== null && (
                  <button
                    onClick={() => setSelectedTradeIdx(null)}
                    className="text-[10px] text-muted-foreground hover:text-foreground underline"
                  >
                    Show all trades
                  </button>
                )}
              </CardHeader>
              <CardContent>
                <div ref={priceChartRef} />
              </CardContent>
            </Card>
          )}

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

          {/* Strategy History */}
          {versions.length > 0 && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Strategy History</CardTitle>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  {showHistory ? "Hide" : `Show (${versions.length} versions)`}
                </button>
              </CardHeader>
              {showHistory && (
                <CardContent className="space-y-2">
                  {/* Timeline */}
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50 mb-2">
                    {versions.map((v, i) => (
                      <span key={v.id} className="flex items-center gap-1">
                        <span className={`font-bold ${v.version_number === currentVersion ? "text-[#0EA5E9]" : "text-muted-foreground/60"}`}>
                          v{v.version_number}
                        </span>
                        {i < versions.length - 1 && <span className="text-white/[0.1]">&#x2192;</span>}
                      </span>
                    ))}
                  </div>

                  {/* Version cards */}
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className={`rounded-lg border p-3 transition-all duration-200 ${
                        v.version_number === currentVersion
                          ? "border-[#0EA5E9]/30 bg-[#0EA5E9]/[0.03]"
                          : "border-white/[0.04] bg-white/[0.02] hover:border-white/[0.08]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">{v.name}</span>
                            {v.version_number === currentVersion && (
                              <Badge variant="default">Current</Badge>
                            )}
                            {v.source_type === "original" && (
                              <Badge variant="secondary">Original</Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                            {new Date(v.created_at).toLocaleString()}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1">{summarizeDSL(v.dsl)}</p>
                          {v.change_summary && Array.isArray(v.change_summary) && v.change_summary.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {(v.change_summary as StrategyChange[]).map((c, ci) => (
                                <span key={ci} className="inline-flex items-center gap-1 rounded bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                  {c.field}: <span className="text-red-400/60 line-through">{c.from}</span> &#x2192; <span className="text-emerald-400/80">{c.to}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0 ml-3">
                          <button
                            onClick={() => {
                              fillFormFromDSL(v.dsl);
                              setCurrentVersion(v.version_number);
                            }}
                            className="rounded px-2 py-0.5 text-[10px] font-medium bg-white/[0.06] text-muted-foreground hover:text-foreground hover:bg-white/[0.1]"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => {
                              fillFormFromDSL(v.dsl);
                              setCurrentVersion(v.version_number);
                              setTimeout(() => handleSubmit(), 200);
                            }}
                            className="rounded px-2 py-0.5 text-[10px] font-medium bg-[#0EA5E9]/10 text-[#0EA5E9] hover:bg-[#0EA5E9]/20"
                          >
                            Backtest
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}
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
    <div className="group glass rounded-xl p-4 border border-white/[0.04] transition-all duration-200 hover:border-white/[0.1] hover:shadow-[0_0_16px_rgba(14,165,233,0.05)]">
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-base font-bold mt-1.5 ${positive === true ? "text-emerald-400" : positive === false ? "text-red-400" : "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground/40 mt-1">{sub}</p>}
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

interface ComparisonState {
  originalDSL: ParsedDSL;
  improvedDSL: ParsedDSL;
  changes: StrategyChange[];
  originalResult: BacktestResults;
  improvedResult: BacktestResults | null;
  improvedStatus: "idle" | "running" | "completed" | "failed";
  improvedError: string;
}

interface MetricComparison {
  label: string;
  original: string;
  improved: string;
  delta: number;
  betterWhen: "higher" | "lower";
}

interface StrategyChange {
  field: string;
  from: string;
  to: string;
  reason: string;
}

interface ImprovedStrategy {
  dsl: ParsedDSL;
  changes: StrategyChange[];
}

function generateImprovedStrategy(
  currentDSL: ParsedDSL,
  metrics: Metrics,
  trades: Trade[],
): ImprovedStrategy {
  // Deep clone DSL
  const dsl: ParsedDSL = JSON.parse(JSON.stringify(currentDSL));
  const changes: StrategyChange[] = [];

  const conditions = dsl.entry?.conditions ?? [];
  const rsiCond = conditions.find((c) => c.type === "rsi_above" || c.type === "rsi_below");
  const wins = trades.filter((t) => t.result === "win");
  const losses = trades.filter((t) => t.result === "loss");
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;

  // Track how many applied (max 2)
  let applied = 0;

  // A) Low win rate → tighten RSI filter
  if (applied < 2 && metrics.win_rate < 35 && rsiCond && typeof rsiCond.value === "number") {
    const oldVal = rsiCond.value as number;
    const newVal = rsiCond.type === "rsi_above" ? oldVal + 5 : oldVal - 5;
    changes.push({
      field: `RSI threshold`,
      from: `${oldVal}`,
      to: `${newVal}`,
      reason: `Win rate is ${metrics.win_rate}% — entry filter was made stricter.`,
    });
    rsiCond.value = newVal;
    applied++;
  }

  // B) Too many trades → add/restrict session filter
  if (applied < 2 && metrics.total_trades > 300) {
    const sessionFilter = dsl.filters?.find((f) => f.type === "session");
    if (!sessionFilter) {
      dsl.filters = [...(dsl.filters ?? []), { type: "session", sessions: ["london"] }];
      changes.push({
        field: "Session filter",
        from: "none",
        to: "London only",
        reason: `${metrics.total_trades} trades is too many — frequency was reduced with a session filter.`,
      });
    } else if (sessionFilter.sessions && sessionFilter.sessions.length > 1) {
      const oldSessions = sessionFilter.sessions.join(", ");
      sessionFilter.sessions = ["london"];
      changes.push({
        field: "Session filter",
        from: oldSessions,
        to: "London only",
        reason: `${metrics.total_trades} trades is too many — restricted to London session.`,
      });
    }
    applied++;
  }

  // C) Weak profit factor → increase RR
  if (applied < 2 && metrics.profit_factor < 1.05 && dsl.exit?.take_profit) {
    const oldRR = dsl.exit.take_profit.ratio;
    if (oldRR < 2.5) {
      const newRR = Math.round((oldRR + 0.5) * 10) / 10;
      changes.push({
        field: "RR ratio",
        from: `${oldRR}`,
        to: `${newRR}`,
        reason: `Profit factor is ${metrics.profit_factor.toFixed(2)} — reward/risk was increased.`,
      });
      dsl.exit.take_profit.ratio = newRR;
      applied++;
    }
  }

  // D) Long loss streaks → tighten SL
  let longestLoss = 0, curLoss = 0;
  for (const t of trades) {
    if (t.result === "loss") { curLoss++; longestLoss = Math.max(longestLoss, curLoss); }
    else { curLoss = 0; }
  }
  if (applied < 2 && longestLoss >= 8 && dsl.exit?.stop_loss) {
    const oldSL = dsl.exit.stop_loss.value;
    const newSL = Math.round(oldSL * 0.85 * 100) / 100;
    if (newSL >= 0.1) {
      changes.push({
        field: "Stop loss %",
        from: `${oldSL}%`,
        to: `${newSL}%`,
        reason: `Longest loss streak is ${longestLoss} — stop loss was tightened to reduce drawdown.`,
      });
      dsl.exit.stop_loss.value = newSL;
      applied++;
    }
  }

  // E) Avg loss too large vs avg win → reduce SL
  if (applied < 2 && avgLoss !== 0 && avgWin / Math.abs(avgLoss) < 1.2 && dsl.exit?.stop_loss) {
    const oldSL = dsl.exit.stop_loss.value;
    const newSL = Math.round(oldSL * 0.8 * 100) / 100;
    if (newSL >= 0.1) {
      changes.push({
        field: "Stop loss %",
        from: `${oldSL}%`,
        to: `${newSL}%`,
        reason: "Average loss is too close to average win — stop loss was tightened.",
      });
      dsl.exit.stop_loss.value = newSL;
      applied++;
    }
  }

  // Fallback if nothing changed
  if (changes.length === 0) {
    // Try bumping RR slightly
    if (dsl.exit?.take_profit) {
      const oldRR = dsl.exit.take_profit.ratio;
      const newRR = Math.round((oldRR + 0.5) * 10) / 10;
      changes.push({
        field: "RR ratio",
        from: `${oldRR}`,
        to: `${newRR}`,
        reason: "No critical flaw found — RR was increased slightly for better reward profile.",
      });
      dsl.exit.take_profit.ratio = newRR;
    }
  }

  return { dsl, changes };
}

function buildMetricComparisons(orig: Metrics, imp: Metrics, origTrades: Trade[], impTrades: Trade[]): MetricComparison[] {
  const origWins = origTrades.filter((t) => t.result === "win");
  const origLosses = origTrades.filter((t) => t.result === "loss");
  const impWins = impTrades.filter((t) => t.result === "win");
  const impLosses = impTrades.filter((t) => t.result === "loss");

  const origAvgWin = origWins.length > 0 ? origWins.reduce((s, t) => s + t.pnl, 0) / origWins.length : 0;
  const origAvgLoss = origLosses.length > 0 ? origLosses.reduce((s, t) => s + t.pnl, 0) / origLosses.length : 0;
  const impAvgWin = impWins.length > 0 ? impWins.reduce((s, t) => s + t.pnl, 0) / impWins.length : 0;
  const impAvgLoss = impLosses.length > 0 ? impLosses.reduce((s, t) => s + t.pnl, 0) / impLosses.length : 0;

  const origExp = (orig.win_rate / 100) * origAvgWin - (1 - orig.win_rate / 100) * Math.abs(origAvgLoss);
  const impExp = (imp.win_rate / 100) * impAvgWin - (1 - imp.win_rate / 100) * Math.abs(impAvgLoss);

  function streak(trades: Trade[], type: "win" | "loss") {
    let max = 0, cur = 0;
    for (const t of trades) {
      if (t.result === type) { cur++; max = Math.max(max, cur); } else cur = 0;
    }
    return max;
  }

  return [
    { label: "Total Trades", original: `${orig.total_trades}`, improved: `${imp.total_trades}`, delta: imp.total_trades - orig.total_trades, betterWhen: "lower" },
    { label: "Win Rate", original: `${orig.win_rate}%`, improved: `${imp.win_rate}%`, delta: imp.win_rate - orig.win_rate, betterWhen: "higher" },
    { label: "Profit Factor", original: orig.profit_factor.toFixed(2), improved: imp.profit_factor.toFixed(2), delta: imp.profit_factor - orig.profit_factor, betterWhen: "higher" },
    { label: "Max Drawdown", original: `${(orig.max_drawdown * 100).toFixed(1)}%`, improved: `${(imp.max_drawdown * 100).toFixed(1)}%`, delta: imp.max_drawdown - orig.max_drawdown, betterWhen: "lower" },
    { label: "Net Profit", original: `$${orig.net_profit.toFixed(2)}`, improved: `$${imp.net_profit.toFixed(2)}`, delta: imp.net_profit - orig.net_profit, betterWhen: "higher" },
    { label: "Expectancy", original: `$${origExp.toFixed(2)}`, improved: `$${impExp.toFixed(2)}`, delta: impExp - origExp, betterWhen: "higher" },
    { label: "Avg Win", original: `$${origAvgWin.toFixed(2)}`, improved: `$${impAvgWin.toFixed(2)}`, delta: impAvgWin - origAvgWin, betterWhen: "higher" },
    { label: "Avg Loss", original: `$${origAvgLoss.toFixed(2)}`, improved: `$${impAvgLoss.toFixed(2)}`, delta: impAvgLoss - origAvgLoss, betterWhen: "higher" },
    { label: "Loss Streak", original: `${streak(origTrades, "loss")}`, improved: `${streak(impTrades, "loss")}`, delta: streak(impTrades, "loss") - streak(origTrades, "loss"), betterWhen: "lower" },
  ];
}

function generateComparisonVerdict(metrics: MetricComparison[]): string {
  const improved = metrics.filter((m) => {
    if (m.betterWhen === "higher") return m.delta > 0.001;
    return m.delta < -0.001;
  });
  const worsened = metrics.filter((m) => {
    if (m.betterWhen === "higher") return m.delta < -0.001;
    return m.delta > 0.001;
  });

  if (improved.length === 0 && worsened.length === 0) return "Changes did not materially improve the strategy.";
  if (improved.length > worsened.length) {
    const names = improved.slice(0, 2).map((m) => m.label.toLowerCase()).join(" and ");
    return `Improved strategy shows better ${names}.`;
  }
  if (worsened.length > improved.length) {
    return "Changes made the strategy worse overall. Consider reverting.";
  }
  return "Mixed results — some metrics improved, others deteriorated. Review carefully.";
}

function summarizeDSL(dsl: ParsedDSL): string {
  const parts: string[] = [];
  if (dsl.entry?.conditions) {
    for (const c of dsl.entry.conditions) {
      if (c.type === "ema_cross") parts.push(`EMA ${c.fast}/${c.slow}`);
      if (c.type === "rsi_above") parts.push(`RSI>${c.value}`);
      if (c.type === "rsi_below") parts.push(`RSI<${c.value}`);
    }
  }
  if (dsl.exit?.stop_loss) parts.push(`SL ${dsl.exit.stop_loss.value}%`);
  if (dsl.exit?.take_profit) parts.push(`RR ${dsl.exit.take_profit.ratio}`);
  const sessions = dsl.filters?.filter((f) => f.type === "session").flatMap((f) => f.sessions ?? []);
  if (sessions && sessions.length > 0) parts.push(sessions.join("+"));
  return parts.join(", ");
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

  // Expectancy
  const wr = metrics.win_rate / 100;
  const expectancy = (wr * avgWin) - ((1 - wr) * Math.abs(avgLoss));
  const expectancyPer100 = expectancy * 100;

  // Verdict
  let verdict: { label: string; icon: string; color: string; bg: string; border: string; subtext: string };
  if (metrics.profit_factor < 1.05) {
    verdict = {
      label: "NOT TRADEABLE",
      icon: "\uD83D\uDD34",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      subtext: "This strategy is not suitable for live trading in its current form.",
    };
  } else if (metrics.profit_factor < 1.3) {
    verdict = {
      label: "NEEDS IMPROVEMENT",
      icon: "\uD83D\uDFE1",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      subtext: "This strategy may work, but it needs tighter execution and filtering.",
    };
  } else {
    verdict = {
      label: "TRADEABLE EDGE",
      icon: "\uD83D\uDFE2",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      subtext: "This strategy shows a usable edge if execution remains consistent.",
    };
  }

  // Coaching insights (max 4, concise)
  const avgRR = wins.length > 0 ? wins.reduce((s, t) => s + t.rr, 0) / wins.length : 0;
  const bullets: string[] = [];

  if (metrics.profit_factor < 1.05) {
    bullets.push(`Profit factor is **${metrics.profit_factor.toFixed(2)}** — edge is too thin. Small execution errors will kill profitability.`);
  } else if (metrics.profit_factor >= 2.0) {
    bullets.push(`Profit factor **${metrics.profit_factor.toFixed(2)}** is exceptional. Protect it: don't widen stops, don't overtrade.`);
  }

  if (metrics.win_rate < 35) {
    bullets.push(`Win rate **${metrics.win_rate}%** at RR **${avgRR.toFixed(1)}** — viable only with disciplined execution.`);
  }

  if (avgLoss !== 0 && avgWin > Math.abs(avgLoss) * 1.8) {
    bullets.push(`Winners are **${(avgWin / Math.abs(avgLoss)).toFixed(1)}x** larger than losers — reward is fine, setup filtering is the weakness.`);
  }

  if (longestLoss >= 8) {
    bullets.push(`Longest loss streak: **${longestLoss}** — psychologically brutal. Add a cooldown rule or reduce size.`);
  } else if (longestLoss >= 5) {
    bullets.push(`Longest loss streak: **${longestLoss}** — consider halving size after 3 consecutive losses.`);
  }

  if (metrics.max_drawdown > 0.1) {
    bullets.push(`Drawdown **${(metrics.max_drawdown * 100).toFixed(1)}%** — at 1% risk that's a ${Math.round(metrics.max_drawdown * 100)}% account hit. Tighten filters first.`);
  } else if (metrics.max_drawdown > 0.05) {
    bullets.push(`Drawdown **${(metrics.max_drawdown * 100).toFixed(1)}%** — manageable, but watch for loss clustering.`);
  }

  if (bullets.length === 0) {
    if (metrics.win_rate >= 50 && metrics.profit_factor >= 1.3) {
      bullets.push(`Win rate **${metrics.win_rate}%** with PF **${metrics.profit_factor.toFixed(2)}** — real edge. Stay consistent.`);
    } else {
      bullets.push("Metrics are normal. Run a longer period to validate edge consistency.");
    }
  }

  bullets.length = Math.min(bullets.length, 4);

  // What to improve (max 3, deterministic)
  const improvements: string[] = [];
  if (metrics.win_rate < 45) improvements.push("Test stricter entry filters to improve win rate.");
  if (longestLoss >= 5) improvements.push("Lower risk per trade if long loss streaks are hard to tolerate.");
  if (metrics.profit_factor < 1.3 && avgRR < 2) improvements.push("Increase reward target or tighten stop loss to improve RR.");
  if (metrics.max_drawdown > 0.05 && improvements.length < 3) improvements.push("Reduce bad setups instead of increasing trade frequency.");
  if (improvements.length === 0) improvements.push("Validate consistency across different market conditions.");
  improvements.length = Math.min(improvements.length, 3);

  // AI Coach: direct mentor voice
  const coachLines: string[] = [];
  if (metrics.profit_factor < 1.1) coachLines.push("You don't have a real edge here. Every trade you take is basically a coin flip — and costs are working against you.");
  if (metrics.win_rate < 40 && avgRR >= 2) coachLines.push("You're relying on RR to compensate for poor accuracy. That can work — but one sloppy entry will wipe out multiple winners.");
  if (metrics.win_rate >= 50 && metrics.profit_factor >= 1.3) coachLines.push("You have a real edge. Don't overthink it, don't change what's working. Just execute.");
  if (longestLoss > 10) coachLines.push(`You'll hit ${longestLoss} losses in a row. Most traders quit after 5. If you can't handle that, this isn't the strategy for you.`);
  if (coachLines.length === 0) coachLines.push("Your numbers are mixed. Don't risk real capital until you've tested this across different conditions.");
  coachLines.length = Math.min(coachLines.length, 3);

  // Reality check (1 strong sentence)
  let realityCheck: string;
  if (metrics.profit_factor < 1.05) realityCheck = "Most traders would lose money trading this live.";
  else if (metrics.profit_factor < 1.2) realityCheck = "Execution mistakes will destroy this strategy.";
  else if (longestLoss >= 8) realityCheck = "This will feel good in backtest, but the losing streaks will test you in real conditions.";
  else if (metrics.max_drawdown > 0.1) realityCheck = "The drawdown alone will make you question everything. Be honest about your risk tolerance.";
  else if (metrics.win_rate < 35) realityCheck = "You'll lose most of your trades. The math works — but your psychology might not.";
  else realityCheck = "The edge is there. The question is whether you'll execute it consistently when it matters.";

  // Main problem (priority-based, pick one)
  let mainProblem: { label: string; detail: string };
  if (metrics.profit_factor < 1.1) {
    mainProblem = { label: "Weak edge", detail: "You're barely breaking even. After real-world costs and slippage, you're likely losing money." };
  } else if (metrics.win_rate < 35) {
    mainProblem = { label: "Low accuracy", detail: "You're wrong on most trades. Your RR needs to compensate — and right now it may not be enough." };
  } else if (avgLoss !== 0 && avgWin / Math.abs(avgLoss) < 1.2) {
    mainProblem = { label: "Poor risk/reward", detail: "Your wins and losses are nearly the same size. There's no structural advantage — you're grinding for nothing." };
  } else if (longestLoss >= 8) {
    mainProblem = { label: "Streak risk", detail: "The losing streaks are too long. You'll second-guess every entry after 5 losses, and the strategy needs you not to." };
  } else if (metrics.max_drawdown > 0.08) {
    mainProblem = { label: "High drawdown", detail: "The drawdown is deeper than most traders can tolerate. You'll want to stop trading before the recovery." };
  } else {
    mainProblem = { label: "No critical flaw", detail: "Nothing is broken — but nothing is exceptional either. Focus on consistency." };
  }

  // What to fix first (imperative, max 3)
  const fixes: string[] = [];
  if (metrics.win_rate < 45) fixes.push("Stop taking low-quality setups. This is your biggest leak.");
  if (longestLoss >= 5) fixes.push("Cut your position size. You can't trade through a streak you can't survive.");
  if (metrics.profit_factor < 1.3) fixes.push("Your entries aren't good enough. More trades won't fix that — better trades will.");
  if (avgRR < 1.5 && fixes.length < 3) fixes.push("Move your TP further or your SL tighter. Your RR is leaving money on the table.");
  if (fixes.length === 0) fixes.push("Keep doing what you're doing. Don't fix what isn't broken.");
  fixes.length = Math.min(fixes.length, 3);

  // Quality score (0-100)
  let qualityScore = 50;
  if (metrics.profit_factor > 1.2) qualityScore += 10;
  if (metrics.profit_factor > 1.5) qualityScore += 5;
  if (metrics.win_rate > 40) qualityScore += 10;
  if (metrics.win_rate > 55) qualityScore += 5;
  if (avgRR >= 2) qualityScore += 10;
  if (longestLoss > 10) qualityScore -= 10;
  if (longestLoss > 6) qualityScore -= 5;
  if (metrics.profit_factor < 1.05) qualityScore -= 10;
  if (metrics.max_drawdown > 0.1) qualityScore -= 5;
  if (expectancy > 0) qualityScore += 5;
  qualityScore = Math.max(0, Math.min(100, qualityScore));
  const qualityLabel = qualityScore < 40 ? "Not tradeable" : qualityScore < 60 ? "Weak edge" : qualityScore < 75 ? "Potential" : "Strong";

  // What to do next (1-2 line immediate instruction)
  let nextStep: string;
  if (metrics.profit_factor < 1.05) nextStep = "Scrap this version — change your EMA periods or add an RSI filter and rerun.";
  else if (metrics.win_rate < 35 && avgRR < 2) nextStep = "Set take-profit to at least 3R and retest before touching live capital.";
  else if (longestLoss >= 8) nextStep = "Drop position size to 0.5% and add a 3-loss daily cutoff rule.";
  else if (metrics.profit_factor < 1.3) nextStep = "Remove your weakest session filter and rerun with only London overlap.";
  else nextStep = "Paper trade this for 2 weeks — track every entry against the rules.";

  const tradeabilityIcon = qualityScore < 50 ? "\u274C" : qualityScore < 70 ? "\u26A0\uFE0F" : "\u2705";
  const tradeabilityText = qualityScore < 50 ? "Not tradeable" : qualityScore < 70 ? "Needs work" : "Tradeable";

  return { avgWin, avgLoss, bestTrade, worstTrade, longestWin, longestLoss, bestDay, worstDay, bullets, improvements, expectancy, expectancyPer100, verdict, coachLines, realityCheck, mainProblem, fixes, qualityScore, qualityLabel, nextStep, tradeabilityIcon, tradeabilityText };
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
