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
import { ChartToolbar, type DrawingTool, type IndicatorVisibility, DEFAULT_INDICATORS, type SmcSettings, DEFAULT_SMC_SETTINGS } from "./ChartToolbar";
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

// ── SMC settings persistence ────────────────────────────────────────────────

const SMC_SETTINGS_KEY = "tf:smc-settings";

function loadSmcSettings(): SmcSettings {
  try {
    const raw = localStorage.getItem(SMC_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SMC_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SMC_SETTINGS };
}

function saveSmcSettings(s: SmcSettings) {
  try { localStorage.setItem(SMC_SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

// ── Component ────────────────────────────────────────────────────────────────

import { type Timeframe, INTERVAL_SECONDS } from "./TimeframeBar";
import React from "react";

interface LightweightChartProps {
  symbol: string;
  timeframe?: Timeframe;
  /** Live price from market data feed — drives candle updates */
  livePrice?: number | null;
}

export interface LightweightChartHandle {
  takeScreenshot: () => string | null;
  getSmcData: () => SmcResult | null;
  getDrawings: () => Drawing[];
}

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
  rsiUpper?: ISeriesApi<"Line">;
  rsiLower?: ISeriesApi<"Line">;
  macdLine?: ISeriesApi<"Line">;
  macdSignal?: ISeriesApi<"Line">;
  macdHist?: ISeriesApi<"Histogram">;
  stochK?: ISeriesApi<"Line">;
  stochD?: ISeriesApi<"Line">;
  stochUpper?: ISeriesApi<"Line">;
  stochLower?: ISeriesApi<"Line">;
}

export const LightweightChart = React.forwardRef<LightweightChartHandle, LightweightChartProps>(function LightweightChart({ symbol, timeframe = "1h", livePrice }, ref) {
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
  const [smcSettings, setSmcSettings] = useState<SmcSettings>(() => loadSmcSettings());
  const [smcData, setSmcData] = useState<SmcResult | null>(null);
  const [loadingCandles, setLoadingCandles] = useState(true);
  const [candleError, setCandleError] = useState<string | null>(null);
  const [, setRenderTick] = useState(0);
  // Incremented each time the chart is recreated so indicator effect re-fires
  const [chartVersion, setChartVersion] = useState(0);

  // Persist SMC settings changes
  const handleSmcSettingsChange = useCallback((next: SmcSettings) => {
    setSmcSettings(next);
    saveSmcSettings(next);
  }, []);

  useImperativeHandle(ref, () => ({
    takeScreenshot: () => {
      const chart = chartRef.current;
      if (!chart) return null;
      try {
        const canvas = chart.takeScreenshot(true);
        return canvas.toDataURL("image/png");
      } catch { return null; }
    },
    getSmcData: () => smcData,
    getDrawings: () => drawings,
  }), [smcData, drawings]);

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

  // Helper: run SMC with current settings
  const computeSmc = useCallback((candles: CandlestickData<Time>[]) => {
    const bars = candles.map((c) => ({
      open: c.open as number, high: c.high as number,
      low: c.low as number, close: c.close as number,
    }));
    const times = candles.map((c) => c.time as number);
    setSmcData(runSmcAnalysis(bars, times, {
      lookback: smcSettings.swingLookback,
      obBoxMode: smcSettings.obBoxMode,
    }));
  }, [smcSettings.swingLookback, smcSettings.obBoxMode]);

  // Re-run SMC when settings that affect calculations change
  useEffect(() => {
    if (candleDataRef.current.length > 0) {
      computeSmc(candleDataRef.current);
    }
  }, [computeSmc]);

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

    setLoadingCandles(true);
    setCandleError(null);

    fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok || json.error || !json.candles || json.candles.length === 0) {
          throw new Error(json.error ?? `HTTP ${r.status}`);
        }
        return json;
      })
      .then((json) => {
        const candles = json.candles.map((c: { time: number; open: number; high: number; low: number; close: number }) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        candleDataRef.current = candles;
        series.setData(candles);
        chart.timeScale().fitContent();
        computeSmc(candles);
        setLoadingCandles(false);
        setChartVersion((n) => n + 1);
        setRenderTick((n) => n + 1);
      })
      .catch((err) => {
        console.error("[chart] candle fetch error:", err);
        setCandleError(err.message ?? "Data unavailable");
        setLoadingCandles(false);
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
  }, [symbol, timeframe]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live price → update current candle or create new one ──────────────────
  useEffect(() => {
    if (livePrice == null || livePrice <= 0) return;
    const series = seriesRef.current;
    const candles = candleDataRef.current;
    if (!series || candles.length === 0) return;

    const intervalSec = INTERVAL_SECONDS[timeframe] ?? 3600;
    const nowSec = Math.floor(Date.now() / 1000);
    // Align to interval boundary (UTC)
    const currentBarTime = Math.floor(nowSec / intervalSec) * intervalSec;

    const lastCandle = candles[candles.length - 1];
    const lastTime = lastCandle.time as number;

    if (currentBarTime === lastTime) {
      // Same interval — update in place
      const updated: CandlestickData<Time> = {
        time: lastCandle.time,
        open: lastCandle.open,
        high: Math.max(lastCandle.high as number, livePrice),
        low: Math.min(lastCandle.low as number, livePrice),
        close: livePrice,
      };
      candles[candles.length - 1] = updated;
      series.update(updated);
    } else if (currentBarTime > lastTime) {
      // New interval — create new candle
      const newCandle: CandlestickData<Time> = {
        time: currentBarTime as Time,
        open: lastCandle.close, // open at previous close
        high: Math.max(lastCandle.close as number, livePrice),
        low: Math.min(lastCandle.close as number, livePrice),
        close: livePrice,
      };
      candles.push(newCandle);
      series.update(newCandle);
    }
    // If currentBarTime < lastTime (historical data ahead of clock), skip
  }, [livePrice, timeframe]);

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

    function ensureLine(
      key: keyof IndicatorSeries, visible: boolean, color: string,
      values: (number | null)[], paneIdx = 0, lineWidth: number = 1, priceScaleId?: string,
    ) {
      if (visible) {
        let s = refs[key] as ISeriesApi<"Line"> | undefined;
        if (!s) {
          s = chart!.addSeries(LineSeries, {
            color, lineWidth: lineWidth as 1 | 2 | 3 | 4,
            crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false,
            ...(priceScaleId ? { priceScaleId } : {}),
          }, paneIdx);
          (refs as Record<string, unknown>)[key] = s;
        }
        s.setData(values.map((v, i) => v !== null ? { time: times[i], value: v } : { time: times[i] }));
      } else if (refs[key]) {
        chart!.removeSeries(refs[key] as ISeriesApi<"Line">);
        delete refs[key];
      }
    }

    function ensureHistogram(
      key: keyof IndicatorSeries, visible: boolean,
      values: { time: Time; value: number; color?: string }[], paneIdx = 0, priceScaleId?: string,
    ) {
      if (visible) {
        let s = refs[key] as ISeriesApi<"Histogram"> | undefined;
        if (!s) {
          s = chart!.addSeries(HistogramSeries, {
            lastValueVisible: false, priceLineVisible: false,
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

    // Main pane overlays
    ensureLine("ema9", indicators.ema9, "#06b6d4", calcEMA(closes, 9));
    ensureLine("ema21", indicators.ema21, "#f97316", calcEMA(closes, 21));
    ensureLine("ema50", indicators.ema50, "#a855f7", calcEMA(closes, 50));
    ensureLine("sma200", indicators.sma200, "#e4e4e7", calcSMA(closes, 200));

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

    if (indicators.volume) {
      const syntheticVol = generateSyntheticVolume(candles.length);
      const volumeData = candles.map((c, i) => ({
        time: c.time, value: syntheticVol[i],
        color: (c.close as number) >= (c.open as number) ? "rgba(52, 211, 153, 0.3)" : "rgba(248, 113, 113, 0.3)",
      }));
      ensureHistogram("volume", true, volumeData, 0, "volume");
      try { chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } }); } catch {}
    } else {
      ensureHistogram("volume", false, []);
    }

    // Sub-pane indicators
    const subPaneKeys: (keyof IndicatorSeries)[] = [
      "rsi", "rsiUpper", "rsiLower", "macdLine", "macdSignal", "macdHist", "stochK", "stochD", "stochUpper", "stochLower",
    ];
    for (const k of subPaneKeys) {
      if (refs[k]) {
        try { chart.removeSeries(refs[k] as ISeriesApi<"Line"> & ISeriesApi<"Histogram">); } catch {}
        delete refs[k];
      }
    }
    try {
      const panes = chart.panes();
      for (let p = panes.length - 1; p > 0; p--) chart.removePane(p);
    } catch {}

    let nextPane = 1;

    if (indicators.rsi) {
      const pIdx = nextPane++;
      ensureLine("rsi", true, "#eab308", calcRSI(closes, 14), pIdx, 2, "rsi");
      refs.rsiUpper = chart.addSeries(LineSeries, { color: "rgba(255,255,255,0.15)", lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, priceScaleId: "rsi" }, pIdx);
      refs.rsiUpper.setData(times.map((t) => ({ time: t, value: 70 })));
      refs.rsiLower = chart.addSeries(LineSeries, { color: "rgba(255,255,255,0.15)", lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, priceScaleId: "rsi" }, pIdx);
      refs.rsiLower.setData(times.map((t) => ({ time: t, value: 30 })));
      try { const panes = chart.panes(); if (panes[pIdx]) panes[pIdx].setHeight(120); } catch {}
    }

    if (indicators.macd) {
      const pIdx = nextPane++;
      const macd = calcMACD(closes, 12, 26, 9);
      ensureLine("macdLine", true, "#3b82f6", macd.macd, pIdx, 2, "macd");
      ensureLine("macdSignal", true, "#f97316", macd.signal, pIdx, 1, "macd");
      ensureHistogram("macdHist", true,
        macd.histogram.map((v, i) => ({ time: times[i], value: v ?? 0, color: (v ?? 0) >= 0 ? "rgba(52, 211, 153, 0.6)" : "rgba(248, 113, 113, 0.6)" })).filter((_, i) => macd.histogram[i] !== null),
        pIdx, "macd");
      try { const panes = chart.panes(); if (panes[pIdx]) panes[pIdx].setHeight(120); } catch {}
    }

    if (indicators.stochastic) {
      const pIdx = nextPane++;
      const stoch = calcStochastic(highs, lows, closes, 14, 3);
      ensureLine("stochK", true, "#06b6d4", stoch.k, pIdx, 2, "stoch");
      ensureLine("stochD", true, "#f97316", stoch.d, pIdx, 1, "stoch");
      refs.stochUpper = chart.addSeries(LineSeries, { color: "rgba(255,255,255,0.15)", lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, priceScaleId: "stoch" }, pIdx);
      refs.stochUpper.setData(times.map((t) => ({ time: t, value: 80 })));
      refs.stochLower = chart.addSeries(LineSeries, { color: "rgba(255,255,255,0.15)", lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, priceScaleId: "stoch" }, pIdx);
      refs.stochLower.setData(times.map((t) => ({ time: t, value: 20 })));
      try { const panes = chart.panes(); if (panes[pIdx]) panes[pIdx].setHeight(120); } catch {}
    }

  }, [indicators, chartVersion]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const addDrawing = useCallback((d: Drawing) => { setDrawings((prev) => [...prev, d]); }, []);
  const clearDrawings = useCallback(() => { setDrawings([]); setActiveTool(null); }, []);
  const saveDrawings = useCallback(async () => {
    setSaving(true);
    try { await fetch("/api/drawings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, drawings }) }); } catch {}
    setSaving(false);
  }, [symbol, drawings]);

  const toggleIndicator = useCallback((key: keyof IndicatorVisibility) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
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
        smcSettings={smcSettings}
        onSmcSettingsChange={handleSmcSettingsChange}
      />

      <div className="glass rounded-xl overflow-hidden relative" style={{ height: "calc(100vh - 200px)", minHeight: 600, width: "100%" }}>
        <div ref={containerRef} className="w-full h-full" />
        <SmcOverlay
          smcData={smcData}
          settings={smcSettings}
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
        {loadingCandles && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
            <div className="flex flex-col items-center gap-2">
              <div className="h-5 w-5 border-2 border-[#0EA5E9]/30 border-t-[#0EA5E9] rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground">Loading {symbol} {timeframe}...</span>
            </div>
          </div>
        )}
        {candleError && !loadingCandles && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-30">
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground">Data unavailable</p>
              <p className="text-xs text-muted-foreground">{candleError}</p>
            </div>
          </div>
        )}
        {loadingDrawings && !loadingCandles && !candleError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-30">
            <span className="text-xs text-muted-foreground">Loading drawings...</span>
          </div>
        )}
      </div>
    </div>
  );
});
