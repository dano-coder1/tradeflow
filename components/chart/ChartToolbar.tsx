"use client";

import { useState } from "react";
import { Minus, Square, Trash2, Save, Loader2, BarChart3, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type DrawingTool = "line" | "zone" | null;

export interface IndicatorVisibility {
  ema9: boolean;
  ema21: boolean;
  ema50: boolean;
  sma200: boolean;
  bb: boolean;
  volume: boolean;
  rsi: boolean;
  macd: boolean;
  stochastic: boolean;
}

export const DEFAULT_INDICATORS: IndicatorVisibility = {
  ema9: true,
  ema21: true,
  ema50: false,
  sma200: false,
  bb: false,
  volume: true,
  rsi: false,
  macd: false,
  stochastic: false,
};

interface IndicatorDef {
  key: keyof IndicatorVisibility;
  label: string;
  color: string;
}

const INDICATOR_DEFS: IndicatorDef[] = [
  { key: "ema9", label: "EMA 9", color: "#06b6d4" },
  { key: "ema21", label: "EMA 21", color: "#f97316" },
  { key: "ema50", label: "EMA 50", color: "#a855f7" },
  { key: "sma200", label: "SMA 200", color: "#e4e4e7" },
  { key: "bb", label: "Bollinger", color: "#3b82f6" },
  { key: "volume", label: "Volume", color: "#34d399" },
  { key: "rsi", label: "RSI (14)", color: "#eab308" },
  { key: "macd", label: "MACD", color: "#3b82f6" },
  { key: "stochastic", label: "Stochastic", color: "#06b6d4" },
];

interface ChartToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onClear: () => void;
  onSave: () => void;
  saving: boolean;
  indicators?: IndicatorVisibility;
  onToggleIndicator?: (key: keyof IndicatorVisibility) => void;
  smcEnabled?: boolean;
  onToggleSmc?: () => void;
}

export function ChartToolbar({ activeTool, onToolChange, onClear, onSave, saving, indicators, onToggleIndicator, smcEnabled, onToggleSmc }: ChartToolbarProps) {
  const [showIndicators, setShowIndicators] = useState(false);

  const tools: { key: DrawingTool; label: string; icon: typeof Minus }[] = [
    { key: "line", label: "Line", icon: Minus },
    { key: "zone", label: "Zone", icon: Square },
  ];

  const activeCount = indicators
    ? Object.values(indicators).filter(Boolean).length
    : 0;

  return (
    <div className="flex items-center gap-1.5 rounded-lg glass px-2 py-1.5 relative">
      {/* Drawing tools */}
      {tools.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onToolChange(activeTool === key ? null : key)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            activeTool === key
              ? "bg-[#0EA5E9]/15 text-[#0EA5E9]"
              : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}

      <div className="mx-1 h-4 w-px bg-white/[0.08]" />

      {/* Indicator dropdown toggle */}
      {indicators && onToggleIndicator && (
        <>
          <button
            onClick={() => setShowIndicators((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              showIndicators
                ? "bg-[#8B5CF6]/15 text-[#8B5CF6]"
                : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Indicators
            {activeCount > 0 && (
              <span className="rounded-full bg-white/[0.08] px-1.5 text-[10px] font-bold">
                {activeCount}
              </span>
            )}
            <ChevronDown className={cn("h-3 w-3 transition-transform", showIndicators && "rotate-180")} />
          </button>

          <div className="mx-1 h-4 w-px bg-white/[0.08]" />
        </>
      )}

      {/* SMC toggle */}
      {onToggleSmc !== undefined && (
        <>
          <button
            onClick={onToggleSmc}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              smcEnabled
                ? "bg-[#0EA5E9]/15 text-[#0EA5E9]"
                : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            SMC
          </button>

          <div className="mx-1 h-4 w-px bg-white/[0.08]" />
        </>
      )}

      <button
        onClick={onClear}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Clear
      </button>

      <button
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save
      </button>

      {/* Indicator dropdown panel */}
      {showIndicators && indicators && onToggleIndicator && (
        <div className="absolute top-full left-0 mt-1 z-50 rounded-lg glass border border-white/[0.06] p-2 shadow-xl min-w-[260px]">
          <div className="grid grid-cols-3 gap-1">
            {INDICATOR_DEFS.map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => onToggleIndicator(key)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium transition-colors text-left",
                  indicators[key]
                    ? "bg-white/[0.06] text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.04]"
                )}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: indicators[key] ? color : "rgba(255,255,255,0.15)" }}
                />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
