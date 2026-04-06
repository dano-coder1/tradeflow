"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createChart, LineSeries, type IChartApi } from "lightweight-charts";

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

interface BacktestResults {
  metrics: Metrics;
  equity_curve: number[];
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BacktestingPage() {
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
  // Confirm & Fill Form
  // -----------------------------------------------------------------------

  const handleConfirm = useCallback(() => {
    if (!parseResult?.dsl) return;
    const d = parseResult.dsl;

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

    setParseResult(null);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [parseResult]);

  // -----------------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    setStatus("pending");
    setErrorMsg("");
    setResults(null);

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

      // Poll for status
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

  useEffect(() => {
    if (!results || !chartRef.current) return;

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
      timeScale: { borderColor: "rgba(255,255,255,0.08)" },
    });

    const series = chart.addSeries(LineSeries, {
      color: "#0EA5E9",
      lineWidth: 2,
    });

    const curveData = results.equity_curve.map((val, i) => ({
      time: (i + 1) as unknown as import("lightweight-charts").Time,
      value: val,
    }));

    series.setData(curveData);
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
  }, [results]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const isRunning = status === "pending" || status === "running";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gradient">Backtesting</h1>
        <p className="text-sm text-muted-foreground">Test strategies against historical data</p>
      </div>

      {/* AI Parser */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Describe your strategy</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-[#0EA5E9]/50 focus:ring-1 focus:ring-[#0EA5E9]/30 transition-all duration-200 resize-y min-h-[80px]"
            rows={3}
            placeholder="e.g. EMA 20/50 cross on gold 15m, RSI above 50, SL 0.5%, RR 1:2, London session only"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
          />
          <div className="mt-3">
            <Button onClick={handleParse} loading={parsing} disabled={parsing || !promptText.trim()} variant="secondary">
              {parsing ? "Parsing..." : "Parse with AI"}
            </Button>
          </div>
          {parseError && (
            <p className="mt-3 text-sm text-destructive">{parseError}</p>
          )}
        </CardContent>
      </Card>

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
              <Button onClick={handleConfirm}>Confirm &amp; Fill Form</Button>
              <Button variant="ghost" onClick={() => setParseResult(null)}>Edit manually</Button>
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

          {/* Equity Curve */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Equity Curve</CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={chartRef} />
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
                    <tr key={i} className="border-b border-white/[0.03]">
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

function ConfirmField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "-"}</p>
    </div>
  );
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
