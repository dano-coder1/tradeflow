"use client";

import { useState } from "react";
import { Minus, Square, Trash2, Save, Loader2, BarChart3, ChevronDown, Sparkles, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Drawing tool types ──────────────────────────────────────────────────────

export type DrawingTool = "line" | "zone" | null;

// ── Indicator visibility ────────────────────────────────────────────────────

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

// ── SMC Settings ────────────────────────────────────────────────────────────

export interface SmcSettings {
  showBosChoch: boolean;
  showOrderBlocks: boolean;
  showFvg: boolean;
  showPremiumDiscount: boolean;
  showPdhl: boolean;
  showPwhl: boolean;
  showPmhl: boolean;
  swingLookback: number;
  maxOrderBlocks: number;
  maxFvgs: number;
  obBoxMode: "highlow" | "body";
  zoneOpacity: number;
  fvgOpacity: number;
  obOpacity: number;
}

export const DEFAULT_SMC_SETTINGS: SmcSettings = {
  showBosChoch: true,
  showOrderBlocks: true,
  showFvg: true,
  showPremiumDiscount: true,
  showPdhl: true,
  showPwhl: false,
  showPmhl: false,
  swingLookback: 3,
  maxOrderBlocks: 3,
  maxFvgs: 3,
  obBoxMode: "body",
  zoneOpacity: 0.15,
  fvgOpacity: 0.12,
  obOpacity: 0.10,
};

// ── Toolbar props ───────────────────────────────────────────────────────────

interface ChartToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onClear: () => void;
  onSave: () => void;
  saving: boolean;
  indicators?: IndicatorVisibility;
  onToggleIndicator?: (key: keyof IndicatorVisibility) => void;
  smcSettings?: SmcSettings;
  onSmcSettingsChange?: (s: SmcSettings) => void;
}

// ── Toolbar component ───────────────────────────────────────────────────────

