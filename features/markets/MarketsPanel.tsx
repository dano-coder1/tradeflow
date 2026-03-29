"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Plus } from "lucide-react";
import { useMarketData } from "./useMarketData";
import { Watchlist } from "./Watchlist";
import { DemoTradingPanel } from "@/components/demo/demo-trading-panel";

const DEFAULT_SYMBOLS = ["XAUUSD", "XAGUSD", "EURUSD", "GBPUSD", "USDJPY", "GBPJPY", "NAS100", "US30", "USOIL"];
const STORAGE_KEY = "tf:markets-v2";

function loadWatchlist(): string[] {
  if (typeof window === "undefined") return DEFAULT_SYMBOLS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_SYMBOLS;
}

function saveWatchlist(symbols: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  } catch {}
}

export function MarketsPanel() {
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [input, setInput] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("XAUUSD");

  // Load from localStorage on mount
  useEffect(() => {
    setSymbols(loadWatchlist());
  }, []);

  // Stabilize the symbols array reference for the hook
  const symbolsKey = symbols.join(",");
  const stableSymbols = useMemo(() => symbols, [symbolsKey]);

  const data = useMarketData(stableSymbols);

  const addSymbol = useCallback(() => {
    const sym = input.trim().toUpperCase();
    if (!sym) return;
    setSymbols((prev) => {
      if (prev.includes(sym)) return prev;
      const next = [...prev, sym];
      saveWatchlist(next);
      return next;
    });
    setInput("");
  }, [input]);

  const removeSymbol = useCallback((symbol: string) => {
    setSymbols((prev) => {
      const next = prev.filter((s) => s !== symbol);
      saveWatchlist(next);
      return next;
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Markets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live prices &middot; polling every 5s
          </p>
        </div>

        {/* Add symbol */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addSymbol();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add symbol..."
            className="h-9 w-40 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-[#0EA5E9]/40 focus:bg-white/[0.06]"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="btn-gradient inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </form>
      </div>

      {/* Main layout: Watchlist + Demo Trading */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Watchlist symbols={symbols} data={data} onRemove={removeSymbol} onSelect={setSelectedSymbol} />
        <DemoTradingPanel
          symbol={selectedSymbol}
          currentPrice={data[selectedSymbol]?.price ?? null}
        />
      </div>
    </div>
  );
}
