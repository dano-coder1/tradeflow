"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  X, CheckCircle, XCircle, HelpCircle, Shield, ShieldAlert, ShieldOff,
  Settings2, Save, MessageCircle, Plus, Zap, Pencil, Trash2, GripVertical,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SmcResult } from "@/lib/smc-engine";
import type { Drawing } from "./ChartDrawingOverlay";
import { getActiveStrategy, type SavedStrategy } from "@/lib/strategy-store";

// ── Types ────────────────────────────────────────────────────────────────────

type RuleStatus = "passed" | "failed" | "unknown";
type Decision = "valid" | "incomplete" | "no-trade";

interface ChecklistItem {
  id: string;
  label: string;
  enabled: boolean;
  autoKey: string | null; // non-null = auto-evaluatable rule key
}

interface StrategyChecklist {
  items: ChecklistItem[];
  minRR: number;
  autoEval: boolean;
}

// ── Per-strategy storage ─────────────────────────────────────────────────────

function profileKey(strategyId: string): string {
  return `tf:decision-profile:${strategyId}`;
}

function loadChecklist(strategyId: string): StrategyChecklist | null {
  try {
    const r = localStorage.getItem(profileKey(strategyId));
    return r ? JSON.parse(r) : null;
  } catch { return null; }
}

function saveChecklist(strategyId: string, cl: StrategyChecklist) {
  try { localStorage.setItem(profileKey(strategyId), JSON.stringify(cl)); } catch {}
}

// ── Build default checklist from strategy rules ──────────────────────────────

const AUTO_MATCHERS: { pattern: RegExp; autoKey: string }[] = [
  { pattern: /trend|bias|direction|htf/i, autoKey: "trend_aligned" },
  { pattern: /bos|break of structure/i, autoKey: "bos_confirmed" },
  { pattern: /choch|change of character/i, autoKey: "choch_confirmed" },
  { pattern: /order block|ob\b/i, autoKey: "entry_at_ob" },
  { pattern: /premium|discount|mid.?range/i, autoKey: "premium_discount" },
  { pattern: /liquidity|sweep/i, autoKey: "liquidity_taken" },
  { pattern: /fvg|fair value|imbalance/i, autoKey: "fvg_present" },
  { pattern: /r:?r|risk.?reward|minimum.*[12]/i, autoKey: "min_rr" },
  { pattern: /session|london|new york|asia/i, autoKey: "session_ok" },
];

function buildDefaultChecklist(strategy: SavedStrategy): StrategyChecklist {
  const items: ChecklistItem[] = strategy.rules.map((rule, i) => {
    const match = AUTO_MATCHERS.find((m) => m.pattern.test(rule));
    return {
      id: `rule-${i}-${Date.now()}`,
      label: rule,
      enabled: true,
      autoKey: match?.autoKey ?? null,
    };
  });
  return { items, minRR: 2, autoEval: true };
}

// ── Auto-evaluation ──────────────────────────────────────────────────────────

function autoEvaluateRule(autoKey: string, smcData: SmcResult | null, price: number | null): RuleStatus {
  if (!smcData) return "unknown";
  const { structures, orderBlocks, fvgs, premiumDiscount } = smcData;

  switch (autoKey) {
    case "trend_aligned": {
      if (structures.length === 0) return "unknown";
      return structures[structures.length - 1].type === "bos" ? "passed" : "unknown";
    }
    case "bos_confirmed": return structures.some((s) => s.type === "bos") ? "passed" : "failed";
    case "choch_confirmed": return structures.some((s) => s.type === "choch") ? "passed" : "failed";
    case "entry_at_ob": {
      if (!price || orderBlocks.length === 0) return "unknown";
      return orderBlocks.some((ob) => price >= ob.low && price <= ob.high) ? "passed" : "failed";
    }
    case "fvg_present": return fvgs.length > 0 ? "passed" : "failed";
    case "premium_discount": {
      if (!price || !premiumDiscount) return "unknown";
      return (price <= premiumDiscount.eq * 0.98 || price >= premiumDiscount.eq * 1.02) ? "passed" : "failed";
    }
    default: return "unknown";
  }
}

// ── Decision logic ───────────────────────────────────────────────────────────

