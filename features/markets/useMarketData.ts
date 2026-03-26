"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MarketDataPoint {
  price: number;
  timestamp: number;
}

export interface MarketInstrument {
  symbol: string;
  price: number | null;
  previousPrice: number | null;
  change: number | null;
  changePercent: number | null;
  sparkline: number[];
  loading: boolean;
  error: string | null;
  marketStatus: "open" | "closed";
}

export type MarketDataMap = Record<string, MarketInstrument>;

// ── Market status helpers ────────────────────────────────────────────────────

const CRYPTO_SYMBOLS = new Set([
  "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
  "DOGEUSDT", "ADAUSDT", "BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "BNB",
]);

const FOREX_METALS = new Set([
  "XAUUSD", "XAGUSD", "GOLD", "SILVER",
  "EURUSD", "GBPUSD", "AUDUSD", "NZDUSD",
  "USDJPY", "USDCHF", "USDCAD",
  "EURGBP", "EURJPY", "GBPJPY", "CHFJPY", "AUDJPY",
]);

function isCrypto(symbol: string): boolean {
  return CRYPTO_SYMBOLS.has(symbol.toUpperCase());
}

function isForexOrMetal(symbol: string): boolean {
  return FOREX_METALS.has(symbol.toUpperCase());
}

function getMarketStatus(symbol: string): "open" | "closed" {
  const upper = symbol.toUpperCase();

  // Crypto: always open
  if (isCrypto(upper)) return "open";

  const now = new Date();
  const utcDay = now.getUTCDay();
  const utcHour = now.getUTCHours();

  // Forex & metals: closed from Friday 21:00 UTC to Sunday 21:00 UTC
  if (isForexOrMetal(upper)) {
    if (utcDay === 6) return "closed"; // Saturday
    if (utcDay === 5 && utcHour >= 21) return "closed"; // Friday after 21:00
    if (utcDay === 0 && utcHour < 21) return "closed"; // Sunday before 21:00
    return "open";
  }

  // Indices: approximate US market hours (14:30–21:00 UTC, Mon–Fri)
  if (utcDay === 0 || utcDay === 6) return "closed";
  if (utcHour >= 14 && utcHour < 21) return "open";
  return "closed";
}

// ── Hook ─────────────────────────────────────────────────────────────────────

const SPARKLINE_MAX = 10;
const POLL_INTERVAL = 15_000;

export function useMarketData(symbols: string[]) {
  const [data, setData] = useState<MarketDataMap>({});
  const historyRef = useRef<Record<string, MarketDataPoint[]>>({});
  const mountedRef = useRef(true);

  const fetchPrice = useCallback(async (symbol: string) => {
    try {
      const res = await fetch(`/api/prices/${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.price && json.price !== 0) throw new Error("No price data");
      return json.price as number;
    } catch (err) {
      throw err instanceof Error ? err : new Error("Fetch failed");
    }
  }, []);

  const fetchAll = useCallback(async (syms: string[]) => {
    const results = await Promise.allSettled(
      syms.map(async (symbol) => {
        const price = await fetchPrice(symbol);
        return { symbol, price };
      })
    );

    if (!mountedRef.current) return;

    setData((prev) => {
      const next = { ...prev };
      for (let i = 0; i < syms.length; i++) {
        const symbol = syms[i];
        const result = results[i];

        if (result.status === "fulfilled") {
          const { price } = result.value;
          const prevInstrument = next[symbol];
          const previousPrice = prevInstrument?.price ?? null;

          // Update sparkline history
          if (!historyRef.current[symbol]) historyRef.current[symbol] = [];
          const hist = historyRef.current[symbol];
          hist.push({ price, timestamp: Date.now() });
          if (hist.length > SPARKLINE_MAX) hist.shift();

          const change = previousPrice !== null ? price - previousPrice : null;
          const changePercent =
            previousPrice !== null && previousPrice !== 0
              ? ((price - previousPrice) / previousPrice) * 100
              : null;

          next[symbol] = {
            symbol,
            price,
            previousPrice,
            change,
            changePercent,
            sparkline: hist.map((p) => p.price),
            loading: false,
            error: null,
            marketStatus: getMarketStatus(symbol),
          };
        } else {
          const prevInstrument = next[symbol];
          next[symbol] = {
            symbol,
            price: prevInstrument?.price ?? null,
            previousPrice: prevInstrument?.previousPrice ?? null,
            change: prevInstrument?.change ?? null,
            changePercent: prevInstrument?.changePercent ?? null,
            sparkline: prevInstrument?.sparkline ?? [],
            loading: false,
            error: result.reason?.message ?? "Fetch failed",
            marketStatus: getMarketStatus(symbol),
          };
        }
      }
      return next;
    });
  }, [fetchPrice]);

  useEffect(() => {
    mountedRef.current = true;

    // Initialize loading state for new symbols
    setData((prev) => {
      const next = { ...prev };
      for (const symbol of symbols) {
        if (!next[symbol]) {
          next[symbol] = {
            symbol,
            price: null,
            previousPrice: null,
            change: null,
            changePercent: null,
            sparkline: [],
            loading: true,
            error: null,
            marketStatus: getMarketStatus(symbol),
          };
        }
      }
      return next;
    });

    // Initial fetch
    fetchAll(symbols);

    // Poll
    const interval = setInterval(() => fetchAll(symbols), POLL_INTERVAL);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [symbols.join(","), fetchAll]);

  return data;
}
