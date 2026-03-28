"use client";

import { useEffect, useRef, useState, useCallback, useImperativeHandle } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  ColorType,
} from "lightweight-charts";
import { ChartToolbar, type DrawingTool, type IndicatorVisibility, DEFAULT_INDICATORS } from "./ChartToolbar";
import { ChartDrawingOverlay, type Drawing } from "./ChartDrawingOverlay";
import { SmcOverlay } from "./SmcOverlay";
import { runSmcAnalysis, type SmcResult } from "@/lib/smc-engine";
import {
  calcEMA,
  calcSMA,
  calcBollingerBands,
  calcRSI,
  calcMACD,
  calcStochastic,
  generateSyntheticVolume,
} from "./indicators";

// ── Synthetic OHLC generator centered around a real price ────────────────────

function generateSyntheticOHLC(basePrice: number, count: number, intervalSec: number = 3600): CandlestickData<Time>[] {
  const data: CandlestickData<Time>[] = [];
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

// Holds refs to all dynamically created indicator series so we can update/remove them
interface IndicatorSeries {
  ema9?: ISeriesApi<"Line">;
  ema21?: ISeriesApi<"Line">;
  ema50?: ISeriesApi<"Line">;
  sma200?: ISeriesApi<"Line">;
  bbUpper?: ISeriesApi<"Line">;
  bbMiddle?: ISeriesApi<"Line">;
  bbLower?: ISeriesApi<"Line">;
  volume?: ISeriesApi<"Histogram">;
  rsi?: ISeriesApi<"Line">;
  rsiUpper?: ISeriesApi<"Line">; // 70 guideline
  rsiLower?: ISeriesApi<"Line">; // 30 guideline
  macdLine?: ISeriesApi<"Line">;
  macdSignal?: ISeriesApi<"Line">;
  macdHist?: ISeriesApi<"Histogram">;
  stochK?: ISeriesApi<"Line">;
  stochD?: ISeriesApi<"Line">;
  stochUpper?: ISeriesApi<"Line">; // 80 guideline
  stochLower?: ISeriesApi<"Line">; // 20 guideline
}

export const LightweightChart = React.forwardRef<LightweightChartHandle, LightweightChartProps>(function LightweightChart({ symbol, timeframe = "1h" }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const indicatorSeriesRef = useRef<IndicatorSeries>({});
  const candleDataRef = useRef<CandlestickData<Time>[]>([]);

  const [activeTool, setActiveTool] = useState<DrawingTool>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingDrawings, setLoadingDrawings] = useState(true);
  const [indicators, setIndicators] = useState<IndicatorVisibility>({ ...DEFAULT_INDICATORS });
  const [smcEnabled, setSmcEnabled] = useState(true);
  const [smcData, setSmcData] = useState<SmcResult | null>(null);
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
    indicatorSeriesRef.current = {};

    const intervalSec = INTERVAL_SECONDS[timeframe] ?? 3600;
    fetch(`/api/prices/${encodeURIComponent(symbol)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const realPrice = json?.price ?? 100;
        const candles = generateSyntheticOHLC(realPrice, 200, intervalSec);
        candleDataRef.current = candles;
        series.setData(candles);
        chart.timeScale().fitContent();
        setSmcData(runSmcAnalysis(candles.map((c) => ({
          open: c.open as number, high: c.high as number,
          low: c.low as number, close: c.close as number,
        }))));
        setRenderTick((n) => n + 1);
      })
      .catch(() => {
        const candles = generateSyntheticOHLC(100, 200, intervalSec);
        candleDataRef.current = candles;
        series.setData(candles);
        chart.timeScale().fitContent();
        setSmcData(runSmcAnalysis(candles.map((c) => ({
          open: c.open as number, high: c.high as number,
          low: c.low as number, close: c.close as number,
        }))));
      });

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
      indicatorSeriesRef.current = {};
      candleDataRef.current = [];
    };
  }, [symbol, timeframe]);

  // ── Sync indicator series with visibility state ────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const candles = candleDataRef.current;
    if (!chart || candles.length === 0) return;

    const refs = indicatorSeriesRef.current;
    const times = candles.map((c) => c.time);
    const closes = candles.map((c) => c.close as number);
    const highs = candles.map((c) => c.high as number);
    const lows = candles.map((c) => c.low as number);

    // Helper: create or update a line series on the main pane (0)
    function ensureLine(
      key: keyof IndicatorSeries,
      visible: boolean,
      color: string,
      values: (number | null)[],
      paneIdx = 0,
      lineWidth: number = 1,
      priceScaleId?: string,
    ) {
      if (visible) {
        let s = refs[key] as ISeriesApi<"Line"> | undefined;
        if (!s) {
          s = chart!.addSeries(LineSeries, {
            color,
            lineWidth: lineWidth as 1 | 2 | 3 | 4,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
            ...(priceScaleId ? { priceScaleId } : {}),
          }, paneIdx);
          (refs as Record<string, unknown>)[key] = s;
        }
        const data = values.map((v, i) =>
          v !== null ? { time: times[i], value: v } : { time: times[i] },
        );
        s.setData(data);
      } else if (refs[key]) {
        chart!.removeSeries(refs[key] as ISeriesApi<"Line">);
        delete refs[key];
      }
    }

    // Helper: histogram series
    function ensureHistogram(
      key: keyof IndicatorSeries,
      visible: boolean,
      values: { time: Time; value: number; color?: string }[],
      paneIdx = 0,
      priceScaleId?: string,
    ) {
      if (visible) {
        let s = refs[key] as ISeriesApi<"Histogram"> | undefined;
        if (!s) {
          s = chart!.addSeries(HistogramSeries, {
            lastValueVisible: false,
            priceLineVisible: false,
            ...(priceScaleId ? { priceScaleId } : {}),
          }, paneIdx);
          (refs as Record<string, unknown>)[key] = s;
        }
        s.setData(values);
      } else if (refs[key]) {
        chart!.removeSeries(refs[key] as ISeriesApi<"Histogram">);
        delete refs[key];
      }
    }

    // ── Main pane overlays (pane 0) ────────────────────────────────────────

    // EMA 9 — cyan
    ensureLine("ema9", indicators.ema9, "#06b6d4", calcEMA(closes, 9));
    // EMA 21 — orange
    ensureLine("ema21", indicators.ema21, "#f97316", calcEMA(closes, 21));
    // EMA 50 — purple
    ensureLine("ema50", indicators.ema50, "#a855f7", calcEMA(closes, 50));
    // SMA 200 — white
    ensureLine("sma200", indicators.sma200, "#e4e4e7", calcSMA(closes, 200));

    // Bollinger Bands — blue
    if (indicators.bb) {
      const bb = calcBollingerBands(closes, 20, 2);
      ensureLine("bbUpper", true, "#3b82f6", bb.upper, 0, 1);
      ensureLine("bbMiddle", true, "#3b82f680", bb.middle, 0, 1);
      ensureLine("bbLower", true, "#3b82f6", bb.lower, 0, 1);
    } else {
      ensureLine("bbUpper", false, "", []);
      ensureLine("bbMiddle", false, "", []);
      ensureLine("bbLower", false, "", []);
    }

    // Volume — green/red histogram on main pane, own price scale
    if (indicators.volume) {
      const syntheticVol = generateSyntheticVolume(candles.length);
      const volumeData = candles.map((c, i) => ({
        time: c.time,
        value: syntheticVol[i],
        color:
          (c.close as number) >= (c.open as number)
            ? "rgba(52, 211, 153, 0.3)"  // green
            : "rgba(248, 113, 113, 0.3)", // red
      }));
      ensureHistogram("volume", true, volumeData, 0, "volume");
      // Scale volume to bottom 20% of pane
      try {
        chart.priceScale("volume").applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
      } catch {}
    } else {
      ensureHistogram("volume", false, []);
    }

    // ── Sub-pane indicators (RSI, MACD, Stochastic) ────────────────────────
    // Pane indices shift depending on which sub-indicators are active, so we
    // tear down all sub-pane series first and rebuild only the active ones.

    const subPaneKeys: (keyof IndicatorSeries)[] = [
      "rsi", "rsiUpper", "rsiLower",
      "macdLine", "macdSignal", "macdHist",
      "stochK", "stochD", "stochUpper", "stochLower",
    ];
    for (const k of subPaneKeys) {
      if (refs[k]) {
        try { chart.removeSeries(refs[k] as ISeriesApi<"Line"> & ISeriesApi<"Histogram">); } catch {}
        delete refs[k];
      }
    }
    // Remove empty sub-panes (index > 0) so they don't accumulate
    try {
      const panes = chart.panes();
      for (let p = panes.length - 1; p > 0; p--) {
        chart.removePane(p);
      }
    } catch {}

    let nextPane = 1;

    // RSI
    if (indicators.rsi) {
      const pIdx = nextPane++;
      const rsiVals = calcRSI(closes, 14);
      ensureLine("rsi", true, "#eab308", rsiVals, pIdx, 2, "rsi");
      // 70/30 guide lines
      const guideLine70 = times.map((t) => ({ time: t, value: 70 }));
      const guideLine30 = times.map((t) => ({ time: t, value: 30 }));
      refs.rsiUpper = chart.addSeries(LineSeries, {
        color: "rgba(255,255,255,0.15)", lineWidth: 1, lineStyle: 2,
        crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, priceScaleId: "rsi",
      }, pIdx);
      refs.rsiUpper.setData(guideLine70);
      refs.rsiLower = chart.addSeries(LineSeries, {
        color: "rgba(255,255,255,0.15)", lineWidth: 1, lineStyle: 2,
        crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, priceScaleId: "rsi",
      }, pIdx);
      refs.rsiLower.setData(guideLine30);
      try { const panes = chart.panes(); if (panes[pIdx]) panes[pIdx].setHeight(120); } catch {}
    }

    // MACD
    if (indicators.macd) {
      const pIdx = nextPane++;
      const macd = calcMACD(closes, 12, 26, 9);
      ensureLine("macdLine", true, "#3b82f6", macd.macd, pIdx, 2, "macd");
      ensureLine("macdSignal", true, "#f97316", macd.signal, pIdx, 1, "macd");
      const histData = macd.histogram.map((v, i) => ({
        time: times[i],
        value: v ?? 0,
        color: (v ?? 0) >= 0 ? "rgba(52, 211, 153, 0.6)" : "rgba(248, 113, 113, 0.6)",
      })).filter((_, i) => macd.histogram[i] !== null);
      ensureHistogram("macdHist", true, histData, pIdx, "macd");
      try { const panes = chart.panes(); if (panes[pIdx]) panes[pIdx].setHeight(120); } catch {}
    }

    // Stochastic
    if (indicators.stochastic) {
      const pIdx = nextPane++;
      const stoch = calcStochastic(highs, lows, closes, 14, 3);
      ensureLine("stochK", true, "#06b6d4", stoch.k, pIdx, 2, "stoch");
      ensureLine("stochD", true, "#f97316", stoch.d, pIdx, 1, "stoch");
      const guide80 = times.map((t) => ({ time: t, value: 80 }));
      const guide20 = times.map((t) => ({ time: t, value: 20 }));
      refs.stochUpper = chart.addSeries(LineSeries, {
        color: "rgba(255,255,255,0.15)", lineWidth: 1, lineStyle: 2,
        crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, priceScaleId: "stoch",
      }, pIdx);
      refs.stochUpper.setData(guide80);
      refs.stochLower = chart.addSeries(LineSeries, {
        color: "rgba(255,255,255,0.15)", lineWidth: 1, lineStyle: 2,
        crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, priceScaleId: "stoch",
      }, pIdx);
      refs.stochLower.setData(guide20);
      try { const panes = chart.panes(); if (panes[pIdx]) panes[pIdx].setHeight(120); } catch {}
    }

  }, [indicators]); // eslint-disable-line react-hooks/exhaustive-deps
  // deps: indicators changes trigger re-sync; chart/candle refs are stable within a mount cycle

  // Coordinate conversion callbacks
  const timeToCoord = useCallback((time: Time): number | null => {
    const chart = chartRef.current;
    if (!chart) return null;
    const coord = chart.timeScale().timeToCoordinate(time);
    if (coord === null || !isFinite(coord)) return null;
    return coord;
  }, []);

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

  const toggleIndicator = useCallback((key: keyof IndicatorVisibility) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleSmc = useCallback(() => {
    setSmcEnabled((prev) => !prev);
  }, []);

  return (
    <div className="space-y-2">
      <ChartToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onClear={clearDrawings}
        onSave={saveDrawings}
        saving={saving}
        indicators={indicators}
        onToggleIndicator={toggleIndicator}
        smcEnabled={smcEnabled}
        onToggleSmc={toggleSmc}
      />

      <div className="glass rounded-xl overflow-hidden relative" style={{ height: "calc(100vh - 200px)", minHeight: 600, width: "100%" }}>
        <div ref={containerRef} className="w-full h-full" />
        <SmcOverlay
          smcData={smcData}
          visible={smcEnabled}
          times={candleDataRef.current.map((c) => c.time)}
          timeToCoord={timeToCoord}
          priceToCoord={priceToCoord}
        />
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
