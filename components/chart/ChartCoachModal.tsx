"use client";

import { useState, useRef, useEffect, useCallback, type DragEvent } from "react";
import {
  X, Send, Camera, Settings2, ChevronDown, Loader2, Upload, Link2,
  FileText, Sparkles, Check, ArrowLeft, Pencil, Trash2, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SmcResult } from "@/lib/smc-engine";
import type { Drawing } from "./ChartDrawingOverlay";
import {
  type SavedStrategy,
  loadStrategies, saveStrategies as persistStrategies,
  loadActiveStrategyId, saveActiveStrategyId,
} from "@/lib/strategy-store";

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

// ── Storage helpers ──────────────────────────────────────────────────────────

const SETTINGS_KEY = "tf:coach-settings";
const MODEL_KEY = "tf:coach-model";

function loadSettings(): CoachSettings {
  try { const r = localStorage.getItem(SETTINGS_KEY); return r ? { ...DEFAULT_COACH_SETTINGS, ...JSON.parse(r) } : { ...DEFAULT_COACH_SETTINGS }; } catch { return { ...DEFAULT_COACH_SETTINGS }; }
}
function saveSettings(s: CoachSettings) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {} }
function loadModel(): string { try { return localStorage.getItem(MODEL_KEY) || "gpt-4.1"; } catch { return "gpt-4.1"; } }
function saveModel(m: string) { try { localStorage.setItem(MODEL_KEY, m); } catch {} }
function loadActiveId(): string | null { return loadActiveStrategyId(); }
function saveActiveId(id: string | null) { saveActiveStrategyId(id); }
function saveStrategies(s: SavedStrategy[]) { persistStrategies(s); }

// ── Chart context builder ────────────────────────────────────────────────────

function buildChartContext(symbol: string, timeframe: string, price: number | null, smcData: SmcResult | null, drawings: Drawing[]): string {
  const p: string[] = ["=== CHART CONTEXT ===", `Symbol: ${symbol} | Timeframe: ${timeframe} | Price: ${price ?? "N/A"}`];
  if (smcData) {
    const { structures, orderBlocks, fvgs, previousLevels, premiumDiscount } = smcData;
    if (structures.length > 0) p.push(`Recent structure: ${structures.slice(-3).map((s) => `${s.type.toUpperCase()} ${s.direction} at ${s.price.toFixed(2)}`).join(", ")}`);
    if (orderBlocks.length > 0) p.push(`Order Blocks: ${orderBlocks.slice(-3).map((ob) => `${ob.direction} OB ${ob.low.toFixed(2)}-${ob.high.toFixed(2)}`).join(", ")}`);
    if (fvgs.length > 0) p.push(`FVGs: ${fvgs.slice(-3).map((f) => `${f.direction} ${f.low.toFixed(2)}-${f.high.toFixed(2)}`).join(", ")}`);
    const lv = previousLevels;
    const lvp: string[] = [];
    if (lv.pdh != null) lvp.push(`PDH: ${lv.pdh.toFixed(2)}`);
    if (lv.pdl != null) lvp.push(`PDL: ${lv.pdl.toFixed(2)}`);
    if (lvp.length) p.push(`Levels: ${lvp.join(", ")}`);
    if (premiumDiscount) p.push(`Prem/Disc: H${premiumDiscount.high.toFixed(2)} Eq${premiumDiscount.eq.toFixed(2)} L${premiumDiscount.low.toFixed(2)}`);
  }
  if (drawings.length > 0) {
    const lines = drawings.filter((d) => d.type === "line");
    const zones = drawings.filter((d) => d.type === "zone");
    const dp: string[] = [];
    if (lines.length) dp.push(`${lines.length} level(s) at ${lines.map((l) => l.price.toFixed(2)).join(", ")}`);
    if (zones.length) dp.push(`${zones.length} zone(s)`);
    if (dp.length) p.push(`Drawings: ${dp.join("; ")}`);
  }
  return p.join("\n");
}

// ── Constants ────────────────────────────────────────────────────────────────

