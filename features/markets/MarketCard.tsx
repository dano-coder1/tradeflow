"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketInstrument } from "./useMarketData";

// ── Mini sparkline (pure SVG) ────────────────────────────────────────────────

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const pad = 2;

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#34d399" : "#f87171"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Format price ─────────────────────────────────────────────────────────────

export function formatPrice(price: number, symbol: string): string {
  const upper = symbol.toUpperCase();
  // Crypto with large values
  if (upper.includes("BTC")) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Indices
  if (["NAS100", "US30", "US500"].includes(upper)) return price.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  // Forex (JPY pairs have 3 decimals, others 5)
  if (upper.includes("JPY")) return price.toFixed(3);
  // Gold/silver
  if (["XAUUSD", "GOLD", "XAU"].includes(upper)) return price.toFixed(2);
  if (["XAGUSD", "SILVER", "XAG"].includes(upper)) return price.toFixed(4);
  // Default forex
  if (price < 50) return price.toFixed(5);
  return price.toFixed(2);
}

// ── Card ─────────────────────────────────────────────────────────────────────

interface MarketCardProps {
  instrument: MarketInstrument;
  onRemove?: (symbol: string) => void;
}

export function MarketCard({ instrument, onRemove }: MarketCardProps) {
  const { symbol, price, change, changePercent, sparkline, loading, error, marketStatus } = instrument;

  const isPositive = (change ?? 0) >= 0;

  return (
    <Link
      href={`/dashboard/markets/${encodeURIComponent(symbol)}`}
      className="glass rounded-xl p-4 transition-all duration-200 hover:bg-white/[0.03] group relative block"
    >
      {/* Remove button */}
      {onRemove && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(symbol); }}
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/60 hover:!text-foreground hover:bg-white/[0.06] z-10"
          title="Remove"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Header: symbol + status */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs font-bold text-foreground tracking-wide">{symbol}</span>
        <Badge variant={marketStatus === "open" ? "success" : "secondary"} className="text-[9px]">
          {marketStatus}
        </Badge>
      </div>

      {/* Price */}
      <div className="mb-1.5">
        {loading && price === null ? (
          <div className="h-7 w-24 animate-pulse rounded bg-white/[0.06]" />
        ) : error && price === null ? (
          <span className="text-xs text-red-400">Unavailable</span>
        ) : price !== null ? (
          <span className="font-mono text-xl font-bold text-foreground tabular-nums leading-none">
            {formatPrice(price, symbol)}
          </span>
        ) : null}
      </div>

      {/* Change + sparkline */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {change !== null && changePercent !== null ? (
            <>
              <span
                className={cn(
                  "font-mono text-xs font-semibold tabular-nums",
                  isPositive ? "text-emerald-400" : "text-red-400"
                )}
              >
                {isPositive ? "+" : ""}
                {changePercent.toFixed(2)}%
              </span>
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground">--</span>
          )}
        </div>
        <Sparkline data={sparkline} positive={isPositive} />
      </div>
    </Link>
  );
}
