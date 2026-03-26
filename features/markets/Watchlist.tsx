"use client";

import { MarketCard } from "./MarketCard";
import type { MarketDataMap } from "./useMarketData";

interface WatchlistProps {
  symbols: string[];
  data: MarketDataMap;
  onRemove: (symbol: string) => void;
}

export function Watchlist({ symbols, data, onRemove }: WatchlistProps) {
  if (symbols.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-white/[0.08] py-16">
        <p className="text-sm text-muted-foreground">
          No instruments in your watchlist. Add one above.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {symbols.map((symbol) => {
        const instrument = data[symbol] ?? {
          symbol,
          price: null,
          previousPrice: null,
          change: null,
          changePercent: null,
          sparkline: [],
          loading: true,
          error: null,
          marketStatus: "closed" as const,
        };
        return (
          <MarketCard
            key={symbol}
            instrument={instrument}
            onRemove={onRemove}
          />
        );
      })}
    </div>
  );
}