const METHODOLOGIES = [
  { key: "smc", label: "SMC" }, { key: "price-action", label: "Price Action" },
  { key: "support-resistance", label: "S/R" }, { key: "indicators", label: "Indicators" },
  { key: "trend-following", label: "Trend" }, { key: "scalping", label: "Scalping" },
  { key: "swing-trading", label: "Swing" }, { key: "custom", label: "Custom" },
];
const CONCEPTS = [
  { key: "bos-choch", label: "BOS/CHoCH" }, { key: "order-blocks", label: "OB/FVG" },
  { key: "pdh-pdl", label: "PDH/PDL" }, { key: "ema-sma", label: "EMA/SMA" },
  { key: "rsi-macd", label: "RSI/MACD" }, { key: "liquidity", label: "Liquidity" },
  { key: "premium-discount", label: "Prem/Disc" }, { key: "session", label: "Session" },
];
const STYLES = [
  { key: "short-direct", label: "Short & Direct" }, { key: "detailed", label: "Detailed" },
  { key: "beginner-friendly", label: "Beginner" }, { key: "advanced-trader", label: "Advanced" },
  { key: "sniper-entry", label: "Sniper Entry" }, { key: "educational", label: "Educational" },
];
const RISKS = [
  { key: "conservative", label: "Conservative" }, { key: "moderate", label: "Moderate" },
  { key: "aggressive", label: "Aggressive" },
];
const MODELS = [
  { key: "gpt-4.1", label: "GPT-4.1" }, { key: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { key: "gpt-4o", label: "GPT-4o" }, { key: "o4-mini", label: "o4-mini" },
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

type View = "onboarding" | "extracting" | "confirm" | "manage" | "chat";

// ── Main component ───────────────────────────────────────────────────────────

export function ChartCoachModal({ open, onClose, symbol, timeframe, price, smcData, drawings, captureScreenshot }: ChartCoachModalProps) {
  const [view, setView] = useState<View>("chat");
  const [strategies, setStrategies] = useState<SavedStrategy[]>(() => loadStrategies());
  const [activeId, setActiveId] = useState<string | null>(() => loadActiveId());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [model, setModel] = useState(() => loadModel());
  const [settings, setSettings] = useState<CoachSettings>(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [showModelDD, setShowModelDD] = useState(false);

  // Onboarding state
  const [strategyText, setStrategyText] = useState("");
  const [strategyUrl, setStrategyUrl] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; data: string }[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<{ summary: string; rules: string[]; methodology: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewingStrategy, setViewingStrategy] = useState<SavedStrategy | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasSentInitial = useRef(false);

  const activeStrategy = strategies.find((s) => s.id === activeId) ?? null;

  // Decide initial view on open
  useEffect(() => {
    if (!open) {
      hasSentInitial.current = false;
      setMessages([]);
      setPendingImage(null);
      setShowSettings(false);
      setShowModelDD(false);
      setExtracted(null);
      setStrategyText("");
      setStrategyUrl("");
      setUploadedFiles([]);
      setViewingStrategy(null);
      return;
    }
    // Reload from storage
    const strats = loadStrategies();
    const aid = loadActiveId();
    setStrategies(strats);
    setActiveId(aid);
    const hasActive = strats.some((s) => s.id === aid);
    setView(hasActive ? "chat" : "onboarding");
  }, [open]);

  // Scroll chat
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Auto-send initial message
  useEffect(() => {
    if (view !== "chat" || !open || hasSentInitial.current || messages.length > 0) return;
    hasSentInitial.current = true;
    const ctx = buildChartContext(symbol, timeframe, price, smcData, drawings);
    const autoMsg = `Analyze this chart for me.\n\n${ctx}`;
    doSendMessage(autoMsg);
  }, [view, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Strategy helpers ─────────────────────────────────────────────────────

  function setActive(id: string) {
    setActiveId(id);
    saveActiveId(id);
  }

  function addStrategy(strat: SavedStrategy) {
    const next = [...strategies, strat];
    setStrategies(next);
    saveStrategies(next);
    setActive(strat.id);
  }

  function removeStrategy(id: string) {
    const next = strategies.filter((s) => s.id !== id);
    setStrategies(next);
    saveStrategies(next);
    if (activeId === id) { saveActiveId(null); setActiveId(null); }
    setDeleteConfirm(null);
  }

  function renameStrategy(id: string, name: string) {
    const next = strategies.map((s) => s.id === id ? { ...s, name } : s);
    setStrategies(next);
    saveStrategies(next);
    setEditingId(null);
  }

  // ── Extraction ───────────────────────────────────────────────────────────

  async function extractStrategy(source: "text" | "url" | "file" | "smc") {
    setExtracting(true);
    setView("extracting");
    try {
      const payload: Record<string, unknown> = {};
      if (source === "smc") payload.smc = true;
      if (source === "text") payload.text = strategyText;
      if (source === "url") payload.url = strategyUrl;
      if (source === "file") payload.files = uploadedFiles;

      const res = await fetch("/api/chart-coach/extract-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.summary) {
        setExtracted(data);
        setNewName(source === "smc" ? "SMC Strategy" : "My Strategy");
        setView("confirm");
      } else {
        setView("onboarding");
      }
    } catch {
      setView("onboarding");
    }
    setExtracting(false);
  }

  function confirmStrategy() {
    if (!extracted) return;
    const source: SavedStrategy["source"] =
      strategyUrl ? "url" : uploadedFiles.length > 0 ? "file" : strategyText ? "text" : "preset";
    const strat: SavedStrategy = {
      id: crypto.randomUUID(),
      name: newName.trim() || "My Strategy",
      source,
      summary: extracted.summary,
      rules: extracted.rules,
      methodologyTags: [extracted.methodology?.toLowerCase() ?? "mixed"],
      marketTags: [],
      difficulty: "intermediate",
      created_at: new Date().toISOString(),
    };
    addStrategy(strat);
    setExtracted(null);
    setStrategyText("");
    setStrategyUrl("");
    setUploadedFiles([]);
    setView("chat");
  }

  // ── File handling ────────────────────────────────────────────────────────

  function handleFiles(fileList: FileList) {
    Array.from(fileList).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setUploadedFiles((prev) => [...prev, { name: file.name, data: reader.result as string }]);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }

  // ── Chat ─────────────────────────────────────────────────────────────────

  const doSendMessage = useCallback(async (text: string, image?: string) => {
    if (!text.trim() && !image) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim(), image };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setInput("");
    setPendingImage(null);
    setLoading(true);
    try {
      const ctx = buildChartContext(symbol, timeframe, price, smcData, drawings);
      const strat = activeStrategy;
      const res = await fetch("/api/chart-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMsgs,
          chartContext: ctx,
          coachSettings: settings,
          strategyProfile: strat ? { name: strat.name, summary: strat.summary, rules: strat.rules, methodology: strat.methodologyTags.join(", ") } : undefined,
          model,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? "No response." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection error." }]);
    }
    setLoading(false);
  }, [messages, symbol, timeframe, price, smcData, drawings, settings, model, activeStrategy]);

  function handleSend() { doSendMessage(input, pendingImage ?? undefined); }
  function handleCapture() { const d = captureScreenshot(); if (d) setPendingImage(d); }
  function handleKey(e: React.KeyboardEvent) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }
  function updateSettings(patch: Partial<CoachSettings>) { setSettings((prev) => { const n = { ...prev, ...patch }; saveSettings(n); return n; }); }
  function toggleArr(arr: string[], k: string) { return arr.includes(k) ? arr.filter((v) => v !== k) : [...arr, k]; }
  function handleModelChange(m: string) { setModel(m); saveModel(m); setShowModelDD(false); }

  if (!open) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col rounded-xl glass border border-white/[0.08] shadow-2xl shadow-black/40" style={{ width: 400, height: 520 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {(view === "manage" || view === "confirm") && (
            <button onClick={() => setView(activeStrategy ? "chat" : "onboarding")} className="rounded p-0.5 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /></button>
          )}
          <span className="text-xs font-bold text-foreground truncate">
            Chart Coach — {symbol}
            {activeStrategy && view === "chat" && <span className="text-muted-foreground font-normal"> · {activeStrategy.name}</span>}
          </span>
          {view === "chat" && (
            <div className="relative">
              <button onClick={() => { setShowModelDD((v) => !v); setShowSettings(false); }} className="flex items-center gap-0.5 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-white/[0.1]">
                {MODELS.find((m) => m.key === model)?.label ?? model}
                <ChevronDown className="h-2.5 w-2.5" />
              </button>
              {showModelDD && (
                <div className="absolute top-full left-0 mt-1 rounded-lg glass border border-white/[0.06] py-1 shadow-xl z-50 min-w-[120px]">
                  {MODELS.map((m) => (
                    <button key={m.key} onClick={() => handleModelChange(m.key)} className={cn("block w-full text-left px-3 py-1 text-xs", model === m.key ? "text-[#0EA5E9] bg-white/[0.06]" : "text-muted-foreground hover:bg-white/[0.04]")}>{m.label}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {view === "chat" && (
            <>
              <button onClick={() => { setView("manage"); setShowSettings(false); }} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-white/[0.06]">Change</button>
              <button onClick={() => { setShowSettings((v) => !v); setShowModelDD(false); }} className={cn("rounded p-1", showSettings ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground")}>
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* ────────────────── ONBOARDING VIEW ────────────────── */}
      {view === "onboarding" && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="text-center">
            <p className="text-sm font-bold text-foreground">Teach Your Coach Your Strategy</p>
            <p className="text-[11px] text-muted-foreground mt-1">Upload your strategy from any source so the coach can analyze charts your way.</p>
          </div>

          {/* SMC preset */}
          <button onClick={() => extractStrategy("smc")} className="w-full rounded-lg bg-[#0EA5E9]/10 border border-[#0EA5E9]/20 px-4 py-3 text-left hover:bg-[#0EA5E9]/15 transition-colors">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#0EA5E9] shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#0EA5E9]">Use Smart Money Concepts (SMC)</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Pre-built SMC rules — no upload needed</p>
              </div>
            </div>
          </button>

          {/* Upload files */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn("rounded-lg border-2 border-dashed px-4 py-3 text-center cursor-pointer transition-colors", dragOver ? "border-[#0EA5E9]/50 bg-[#0EA5E9]/5" : "border-white/[0.08] hover:border-white/[0.15]")}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
            <p className="text-[11px] text-muted-foreground">Drop files here or click to upload</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">PDF, JPEG, PNG</p>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
          </div>
          {uploadedFiles.length > 0 && (
            <div className="space-y-1">
              {uploadedFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded bg-white/[0.04] px-2 py-1 text-[10px] text-foreground">
                  <span className="truncate">{f.name}</span>
                  <button onClick={() => setUploadedFiles((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400"><X className="h-3 w-3" /></button>
                </div>
              ))}
              <button onClick={() => extractStrategy("file")} disabled={extracting} className="w-full rounded-lg bg-[#8B5CF6]/15 px-3 py-2 text-xs font-semibold text-[#8B5CF6] hover:bg-[#8B5CF6]/25 disabled:opacity-50">
                Extract from files
              </button>
            </div>
          )}

          {/* URL */}
          <div className="flex gap-1.5">
            <div className="flex-1 flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] px-2 py-1.5">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input value={strategyUrl} onChange={(e) => setStrategyUrl(e.target.value)} placeholder="Paste URL..." className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
            </div>
            <button onClick={() => extractStrategy("url")} disabled={!strategyUrl.trim() || extracting} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white/[0.1] disabled:opacity-40">Load</button>
          </div>

          {/* Text */}
          <div>
            <textarea value={strategyText} onChange={(e) => setStrategyText(e.target.value)} placeholder="e.g. I trade SMC concepts, I look for BOS and CHoCH, I enter on order blocks..." rows={3} className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#0EA5E9]/40 resize-none" />
            {strategyText.trim() && (
              <button onClick={() => extractStrategy("text")} disabled={extracting} className="mt-1.5 w-full rounded-lg bg-[#8B5CF6]/15 px-3 py-2 text-xs font-semibold text-[#8B5CF6] hover:bg-[#8B5CF6]/25 disabled:opacity-50">Extract from text</button>
            )}
          </div>

          {/* Saved strategies */}
          {strategies.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">My Strategies</p>
                <button onClick={() => setView("manage")} className="text-[10px] text-[#0EA5E9] hover:underline">Manage</button>
              </div>
              {strategies.map((s) => (
                <button key={s.id} onClick={() => { setActive(s.id); setView("chat"); }} className={cn("w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors mb-1", s.id === activeId ? "bg-[#0EA5E9]/10 text-foreground" : "bg-white/[0.02] text-muted-foreground hover:bg-white/[0.06]")}>
                  <SourceIcon source={s.source} />
                  <span className="flex-1 truncate font-medium">{s.name}</span>
                  <ChevronRight className="h-3 w-3 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ────────────────── EXTRACTING VIEW ────────────────── */}
      {view === "extracting" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-[#0EA5E9] animate-spin" />
          <p className="text-sm font-medium text-foreground">Learning your strategy...</p>
          <p className="text-[11px] text-muted-foreground">Extracting rules and methodology</p>
        </div>
      )}

      {/* ────────────────── CONFIRM VIEW ────────────────── */}
      {view === "confirm" && extracted && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <p className="text-sm font-bold text-foreground">Strategy Extracted</p>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Name</p>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full rounded bg-white/[0.06] border border-white/[0.08] px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-[#0EA5E9]/40" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Summary</p>
            <p className="text-xs text-foreground leading-relaxed bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.06]">{extracted.summary}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Rules ({extracted.rules.length})</p>
            <ul className="space-y-1">
              {extracted.rules.map((r, i) => (
                <li key={i} className="flex gap-2 text-[11px] text-foreground"><span className="text-muted-foreground shrink-0">{i + 1}.</span>{r}</li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="rounded bg-[#8B5CF6]/15 px-2 py-0.5 text-[#8B5CF6] font-medium">{extracted.methodology}</span>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setView("onboarding")} className="flex-1 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-muted-foreground hover:bg-white/[0.06]">Back</button>
            <button onClick={confirmStrategy} className="flex-1 rounded-lg bg-[#0EA5E9]/15 px-3 py-2 text-xs font-semibold text-[#0EA5E9] hover:bg-[#0EA5E9]/25 flex items-center justify-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Confirm & Start
            </button>
          </div>
        </div>
      )}

      {/* ────────────────── MANAGE VIEW ────────────────── */}
      {view === "manage" && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">My Strategies</p>
            <button onClick={() => { setView("onboarding"); }} className="text-[10px] text-[#0EA5E9] hover:underline">+ Add New</button>
          </div>
          {strategies.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">No strategies saved yet</p>
          )}
          {strategies.map((s) => (
            <div key={s.id} className={cn("rounded-lg border px-3 py-2.5 space-y-1.5", s.id === activeId ? "border-[#0EA5E9]/30 bg-[#0EA5E9]/5" : "border-white/[0.06] bg-white/[0.02]")}>
              <div className="flex items-center gap-2">
                <SourceIcon source={s.source} />
                {editingId === s.id ? (
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") renameStrategy(s.id, editName); }} onBlur={() => renameStrategy(s.id, editName)} autoFocus className="flex-1 bg-transparent text-xs text-foreground border-b border-[#0EA5E9]/40 focus:outline-none" />
                ) : (
                  <span className="flex-1 text-xs font-medium text-foreground truncate">{s.name}</span>
                )}
                <span className="text-[10px] text-muted-foreground shrink-0">{new Date(s.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => { setActive(s.id); setMessages([]); hasSentInitial.current = false; setView("chat"); }} className={cn("rounded px-2 py-0.5 text-[10px] font-medium", s.id === activeId ? "bg-[#0EA5E9]/15 text-[#0EA5E9]" : "bg-white/[0.06] text-muted-foreground hover:text-foreground")}>
                  {s.id === activeId ? "Active" : "Select"}
                </button>
                <button onClick={() => setViewingStrategy(viewingStrategy?.id === s.id ? null : s)} className="rounded px-2 py-0.5 text-[10px] text-muted-foreground bg-white/[0.04] hover:bg-white/[0.08]">
                  {viewingStrategy?.id === s.id ? "Hide" : "View"}
                </button>
                <button onClick={() => { setEditingId(s.id); setEditName(s.name); }} className="rounded p-0.5 text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                {deleteConfirm === s.id ? (
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-[10px] text-red-400">Delete?</span>
                    <button onClick={() => removeStrategy(s.id)} className="text-[10px] text-red-400 font-bold hover:underline">Yes</button>
                    <button onClick={() => setDeleteConfirm(null)} className="text-[10px] text-muted-foreground hover:underline">No</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(s.id)} className="rounded p-0.5 text-muted-foreground hover:text-red-400 ml-auto"><Trash2 className="h-3 w-3" /></button>
                )}
              </div>
              {viewingStrategy?.id === s.id && (
                <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1.5">
                  <p className="text-[11px] text-foreground leading-relaxed">{s.summary}</p>
                  <ul className="space-y-0.5">
                    {s.rules.map((r, i) => <li key={i} className="text-[10px] text-muted-foreground">· {r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ────────────────── CHAT VIEW ────────────────── */}
      {view === "chat" && (
        <>
          {/* Settings panel */}
          {showSettings && (
            <div className="border-b border-white/[0.06] px-3 py-2 space-y-2 max-h-[220px] overflow-y-auto shrink-0">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Methodology</p>
                <div className="flex flex-wrap gap-1">
                  {METHODOLOGIES.map((m) => (<button key={m.key} onClick={() => updateSettings({ methodology: toggleArr(settings.methodology, m.key) })} className={cn("rounded px-2 py-0.5 text-[10px] font-medium", settings.methodology.includes(m.key) ? "bg-[#0EA5E9]/15 text-[#0EA5E9]" : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]")}>{m.label}</button>))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Concepts</p>
                <div className="flex flex-wrap gap-1">
                  {CONCEPTS.map((c) => (<button key={c.key} onClick={() => updateSettings({ concepts: toggleArr(settings.concepts, c.key) })} className={cn("rounded px-2 py-0.5 text-[10px] font-medium", settings.concepts.includes(c.key) ? "bg-[#8B5CF6]/15 text-[#8B5CF6]" : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]")}>{c.label}</button>))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Style</p>
                  <select value={settings.responseStyle} onChange={(e) => updateSettings({ responseStyle: e.target.value })} className="w-full rounded bg-white/[0.06] border border-white/[0.08] px-1.5 py-1 text-[10px] text-foreground focus:outline-none">
                    {STYLES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Risk</p>
                  <select value={settings.riskStyle} onChange={(e) => updateSettings({ riskStyle: e.target.value })} className="w-full rounded bg-white/[0.06] border border-white/[0.08] px-1.5 py-1 text-[10px] text-foreground focus:outline-none">
                    {RISKS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed", msg.role === "user" ? "bg-[#0EA5E9]/15 text-foreground" : "bg-white/[0.04] text-foreground border border-white/[0.06]")}>
                  {msg.image && <img src={msg.image} alt="Chart" className="rounded mb-1.5 max-h-32 w-auto" />}
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

          {/* Pending image */}
          {pendingImage && (
            <div className="px-3 pb-1 shrink-0">
              <div className="relative inline-block">
                <img src={pendingImage} alt="Attached" className="h-12 rounded border border-white/[0.08]" />
                <button onClick={() => setPendingImage(null)} className="absolute -top-1 -right-1 rounded-full bg-black/70 p-0.5"><X className="h-2.5 w-2.5 text-white" /></button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-t border-white/[0.06] shrink-0">
            <button onClick={handleCapture} disabled={loading} className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/[0.06] disabled:opacity-50" title="Capture chart">
              <Camera className="h-4 w-4" />
            </button>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Ask about this chart..." disabled={loading} className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50" />
            <button onClick={handleSend} disabled={loading || (!input.trim() && !pendingImage)} className="rounded p-1.5 text-[#0EA5E9] hover:bg-[#0EA5E9]/15 disabled:opacity-30">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Source icon helper ────────────────────────────────────────────────────────

function SourceIcon({ source }: { source: SavedStrategy["source"] }) {
  const cls = "h-3.5 w-3.5 shrink-0 text-muted-foreground";
  switch (source) {
    case "preset": return <Sparkles className={cn(cls, "text-[#0EA5E9]")} />;
    case "file": return <FileText className={cls} />;
    case "url": return <Link2 className={cls} />;
    case "text": return <FileText className={cls} />;
  }
}
