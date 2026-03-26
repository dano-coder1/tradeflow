"use client";

import { cn } from "@/lib/utils";

export const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1D"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

// Maps our timeframe labels to TradingView interval values
export const TV_INTERVAL_MAP: Record<Timeframe, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "1h": "60",
  "4h": "240",
  "1D": "D",
};

// Maps our timeframe labels to seconds for synthetic OHLC generation
export const INTERVAL_SECONDS: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
  "1D": 86400,
};

interface TimeframeBarProps {
  active: Timeframe;
  onChange: (tf: Timeframe) => void;
  disabled?: boolean;
}

export function TimeframeBar({ active, onChange, disabled }: TimeframeBarProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg glass px-1.5 py-1">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          disabled={disabled}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
            active === tf
              ? "bg-[#0EA5E9]/15 text-[#0EA5E9]"
              : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}
