"use client";

import { useEffect, useRef, useState, useCallback, useImperativeHandle } from "react";
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type CandlestickData, type Time, ColorType } from "lightweight-charts";
import { ChartToolbar, type DrawingTool } from "./ChartToolbar";
import { ChartDrawingOverlay, type Drawing } from "./ChartDrawingOverlay";

// ── Synthetic OHLC generator centered around a real price ────────────────────

function generateSyntheticOHLC(basePrice: number, count: number, intervalSec: number = 3600): CandlestickData<Time>[] {
  const data: CandlestickData<Time>[] = [];
  // Scale volatility based on timeframe — larger TF = larger candles
  const tfFactor = Math.sqrt(intervalSec / 3600);
  const volatility = basePrice * 0.003 * tfFactor;
  let close = basePrice;
  const now = Math.floor(Date.now() / 1000);

  for (let i = count; i > 0; i--) {
    const time = (now - i * intervalSec) as Time;
    const open = close + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.8;
    const low = Math.min(open, close) - Math.random() * volatility * 0.8;
    close = open + (Math.random() - 0.5) * volatility * 1.2;
    data.push({ time, open, high, low, close });
  }
  return data;
}

// ── Component ────────────────────────────────────────────────────────────────

import { INTERVAL_SECONDS, type Timeframe } from "./TimeframeBar";
import React from "react";

interface LightweightChartProps {
  symbol: string;
  timeframe?: Timeframe;
}

export interface LightweightChartHandle {
  takeScreenshot: () => string | null;
}

export const LightweightChart = React.forwardRef<LightweightChartHandle, LightweightChartProps>(function LightweightChart({ symbol, timeframe = "1h" }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [activeTool, setActiveTool] = useState<DrawingTool>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingDrawings, setLoadingDrawings] = useState(true);
  // Force re-render to update drawing coordinates when chart scrolls/zooms
  const [, setRenderTick] = useState(0);

  useImperativeHandle(ref, () => ({
    takeScreenshot: () => {
      const chart = chartRef.current;
      if (!chart) return null;
      try {
        const canvas = chart.takeScreenshot(true);
        return canvas.toDataURL("image/png");
      } catch { return null; }
    },
  }), []);

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

  // Create chart + fetch real price
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

    chartRef.current = chart;
    seriesRef.current = series;

    // Fetch real price then build synthetic candles around it
    const intervalSec = INTERVAL_SECONDS[timeframe] ?? 3600;
    fetch(`/api/prices/${encodeURIComponent(symbol)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const realPrice = json?.price ?? 100;
        series.setData(generateSyntheticOHLC(realPrice, 200, intervalSec));
        chart.timeScale().fitContent();
        setRenderTick((n) => n + 1);
      })
      .catch(() => {
        series.setData(generateSyntheticOHLC(100, 200, intervalSec));
        chart.timeScale().fitContent();
      });

    // Re-render overlay when chart view changes (scroll/zoom)
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      setRenderTick((n) => n + 1);
    });

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      chart.resize(width, height);
      setRenderTick((n) => n + 1);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [symbol, timeframe]);

  // Coordinate conversion callbacks for the drawing overlay
  const coordToPrice = useCallback((y: number): number | null => {
    const series = seriesRef.current;
    if (!series) return null;
    const price = series.coordinateToPrice(y);
    if (price === null || !isFinite(price as number)) return null;
    return price as number;
  }, []);

  const priceToCoord = useCallback((price: number): number | null => {
    const series = seriesRef.current;
    if (!series) return null;
    const coord = series.priceToCoordinate(price);
    if (coord === null || !isFinite(coord)) return null;
    return coord;
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
          coordToPrice={coordToPrice}
          priceToCoord={priceToCoord}
        />
        {loadingDrawings && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-30">
            <span className="text-xs text-muted-foreground">Loading drawings...</span>
          </div>
        )}
      </div>
    </div>
  );
});
