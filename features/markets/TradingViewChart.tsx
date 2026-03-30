"use client";

import { useEffect, useRef } from "react";

// ── Symbol mapping ───────────────────────────────────────────────────────────

const TV_SYMBOL_MAP: Record<string, string> = {
  XAUUSD: "CAPITALCOM:GOLD",
  XAU: "CAPITALCOM:GOLD",
  GOLD: "CAPITALCOM:GOLD",
  XAGUSD: "CAPITALCOM:SILVER",
  XAG: "CAPITALCOM:SILVER",
  SILVER: "CAPITALCOM:SILVER",
  BTCUSDT: "BINANCE:BTCUSDT",
  BTC: "BINANCE:BTCUSDT",
  ETHUSDT: "BINANCE:ETHUSDT",
  ETH: "BINANCE:ETHUSDT",
  BNBUSDT: "BINANCE:BNBUSDT",
  SOLUSDT: "BINANCE:SOLUSDT",
  SOL: "BINANCE:SOLUSDT",
  XRPUSDT: "BINANCE:XRPUSDT",
  DOGEUSDT: "BINANCE:DOGEUSDT",
  ADAUSDT: "BINANCE:ADAUSDT",
  EURUSD: "FX:EURUSD",
  GBPUSD: "FX:GBPUSD",
  AUDUSD: "FX:AUDUSD",
  NZDUSD: "FX:NZDUSD",
  USDJPY: "FX:USDJPY",
  USDCHF: "FX:USDCHF",
  USDCAD: "FX:USDCAD",
  EURGBP: "FX:EURGBP",
  EURJPY: "FX:EURJPY",
  GBPJPY: "FX:GBPJPY",
  CHFJPY: "FX:CHFJPY",
  AUDJPY: "FX:AUDJPY",
  NAS100: "CAPITALCOM:US100",
  US30: "CAPITALCOM:US30",
  US500: "CAPITALCOM:US500",
  DXY: "TVC:DXY",
  USOIL: "TVC:USOIL",
  UKOIL: "TVC:UKOIL",
};

export function getTradingViewSymbol(symbol: string): string | null {
  return TV_SYMBOL_MAP[symbol.toUpperCase()] ?? null;
}

// ── Component ────────────────────────────────────────────────────────────────

interface TradingViewChartProps {
  symbol: string;
  interval?: string;
}

export function TradingViewChart({ symbol, interval = "60" }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Track current props to avoid redundant reloads
  const mountedRef = useRef<{ symbol: string; interval: string } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const tvSymbol = getTradingViewSymbol(symbol);
    if (!tvSymbol) return;

    // Skip reload if symbol + interval haven't changed (prevents stale re-render)
    if (
      mountedRef.current &&
      mountedRef.current.symbol === tvSymbol &&
      mountedRef.current.interval === interval
    ) {
      return;
    }

    // Clear previous widget completely
    el.innerHTML = "";
    mountedRef.current = { symbol: tvSymbol, interval };

    // TradingView embed widget structure:
    // <div class="tradingview-widget-container">
    //   <div class="tradingview-widget-container__widget" />
    //   <script src="..." textContent="{config JSON}" />
    // </div>

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "100%";
    widgetDiv.style.width = "100%";

    const config = {
      autosize: true,
      symbol: tvSymbol,
      interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(8, 8, 8, 1)",
      gridColor: "rgba(255, 255, 255, 0.04)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
      withdateranges: true,
      details: false,
      studies: [],
    };

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.textContent = JSON.stringify(config);

    // Handle script load errors
    script.onerror = () => {
      console.error("[TradingView] Failed to load embed script");
    };

    el.appendChild(widgetDiv);
    el.appendChild(script);

    return () => {
      mountedRef.current = null;
      el.innerHTML = "";
    };
  }, [symbol, interval]);

  return (
    <div
      className="tradingview-widget-container"
      ref={containerRef}
      style={{ height: "100%", width: "100%" }}
    />
  );
}