function computeDecision(statuses: { label: string; status: RuleStatus }[]): { decision: Decision; confirmed: string[]; missing: string[]; blocking: string[] } {
  const confirmed = statuses.filter((c) => c.status === "passed").map((c) => c.label);
  const failed = statuses.filter((c) => c.status === "failed");
  const unknown = statuses.filter((c) => c.status === "unknown");
  const blocking = failed.map((c) => c.label);
  const missing = unknown.map((c) => c.label);

  if (failed.length > 0) return { decision: "no-trade", confirmed, missing, blocking };
  if (unknown.length > statuses.length * 0.5) return { decision: "incomplete", confirmed, missing, blocking };
  if (confirmed.length >= statuses.length * 0.6) return { decision: "valid", confirmed, missing, blocking };
  return { decision: "incomplete", confirmed, missing, blocking };
}

// ── Props ────────────────────────────────────────────────────────────────────

interface DecisionEngineProps {
  open: boolean;
  onClose: () => void;
  symbol: string;
  timeframe: string;
  price: number | null;
  smcData: SmcResult | null;
  drawings: Drawing[];
  onOpenCoach: () => void;
  onCreateTrade: () => void;
  onAnalyze: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DecisionEngine({
  open, onClose, symbol, timeframe, price,
  smcData, drawings, onOpenCoach, onCreateTrade, onAnalyze,
}: DecisionEngineProps) {
  const [activeStrategy, setActiveStrategy] = useState<SavedStrategy | null>(null);
  const [checklist, setChecklist] = useState<StrategyChecklist | null>(null);
  const [manualOverrides, setManualOverrides] = useState<Record<string, RuleStatus>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [newItemText, setNewItemText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Load strategy + checklist on open
  useEffect(() => {
    if (!open) return;
    const strat = getActiveStrategy();
    setActiveStrategy(strat);
    setManualOverrides({});
    if (strat) {
      const saved = loadChecklist(strat.id);
      setChecklist(saved ?? buildDefaultChecklist(strat));
    } else {
      setChecklist(null);
    }
  }, [open]);

  // Persist checklist changes
  const persist = useCallback((cl: StrategyChecklist) => {
    setChecklist(cl);
    if (activeStrategy) saveChecklist(activeStrategy.id, cl);
  }, [activeStrategy]);

  // ── Checklist mutations ────────────────────────────────────────────────────

  function addItem() {
    if (!newItemText.trim() || !checklist) return;
    const item: ChecklistItem = { id: `item-${Date.now()}`, label: newItemText.trim(), enabled: true, autoKey: null };
    persist({ ...checklist, items: [...checklist.items, item] });
    setNewItemText("");
  }

  function removeItem(id: string) {
    if (!checklist) return;
    persist({ ...checklist, items: checklist.items.filter((i) => i.id !== id) });
  }

  function toggleEnabled(id: string) {
    if (!checklist) return;
    persist({ ...checklist, items: checklist.items.map((i) => i.id === id ? { ...i, enabled: !i.enabled } : i) });
  }

  function commitEdit(id: string) {
    if (!checklist || !editText.trim()) { setEditingId(null); return; }
    persist({ ...checklist, items: checklist.items.map((i) => i.id === id ? { ...i, label: editText.trim() } : i) });
    setEditingId(null);
  }

  function toggleAutoKey(id: string) {
    if (!checklist) return;
    const item = checklist.items.find((i) => i.id === id);
    if (!item) return;
    // If it already has an autoKey, remove it. Otherwise try to match.
    const newAutoKey = item.autoKey ? null : (AUTO_MATCHERS.find((m) => m.pattern.test(item.label))?.autoKey ?? null);
    persist({ ...checklist, items: checklist.items.map((i) => i.id === id ? { ...i, autoKey: newAutoKey } : i) });
  }

  function toggleManual(id: string) {
    setManualOverrides((prev) => {
      const current = prev[id];
      const next = current === "passed" ? "failed" : current === "failed" ? undefined : "passed";
      const copy = { ...prev };
      if (next) copy[id] = next;
      else delete copy[id];
      return copy;
    });
  }

  // ── Build evaluated checks ─────────────────────────────────────────────────

  const evaluatedChecks = useMemo(() => {
    if (!checklist) return [];
    return checklist.items
      .filter((i) => i.enabled)
      .map((item) => {
        const override = manualOverrides[item.id];
        let status: RuleStatus;
        let auto = false;
        if (override) {
          status = override;
        } else if (checklist.autoEval && item.autoKey) {
          status = autoEvaluateRule(item.autoKey, smcData, price);
          auto = true;
        } else {
          status = "unknown";
        }
        return { id: item.id, label: item.label, status, auto, autoKey: item.autoKey };
      });
  }, [checklist, manualOverrides, smcData, price]);

  const { decision, confirmed, missing, blocking } = useMemo(
    () => computeDecision(evaluatedChecks),
    [evaluatedChecks],
  );

  function saveNotes() { setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2000); }

  if (!open) return null;

  // ── No strategy state ──────────────────────────────────────────────────────

  if (!activeStrategy) {
    return (
      <div className="fixed top-0 right-0 bottom-0 z-[60] w-[360px] flex flex-col glass-strong border-l border-white/[0.06] shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#0EA5E9]" />
            <span className="text-sm font-bold text-foreground">Decision Engine</span>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">No active strategy selected</p>
          <p className="text-[11px] text-muted-foreground/60">Select a strategy to build your decision checklist.</p>
          <Link href="/dashboard/strategy" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#0EA5E9]/15 px-4 py-2 text-xs font-semibold text-[#0EA5E9] hover:bg-[#0EA5E9]/25">
            Go to Strategy
          </Link>
        </div>
      </div>
    );
  }

  // ── Main panel ─────────────────────────────────────────────────────────────

  return (
    <div className="fixed top-0 right-0 bottom-0 z-[60] w-[360px] flex flex-col glass-strong border-l border-white/[0.06] shadow-2xl shadow-black/40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="h-4 w-4 text-[#0EA5E9] shrink-0" />
          <span className="text-sm font-bold text-foreground truncate">Decision Engine</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSettings((v) => !v)} className={cn("rounded p-1", showSettings ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* ── Settings ──────────────────────────────────────────────── */}
        {showSettings && checklist && (
          <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Auto-evaluate</span>
              <button onClick={() => persist({ ...checklist, autoEval: !checklist.autoEval })} className={cn("rounded px-2 py-0.5 text-[10px] font-medium", checklist.autoEval ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.06] text-muted-foreground")}>{checklist.autoEval ? "On" : "Off"}</button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Min R:R</span>
              <input type="number" min={1} max={10} step={0.5} value={checklist.minRR} onChange={(e) => persist({ ...checklist, minRR: parseFloat(e.target.value) || 2 })} className="w-14 rounded bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 text-xs text-foreground text-center focus:outline-none" />
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Manage Items</p>
            {checklist.items.map((item) => (
              <div key={item.id} className="flex items-center gap-1.5 rounded bg-white/[0.03] px-2 py-1 text-[10px]">
                <button onClick={() => toggleEnabled(item.id)} className={cn("rounded px-1 py-0.5 font-medium shrink-0", item.enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.06] text-muted-foreground")}>
                  {item.enabled ? "On" : "Off"}
                </button>
                <span className="flex-1 text-foreground truncate">{item.label}</span>
                <button onClick={() => toggleAutoKey(item.id)} title={item.autoKey ? `Auto: ${item.autoKey}` : "Manual"} className={cn("rounded px-1 py-0.5 text-[9px] shrink-0", item.autoKey ? "bg-[#0EA5E9]/10 text-[#0EA5E9]" : "bg-white/[0.04] text-muted-foreground")}>
                  {item.autoKey ? "auto" : "manual"}
                </button>
                <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-red-400 shrink-0"><Trash2 className="h-2.5 w-2.5" /></button>
              </div>
            ))}
            <div className="flex gap-1">
              <input value={newItemText} onChange={(e) => setNewItemText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} placeholder="Add checklist item..." className="flex-1 rounded bg-white/[0.06] border border-white/[0.08] px-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
              <button onClick={addItem} className="rounded bg-white/[0.06] px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">Add</button>
            </div>
          </div>
        )}

        {/* ── Context ───────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Context</p>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="rounded bg-white/[0.02] px-2 py-1"><span className="text-muted-foreground">Symbol</span> <span className="font-bold text-foreground ml-1">{symbol}</span></div>
            <div className="rounded bg-white/[0.02] px-2 py-1"><span className="text-muted-foreground">TF</span> <span className="font-bold text-foreground ml-1">{timeframe}</span></div>
            <div className="rounded bg-white/[0.02] px-2 py-1"><span className="text-muted-foreground">Price</span> <span className="font-bold text-foreground ml-1">{price?.toFixed(2) ?? "N/A"}</span></div>
            {smcData?.structures.length ? (() => {
              const last = smcData.structures[smcData.structures.length - 1];
              return <div className="rounded bg-white/[0.02] px-2 py-1"><span className="text-muted-foreground">Bias</span> <span className={cn("font-bold ml-1", last.direction === "bullish" ? "text-emerald-400" : "text-red-400")}>{last.direction} {last.type.toUpperCase()}</span></div>;
            })() : null}
            {smcData?.premiumDiscount && (
              <div className="rounded bg-white/[0.02] px-2 py-1"><span className="text-muted-foreground">Zone</span> <span className="font-bold text-foreground ml-1">{price && price > smcData.premiumDiscount.eq ? "Premium" : "Discount"}</span></div>
            )}
            {smcData?.previousLevels.pdh != null && (
              <div className="rounded bg-white/[0.02] px-2 py-1 col-span-2"><span className="text-muted-foreground">PDH/PDL</span> <span className="font-mono text-foreground ml-1">{smcData.previousLevels.pdh.toFixed(2)} / {smcData.previousLevels.pdl?.toFixed(2)}</span></div>
            )}
          </div>
          <div className="rounded bg-[#8B5CF6]/5 border border-[#8B5CF6]/15 px-2 py-1.5 text-[11px]">
            <span className="text-[#8B5CF6] font-bold">Strategy:</span> <span className="text-foreground">{activeStrategy.name}</span>
          </div>
        </div>

        {/* ── Checklist ─────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Checklist</p>
            <span className="text-[10px] text-muted-foreground">{evaluatedChecks.filter((c) => c.status === "passed").length}/{evaluatedChecks.length}</span>
          </div>
          {evaluatedChecks.map((check) => (
            <div key={check.id} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5 text-[11px] group">
              <button onClick={() => toggleManual(check.id)} className="shrink-0">
                <StatusIcon status={check.status} />
              </button>
              {editingId === check.id ? (
                <input value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") commitEdit(check.id); if (e.key === "Escape") setEditingId(null); }} onBlur={() => commitEdit(check.id)} autoFocus className="flex-1 bg-transparent text-foreground border-b border-[#0EA5E9]/40 focus:outline-none text-[11px]" />
              ) : (
                <span className="flex-1 text-foreground">{check.label}</span>
              )}
              {check.auto && <span className="text-[9px] text-muted-foreground/40 shrink-0">auto</span>}
              <button onClick={() => { setEditingId(check.id); setEditText(check.label); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0"><Pencil className="h-2.5 w-2.5" /></button>
            </div>
          ))}
          {evaluatedChecks.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-2">No checklist items. Open settings to add.</p>
          )}
        </div>

        {/* ── Decision ──────────────────────────────────────────────── */}
        {evaluatedChecks.length > 0 && (
          <div className="space-y-2">
            <DecisionBadge decision={decision} />
            <div className="text-[11px] space-y-1">
              {confirmed.length > 0 && <p className="text-emerald-400">Confirmed: {confirmed.join(", ")}</p>}
              {missing.length > 0 && <p className="text-amber-400">Unknown: {missing.join(", ")}</p>}
              {blocking.length > 0 && <p className="text-red-400">Blocking: {blocking.join(", ")}</p>}
            </div>
          </div>
        )}

        {/* ── Notes ─────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Decision Notes</p>
          <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }} placeholder="Why are you taking / skipping this trade..." rows={3} className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#0EA5E9]/40 resize-none" />
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className="border-t border-white/[0.06] px-4 py-3 space-y-1.5 shrink-0">
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={onOpenCoach} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#8B5CF6]/15 px-3 py-1.5 text-[11px] font-semibold text-[#8B5CF6] hover:bg-[#8B5CF6]/25"><MessageCircle className="h-3 w-3" /> Coach</button>
          <button onClick={onCreateTrade} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0EA5E9]/15 px-3 py-1.5 text-[11px] font-semibold text-[#0EA5E9] hover:bg-[#0EA5E9]/25"><Plus className="h-3 w-3" /> Trade</button>
          <button onClick={saveNotes} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-white/[0.1]"><Save className="h-3 w-3" /> {notesSaved ? "Saved!" : "Save Note"}</button>
          <button onClick={onAnalyze} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-white/[0.1]"><Zap className="h-3 w-3" /> Analyzer</button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: RuleStatus }) {
  if (status === "passed") return <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
  return <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />;
}

function DecisionBadge({ decision }: { decision: Decision }) {
  if (decision === "valid") return (
    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm font-bold text-emerald-400">
      <Shield className="h-4 w-4" /> Valid Setup
    </div>
  );
  if (decision === "incomplete") return (
    <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm font-bold text-amber-400">
      <ShieldAlert className="h-4 w-4" /> Incomplete Setup
    </div>
  );
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm font-bold text-red-400">
      <ShieldOff className="h-4 w-4" /> No Trade
    </div>
  );
}
