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

  // Job state
  const [status, setStatus] = useState<JobStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [results, setResults] = useState<BacktestResults | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Chart
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartApi = useRef<IChartApi | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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

    // Dispose previous chart
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

      {/* Form */}
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

function formatTs(ts: string): string {
  if (!ts) return "-";
  return ts.replace("T", " ").slice(0, 16);
}
