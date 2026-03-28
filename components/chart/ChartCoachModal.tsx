"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Camera, Settings2, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SmcResult } from "@/lib/smc-engine";
import type { Drawing } from "./ChartDrawingOverlay";

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  image?: string;
}

export interface CoachSettings {
  methodology: string[];
  concepts: string[];
  responseStyle: string;
  riskStyle: string;
  customRules: string;
}

export const DEFAULT_COACH_SETTINGS: CoachSettings = {
  methodology: ["smc", "price-action"],
  concepts: ["bos-choch", "order-blocks", "pdh-pdl"],
  responseStyle: "short-direct",
  riskStyle: "moderate",
  customRules: "",
};

const COACH_SETTINGS_KEY = "tf:coach-settings";
const COACH_MODEL_KEY = "tf:coach-model";

function loadCoachSettings(): CoachSettings {
  try {
    const raw = localStorage.getItem(COACH_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_COACH_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_COACH_SETTINGS };
}

function saveCoachSettings(s: CoachSettings) {
  try { localStorage.setItem(COACH_SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

function loadModel(): string {
  try { return localStorage.getItem(COACH_MODEL_KEY) || "gpt-4.1"; } catch { return "gpt-4.1"; }
}

function saveModel(m: string) {
  try { localStorage.setItem(COACH_MODEL_KEY, m); } catch {}
}

// ── Context builder ──────────────────────────────────────────────────────────

function buildChartContext(
  symbol: string, timeframe: string, price: number | null,
  smcData: SmcResult | null, drawings: Drawing[],
): string {
  const parts: string[] = ["=== CHART CONTEXT ==="];
  parts.push(`Symbol: ${symbol} | Timeframe: ${timeframe} | Price: ${price ?? "N/A"}`);

  if (smcData) {
    const { structures, orderBlocks, fvgs, previousLevels, premiumDiscount } = smcData;
    if (structures.length > 0) {
      const recent = structures.slice(-3);
      parts.push(`Recent structure: ${recent.map((s) => `${s.type.toUpperCase()} ${s.direction} at ${s.price.toFixed(2)}`).join(", ")}`);
    }
    if (orderBlocks.length > 0) {
      parts.push(`Order Blocks: ${orderBlocks.slice(-3).map((ob) => `${ob.direction} OB ${ob.low.toFixed(2)}-${ob.high.toFixed(2)}`).join(", ")}`);
    }
    if (fvgs.length > 0) {
      parts.push(`FVGs: ${fvgs.slice(-3).map((f) => `${f.direction} ${f.low.toFixed(2)}-${f.high.toFixed(2)}`).join(", ")}`);
    }
    const lvl = previousLevels;
    const lvlParts: string[] = [];
    if (lvl.pdh != null) lvlParts.push(`PDH: ${lvl.pdh.toFixed(2)}`);
    if (lvl.pdl != null) lvlParts.push(`PDL: ${lvl.pdl.toFixed(2)}`);
    if (lvl.pwh != null) lvlParts.push(`PWH: ${lvl.pwh.toFixed(2)}`);
    if (lvl.pwl != null) lvlParts.push(`PWL: ${lvl.pwl.toFixed(2)}`);
    if (lvlParts.length > 0) parts.push(`Levels: ${lvlParts.join(", ")}`);
    if (premiumDiscount) {
      parts.push(`Premium/Discount: High ${premiumDiscount.high.toFixed(2)}, Eq ${premiumDiscount.eq.toFixed(2)}, Low ${premiumDiscount.low.toFixed(2)}`);
    }
  }

  if (drawings.length > 0) {
    const lines = drawings.filter((d) => d.type === "line");
    const zones = drawings.filter((d) => d.type === "zone");
    const drawParts: string[] = [];
    if (lines.length) drawParts.push(`${lines.length} level(s) at ${lines.map((l) => l.price.toFixed(2)).join(", ")}`);
    if (zones.length) drawParts.push(`${zones.length} zone(s)`);
    if (drawParts.length > 0) parts.push(`Drawings: ${drawParts.join("; ")}`);
  }

  return parts.join("\n");
}

// ── Settings definitions ─────────────────────────────────────────────────────

const METHODOLOGIES = [
  { key: "smc", label: "SMC" },
  { key: "price-action", label: "Price Action" },
  { key: "support-resistance", label: "S/R" },
  { key: "indicators", label: "Indicators" },
  { key: "trend-following", label: "Trend" },
  { key: "scalping", label: "Scalping" },
  { key: "swing-trading", label: "Swing" },
  { key: "custom", label: "Custom" },
];

const CONCEPTS = [
  { key: "bos-choch", label: "BOS/CHoCH" },
  { key: "order-blocks", label: "OB/FVG" },
  { key: "pdh-pdl", label: "PDH/PDL" },
  { key: "ema-sma", label: "EMA/SMA" },
  { key: "rsi-macd", label: "RSI/MACD" },
  { key: "liquidity", label: "Liquidity" },
  { key: "premium-discount", label: "Prem/Disc" },
  { key: "session", label: "Session" },
];

const STYLES = [
  { key: "short-direct", label: "Short & Direct" },
  { key: "detailed", label: "Detailed" },
  { key: "beginner-friendly", label: "Beginner" },
  { key: "advanced-trader", label: "Advanced" },
  { key: "sniper-entry", label: "Sniper Entry" },
  { key: "educational", label: "Educational" },
];

const RISKS = [
  { key: "conservative", label: "Conservative" },
  { key: "moderate", label: "Moderate" },
  { key: "aggressive", label: "Aggressive" },
];

const MODELS = [
  { key: "gpt-4.1", label: "GPT-4.1" },
  { key: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { key: "gpt-4o", label: "GPT-4o" },
  { key: "o4-mini", label: "o4-mini" },
];

// ── Props ────────────────────────────────────────────────────────────────────

interface ChartCoachModalProps {
  open: boolean;
  onClose: () => void;
  symbol: string;
  timeframe: string;
  price: number | null;
  smcData: SmcResult | null;
  drawings: Drawing[];
  captureScreenshot: () => string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ChartCoachModal({
  open, onClose, symbol, timeframe, price,
  smcData, drawings, captureScreenshot,
}: ChartCoachModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [model, setModel] = useState(() => loadModel());
  const [settings, setSettings] = useState<CoachSettings>(() => loadCoachSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSentInitial = useRef(false);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Auto-send initial context on open
  useEffect(() => {
    if (!open || hasSentInitial.current || messages.length > 0) return;
    hasSentInitial.current = true;

    const ctx = buildChartContext(symbol, timeframe, price, smcData, drawings);
    const autoMsg = `Analyze this chart for me.\n\n${ctx}`;
    sendMessage(autoMsg);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset on close
  useEffect(() => {
    if (!open) {
      hasSentInitial.current = false;
      setMessages([]);
      setPendingImage(null);
      setShowSettings(false);
      setShowModelDropdown(false);
    }
  }, [open]);

  const sendMessage = useCallback(async (text: string, image?: string) => {
    if (!text.trim() && !image) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim(), image };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setPendingImage(null);
    setLoading(true);

    try {
      const ctx = buildChartContext(symbol, timeframe, price, smcData, drawings);
      const res = await fetch("/api/chart-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          chartContext: ctx,
          coachSettings: settings,
          model,
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "Failed to get response." }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection error." }]);
    }
    setLoading(false);
  }, [messages, symbol, timeframe, price, smcData, drawings, settings, model]);

  function handleSend() {
    sendMessage(input, pendingImage ?? undefined);
  }

  function handleCapture() {
    const dataUrl = captureScreenshot();
    if (dataUrl) setPendingImage(dataUrl);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function updateSettings(patch: Partial<CoachSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveCoachSettings(next);
      return next;
    });
  }

  function toggleArray(arr: string[], key: string): string[] {
    return arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key];
  }

  function handleModelChange(m: string) {
    setModel(m);
    saveModel(m);
    setShowModelDropdown(false);
  }

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col rounded-xl glass border border-white/[0.08] shadow-2xl shadow-black/40" style={{ width: 380, height: 500 }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-foreground truncate">Chart Coach — {symbol}</span>
          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => { setShowModelDropdown((v) => !v); setShowSettings(false); }}
              className="flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-white/[0.1] transition-colors"
            >
              {MODELS.find((m) => m.key === model)?.label ?? model}
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
            {showModelDropdown && (
              <div className="absolute top-full left-0 mt-1 rounded-lg glass border border-white/[0.06] py-1 shadow-xl z-50 min-w-[120px]">
                {MODELS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => handleModelChange(m.key)}
                    className={cn(
                      "block w-full text-left px-3 py-1 text-xs transition-colors",
                      model === m.key ? "text-[#0EA5E9] bg-white/[0.06]" : "text-muted-foreground hover:bg-white/[0.04]"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setShowSettings((v) => !v); setShowModelDropdown(false); }}
            className={cn(
              "rounded p-1 transition-colors",
              showSettings ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Settings panel ─────────────────────────────────────────── */}
      {showSettings && (
        <div className="border-b border-white/[0.06] px-3 py-2 space-y-2 max-h-[260px] overflow-y-auto shrink-0">
          {/* Methodology */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Methodology</p>
            <div className="flex flex-wrap gap-1">
              {METHODOLOGIES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => updateSettings({ methodology: toggleArray(settings.methodology, m.key) })}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                    settings.methodology.includes(m.key) ? "bg-[#0EA5E9]/15 text-[#0EA5E9]" : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {/* Concepts */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Concepts</p>
            <div className="flex flex-wrap gap-1">
              {CONCEPTS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => updateSettings({ concepts: toggleArray(settings.concepts, c.key) })}
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
                    settings.concepts.includes(c.key) ? "bg-[#8B5CF6]/15 text-[#8B5CF6]" : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          {/* Style + Risk */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Style</p>
              <select
                value={settings.responseStyle}
                onChange={(e) => updateSettings({ responseStyle: e.target.value })}
                className="w-full rounded bg-white/[0.06] border border-white/[0.08] px-1.5 py-1 text-[10px] text-foreground focus:outline-none"
              >
                {STYLES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Risk</p>
              <select
                value={settings.riskStyle}
                onChange={(e) => updateSettings({ riskStyle: e.target.value })}
                className="w-full rounded bg-white/[0.06] border border-white/[0.08] px-1.5 py-1 text-[10px] text-foreground focus:outline-none"
              >
                {RISKS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
          </div>
          {/* Custom Rules */}
          {settings.methodology.includes("custom") && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Custom Rules</p>
              <textarea
                value={settings.customRules}
                onChange={(e) => updateSettings({ customRules: e.target.value })}
                placeholder="Define your analysis rules..."
                rows={3}
                className="w-full rounded bg-white/[0.06] border border-white/[0.08] px-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#0EA5E9]/40 resize-none"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Messages ───────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed",
              msg.role === "user"
                ? "bg-[#0EA5E9]/15 text-foreground"
                : "bg-white/[0.04] text-foreground border border-white/[0.06]"
            )}>
              {msg.image && (
                <img src={msg.image} alt="Chart" className="rounded mb-1.5 max-h-32 w-auto" />
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Pending image preview ──────────────────────────────────── */}
      {pendingImage && (
        <div className="px-3 pb-1 shrink-0">
          <div className="relative inline-block">
            <img src={pendingImage} alt="Attached" className="h-12 rounded border border-white/[0.08]" />
            <button
              onClick={() => setPendingImage(null)}
              className="absolute -top-1 -right-1 rounded-full bg-black/70 p-0.5"
            >
              <X className="h-2.5 w-2.5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ── Input area ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-white/[0.06] shrink-0">
        <button
          onClick={handleCapture}
          disabled={loading}
          className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          title="Capture chart screenshot"
        >
          <Camera className="h-4 w-4" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this chart..."
          disabled={loading}
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={loading || (!input.trim() && !pendingImage)}
          className="rounded p-1.5 text-[#0EA5E9] hover:bg-[#0EA5E9]/15 transition-colors disabled:opacity-30"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
