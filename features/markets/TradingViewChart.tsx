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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Clear previous widget
    el.innerHTML = "";

    const tvSymbol = getTradingViewSymbol(symbol);
    if (!tvSymbol) return;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.textContent = JSON.stringify({
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
    });

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container__widget";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";

    el.appendChild(wrapper);
    el.appendChild(script);

    return () => {
      el.innerHTML = "";
    };
  }, [symbol, interval]);

  return (
    <div className="tradingview-widget-container" ref={containerRef} style={{ height: "100%", width: "100%" }} />
  );
}
