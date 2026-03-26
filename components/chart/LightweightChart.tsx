"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type CandlestickData, type Time, ColorType } from "lightweight-charts";
import { ChartToolbar, type DrawingTool } from "./ChartToolbar";
import { ChartDrawingOverlay, type Drawing } from "./ChartDrawingOverlay";

// ── Mock OHLC data generator (replace with real API later) ───────────────────

function generateMockOHLC(count: number): CandlestickData<Time>[] {
  const data: CandlestickData<Time>[] = [];
  let close = 100 + Math.random() * 50;
  const now = Math.floor(Date.now() / 1000);
  const interval = 3600; // 1h candles

  for (let i = count; i > 0; i--) {
    const time = (now - i * interval) as Time;
    const open = close + (Math.random() - 0.5) * 2;
    const high = Math.max(open, close) + Math.random() * 3;
    const low = Math.min(open, close) - Math.random() * 3;
    close = open + (Math.random() - 0.5) * 4;
    data.push({ time, open, high, low, close });
  }
  return data;
}

// ── Component ────────────────────────────────────────────────────────────────

interface LightweightChartProps {
  symbol: string;
}

export function LightweightChart({ symbol }: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [activeTool, setActiveTool] = useState<DrawingTool>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingDrawings, setLoadingDrawings] = useState(true);

  // Load saved drawings
  useEffect(() => {
    setLoadingDrawings(true);
    fetch(`/api/drawings?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => (r.ok ? r.json() : { drawings: [] }))
      .then((json) => {
        if (Array.isArray(json.drawings)) setDrawings(json.drawings);
      })
      .catch(() => {})
      .finally(() => setLoadingDrawings(false));
  }, [symbol]);

  // Create chart
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "rgba(8, 8, 8, 1)" },
        textColor: "#71717a",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: {
        vertLine: { color: "rgba(255, 255, 255, 0.1)", labelBackgroundColor: "#1a1a2e" },
        horzLine: { color: "rgba(255, 255, 255, 0.1)", labelBackgroundColor: "#1a1a2e" },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.06)",
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.06)",
      },
      width: el.clientWidth,
      height: el.clientHeight,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399",
      downColor: "#f87171",
      borderUpColor: "#34d399",
      borderDownColor: "#f87171",
      wickUpColor: "#34d399",
      wickDownColor: "#f87171",
    });

    series.setData(generateMockOHLC(200));
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      chart.resize(width, height);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  const addDrawing = useCallback((d: Drawing) => {
    setDrawings((prev) => [...prev, d]);
  }, []);

  const clearDrawings = useCallback(() => {
    setDrawings([]);
    setActiveTool(null);
  }, []);

  const saveDrawings = useCallback(async () => {
    setSaving(true);
    try {
      await fetch("/api/drawings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, drawings }),
      });
    } catch {}
    setSaving(false);
  }, [symbol, drawings]);

  return (
    <div className="space-y-2">
      <ChartToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onClear={clearDrawings}
        onSave={saveDrawings}
        saving={saving}
      />

      <div className="glass rounded-xl overflow-hidden relative" style={{ height: "calc(100vh - 200px)", minHeight: 600, width: "100%" }}>
        <div ref={containerRef} className="w-full h-full" />
        <ChartDrawingOverlay
          activeTool={activeTool}
          drawings={drawings}
          onAddDrawing={addDrawing}
        />
        {loadingDrawings && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-30">
            <span className="text-xs text-muted-foreground">Loading drawings...</span>
          </div>
        )}
      </div>
    </div>
  );
}
