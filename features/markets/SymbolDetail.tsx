"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useMarketData } from "./useMarketData";
import { formatPrice } from "./MarketCard";
import { TradingViewChart, getTradingViewSymbol } from "./TradingViewChart";

interface SymbolDetailProps {
  symbol: string;
}

export function SymbolDetail({ symbol }: SymbolDetailProps) {
  const tvSymbol = getTradingViewSymbol(symbol);
  const symbols = useMemo(() => [symbol], [symbol]);
  const data = useMarketData(symbols);
  const instrument = data[symbol];

  // Unsupported symbol
  if (!tvSymbol) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/markets"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Markets
        </Link>
        <div className="flex items-center justify-center rounded-xl border border-dashed border-white/[0.08] py-24">
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground mb-1">{symbol}</p>
            <p className="text-sm text-muted-foreground">Unsupported symbol</p>
          </div>
        </div>
      </div>
    );
  }

  const price = instrument?.price ?? null;
  const change = instrument?.change ?? null;
  const changePercent = instrument?.changePercent ?? null;
  const marketStatus = instrument?.marketStatus ?? "closed";
  const loading = instrument?.loading ?? true;
  const isPositive = (change ?? 0) >= 0;

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/dashboard/markets"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Markets
      </Link>

      {/* Header: symbol + price + change */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-2xl font-bold text-foreground">{symbol}</h1>
          <Badge variant={marketStatus === "open" ? "success" : "secondary"}>
            {marketStatus}
          </Badge>
        </div>

        <div className="flex items-baseline gap-3">
          {loading && price === null ? (
            <div className="h-8 w-32 animate-pulse rounded bg-white/[0.06]" />
          ) : price !== null ? (
            <>
              <span className="font-mono text-3xl font-bold text-foreground tabular-nums">
                {formatPrice(price, symbol)}
              </span>
              {change !== null && changePercent !== null && (
                <span
                  className={cn(
                    "font-mono text-sm font-semibold tabular-nums",
                    isPositive ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {isPositive ? "+" : ""}
                  {changePercent.toFixed(2)}%
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Price unavailable</span>
          )}
        </div>
      </div>

      {/* TradingView chart */}
      <div className="glass rounded-xl overflow-hidden" style={{ minHeight: 600 }}>
        <TradingViewChart symbol={symbol} />
      </div>
    </div>
  );
}