export function ChartToolbar({
  activeTool, onToolChange, onClear, onSave, saving,
  indicators, onToggleIndicator,
  smcSettings, onSmcSettingsChange,
}: ChartToolbarProps) {
  const [showIndicators, setShowIndicators] = useState(false);
  const [showSmcPanel, setShowSmcPanel] = useState(false);

  const tools: { key: DrawingTool; label: string; icon: typeof Minus }[] = [
    { key: "line", label: "Line", icon: Minus },
    { key: "zone", label: "Zone", icon: Square },
  ];

  const activeCount = indicators ? Object.values(indicators).filter(Boolean).length : 0;

  const smcAnyOn = smcSettings
    ? smcSettings.showBosChoch || smcSettings.showOrderBlocks || smcSettings.showFvg
      || smcSettings.showPremiumDiscount || smcSettings.showPdhl || smcSettings.showPwhl || smcSettings.showPmhl
    : false;

  function patchSmc(patch: Partial<SmcSettings>) {
    if (!smcSettings || !onSmcSettingsChange) return;
    onSmcSettingsChange({ ...smcSettings, ...patch });
  }

  // Close panels on outside interaction
  function closeAll() {
    setShowIndicators(false);
    setShowSmcPanel(false);
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg glass px-2 py-1.5 relative">
      {/* Drawing tools */}
      {tools.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => { closeAll(); onToolChange(activeTool === key ? null : key); }}
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
            onClick={() => { setShowSmcPanel(false); setShowIndicators((v) => !v); }}
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
              <span className="rounded-full bg-white/[0.08] px-1.5 text-[10px] font-bold">{activeCount}</span>
            )}
            <ChevronDown className={cn("h-3 w-3 transition-transform", showIndicators && "rotate-180")} />
          </button>
          <div className="mx-1 h-4 w-px bg-white/[0.08]" />
        </>
      )}

      {/* SMC settings toggle */}
      {smcSettings && onSmcSettingsChange && (
        <>
          <button
            onClick={() => { setShowIndicators(false); setShowSmcPanel((v) => !v); }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              showSmcPanel
                ? "bg-[#0EA5E9]/15 text-[#0EA5E9]"
                : smcAnyOn
                  ? "bg-[#0EA5E9]/10 text-[#0EA5E9]/80"
                  : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            SMC
            <Settings2 className="h-3 w-3" />
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

      {/* ── Indicator dropdown panel ─────────────────────────────────── */}
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

      {/* ── SMC settings panel ───────────────────────────────────────── */}
      {showSmcPanel && smcSettings && onSmcSettingsChange && (
        <SmcSettingsPanel settings={smcSettings} onChange={patchSmc} />
      )}
    </div>
  );
}

// ── SMC settings panel (sub-component) ──────────────────────────────────────

function SmcSettingsPanel({ settings, onChange }: { settings: SmcSettings; onChange: (patch: Partial<SmcSettings>) => void }) {
  function Toggle({ label, checked, onToggle, color }: { label: string; checked: boolean; onToggle: () => void; color?: string }) {
    return (
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors text-left w-full",
          checked ? "bg-white/[0.06] text-foreground" : "text-muted-foreground hover:bg-white/[0.04]"
        )}
      >
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: checked ? (color || "#0EA5E9") : "rgba(255,255,255,0.15)" }}
        />
        {label}
      </button>
    );
  }

  function NumInput({ label, value, onValue, min, max }: { label: string; value: number; onValue: (n: number) => void; min: number; max: number }) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n) && n >= min && n <= max) onValue(n);
          }}
          className="w-12 rounded bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 text-xs text-foreground text-center focus:outline-none focus:border-[#0EA5E9]/40"
        />
      </div>
    );
  }

  function OpacitySlider({ label, value, onValue }: { label: string; value: number; onValue: (n: number) => void }) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1.5">
          <input
            type="range"
            min={0}
            max={50}
            value={Math.round(value * 100)}
            onChange={(e) => onValue(parseInt(e.target.value, 10) / 100)}
            className="w-16 h-1 accent-[#0EA5E9] cursor-pointer"
          />
          <span className="text-[10px] text-muted-foreground w-6 text-right">{Math.round(value * 100)}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-full right-0 mt-1 z-50 rounded-lg glass border border-white/[0.06] p-3 shadow-xl w-[280px] max-h-[420px] overflow-y-auto space-y-3">
      {/* Overlays */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Overlays</p>
        <div className="grid grid-cols-2 gap-1">
          <Toggle label="BOS / CHoCH" checked={settings.showBosChoch} onToggle={() => onChange({ showBosChoch: !settings.showBosChoch })} color="#34d399" />
          <Toggle label="Order Blocks" checked={settings.showOrderBlocks} onToggle={() => onChange({ showOrderBlocks: !settings.showOrderBlocks })} color="#3b82f6" />
          <Toggle label="FVG" checked={settings.showFvg} onToggle={() => onChange({ showFvg: !settings.showFvg })} color="#34d399" />
          <Toggle label="Prem / Disc" checked={settings.showPremiumDiscount} onToggle={() => onChange({ showPremiumDiscount: !settings.showPremiumDiscount })} color="#f87171" />
        </div>
      </div>

      {/* Levels */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Levels</p>
        <div className="grid grid-cols-3 gap-1">
          <Toggle label="PDH/PDL" checked={settings.showPdhl} onToggle={() => onChange({ showPdhl: !settings.showPdhl })} color="#eab308" />
          <Toggle label="PWH/PWL" checked={settings.showPwhl} onToggle={() => onChange({ showPwhl: !settings.showPwhl })} color="#06b6d4" />
          <Toggle label="PMH/PML" checked={settings.showPmhl} onToggle={() => onChange({ showPmhl: !settings.showPmhl })} color="#a855f7" />
        </div>
      </div>

      {/* Tuning */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Tuning</p>
        <div className="space-y-1.5">
          <NumInput label="Swing lookback" value={settings.swingLookback} onValue={(n) => onChange({ swingLookback: n })} min={1} max={10} />
          <NumInput label="Max OBs" value={settings.maxOrderBlocks} onValue={(n) => onChange({ maxOrderBlocks: n })} min={1} max={20} />
          <NumInput label="Max FVGs" value={settings.maxFvgs} onValue={(n) => onChange({ maxFvgs: n })} min={1} max={20} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">OB box mode</span>
            <select
              value={settings.obBoxMode}
              onChange={(e) => onChange({ obBoxMode: e.target.value as "highlow" | "body" })}
              className="rounded bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 text-xs text-foreground focus:outline-none focus:border-[#0EA5E9]/40"
            >
              <option value="body">Candle body</option>
              <option value="highlow">High / Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Opacity */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Opacity</p>
        <div className="space-y-1.5">
          <OpacitySlider label="Zones" value={settings.zoneOpacity} onValue={(n) => onChange({ zoneOpacity: n })} />
          <OpacitySlider label="Order Blocks" value={settings.obOpacity} onValue={(n) => onChange({ obOpacity: n })} />
          <OpacitySlider label="FVG" value={settings.fvgOpacity} onValue={(n) => onChange({ fvgOpacity: n })} />
        </div>
      </div>
    </div>
  );
}
