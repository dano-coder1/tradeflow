"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketInstrument } from "./useMarketData";

// ── Instrument identity ─────────────────────────────────────────────────────

interface InstrumentMeta {
  icon: string;
  label: string;
  accent: string;
  borderColor: string;
}

function getInstrumentMeta(symbol: string): InstrumentMeta {
  const s = symbol.toUpperCase();

  // Precious metals
  if (["XAUUSD", "GOLD", "XAU"].includes(s))
    return { icon: "\u{1F947}", label: "Precious Metal", accent: "#F5A623", borderColor: "border-[#F5A623]/30" };
  if (["XAGUSD", "SILVER", "XAG"].includes(s))
    return { icon: "\u{1F948}", label: "Precious Metal", accent: "#C0C0C0", borderColor: "border-[#C0C0C0]/30" };

  // Indices
  if (s === "NAS100")
    return { icon: "\u{1F4C8}", label: "Index", accent: "#3B82F6", borderColor: "border-[#3B82F6]/30" };
  if (s === "US30" || s === "US500")
    return { icon: "\u{1F3DB}", label: "Index", accent: "#1E40AF", borderColor: "border-[#1E40AF]/30" };

  // Commodities
  if (["USOIL", "UKOIL"].includes(s))
    return { icon: "\u{1F6E2}", label: "Commodity", accent: "#D97706", borderColor: "border-[#D97706]/30" };

  // Forex — GBP pairs
  if (s.startsWith("GBP") || s.endsWith("GBP"))
    return { icon: "\u{1F1EC}\u{1F1E7}", label: "Forex", accent: "#EF4444", borderColor: "border-[#EF4444]/25" };

  // Forex — JPY pairs
  if (s.includes("JPY"))
    return { icon: "\u{1F1EF}\u{1F1F5}", label: "Forex", accent: "#F87171", borderColor: "border-[#F87171]/25" };

  // Forex — EUR pairs
  if (s.startsWith("EUR") || s.endsWith("EUR"))
    return { icon: "\u{1F1EA}\u{1F1FA}", label: "Forex", accent: "#3B82F6", borderColor: "border-[#3B82F6]/25" };

  // Forex — default
  if (["AUD", "NZD", "USD", "CAD", "CHF"].some((c) => s.includes(c)))
    return { icon: "\u{1F4B1}", label: "Forex", accent: "#6B7280", borderColor: "border-white/[0.08]" };

  // Crypto
  if (["BTC", "ETH", "BNB", "SOL", "XRP", "DOGE", "ADA"].some((c) => s.includes(c)))
    return { icon: "\u{20BF}", label: "Crypto", accent: "#F59E0B", borderColor: "border-[#F59E0B]/25" };

  return { icon: "\u{1F4CA}", label: "Market", accent: "#6B7280", borderColor: "border-white/[0.08]" };
}

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
  if (upper.includes("BTC")) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (["NAS100", "US30", "US500"].includes(upper)) return price.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (upper.includes("JPY")) return price.toFixed(3);
  if (["XAUUSD", "GOLD", "XAU"].includes(upper)) return price.toFixed(2);
  if (["XAGUSD", "SILVER", "XAG"].includes(upper)) return price.toFixed(4);
  if (["USOIL", "UKOIL"].includes(upper)) return price.toFixed(2);
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
  const meta = getInstrumentMeta(symbol);

  return (
    <div className="relative group">
      <Link
        href={`/dashboard/markets/${encodeURIComponent(symbol)}`}
        className={cn(
          "glass rounded-xl overflow-hidden transition-all duration-200 hover:bg-white/[0.03] block",
          "border-t-2",
          meta.borderColor
        )}
        style={{ borderTopColor: meta.accent }}
      >
        <div className="p-4">
          {/* Header: icon + symbol + type + status */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm leading-none">{meta.icon}</span>
              <div>
                <span className="font-mono text-xs font-bold text-foreground tracking-wide">{symbol}</span>
                <p className="text-[9px] text-muted-foreground/50 leading-none mt-0.5">{meta.label}</p>
              </div>
            </div>
            <Badge variant={marketStatus === "open" ? "success" : "secondary"} className="text-[9px]">
              {marketStatus}
            </Badge>
          </div>

          {/* Price */}
          <div className="mb-1.5">
            {loading && price === null ? (
              <div className="h-7 w-24 animate-pulse rounded bg-white/[0.06]" />
            ) : error && price === null ? (
              <span className="text-xs text-muted-foreground/60">Data unavailable</span>
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
                <span
                  className={cn(
                    "font-mono text-xs font-semibold tabular-nums",
                    isPositive ? "text-emerald-400" : "text-red-400"
                  )}
                >
                  {isPositive ? "+" : ""}
                  {changePercent.toFixed(2)}%
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">--</span>
              )}
            </div>
            <Sparkline data={sparkline} positive={isPositive} />
          </div>
        </div>
      </Link>

      {/* Remove button */}
      {onRemove && (
        <button
          onClick={() => onRemove(symbol)}
          className="absolute right-2 top-3 rounded-md p-1 text-muted-foreground/0 transition-all group-hover:text-muted-foreground/60 hover:!text-foreground hover:bg-white/[0.06] z-10"
          title="Remove"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
