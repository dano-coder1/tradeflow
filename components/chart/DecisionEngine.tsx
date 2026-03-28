"use client";

import { useState, useEffect, useMemo } from "react";
import { X, CheckCircle, XCircle, HelpCircle, Shield, ShieldAlert, ShieldOff, Settings2, Save, MessageCircle, Plus, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SmcResult } from "@/lib/smc-engine";
import type { Drawing } from "./ChartDrawingOverlay";
import { getActiveStrategy, type SavedStrategy } from "@/lib/strategy-store";

// ── Types ────────────────────────────────────────────────────────────────────

type RuleStatus = "passed" | "failed" | "unknown";
type Decision = "valid" | "incomplete" | "no-trade";

interface RuleCheck {
  key: string;
  label: string;
  status: RuleStatus;
  auto: boolean; // true if auto-evaluated from chart context
}

interface DecisionProfile {
  enabledRules: string[];
  minRR: number;
  customRules: string[];
  autoEval: boolean;
}

const DEFAULT_PROFILE: DecisionProfile = {
  enabledRules: ["trend_aligned", "liquidity_taken", "bos_confirmed", "entry_at_ob", "premium_discount", "min_rr"],
  minRR: 2,
  customRules: [],
  autoEval: true,
};

const PROFILE_KEY = "tf:decision-profile";

function loadProfile(): DecisionProfile {
  try { const r = localStorage.getItem(PROFILE_KEY); return r ? { ...DEFAULT_PROFILE, ...JSON.parse(r) } : { ...DEFAULT_PROFILE }; } catch { return { ...DEFAULT_PROFILE }; }
}

function saveProfile(p: DecisionProfile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
}

// ── Built-in rule definitions ────────────────────────────────────────────────

const BUILTIN_RULES: { key: string; label: string }[] = [
  { key: "trend_aligned", label: "Trend aligned" },
  { key: "liquidity_taken", label: "Liquidity taken" },
  { key: "bos_confirmed", label: "BOS confirmed" },
  { key: "choch_confirmed", label: "CHoCH confirmed" },
  { key: "entry_at_ob", label: "Entry at Order Block" },
  { key: "premium_discount", label: "Premium / Discount" },
  { key: "min_rr", label: "Minimum R:R met" },
  { key: "session_ok", label: "Session condition met" },
];

// ── Auto-evaluation ──────────────────────────────────────────────────────────

function autoEvaluateRule(key: string, smcData: SmcResult | null, price: number | null): RuleStatus {
  if (!smcData) return "unknown";

  const { structures, orderBlocks, fvgs, premiumDiscount } = smcData;

  switch (key) {
    case "trend_aligned": {
      if (structures.length === 0) return "unknown";
      const last = structures[structures.length - 1];
      return last.type === "bos" ? "passed" : "unknown";
    }
    case "bos_confirmed": {
      const hasBos = structures.some((s) => s.type === "bos");
      return hasBos ? "passed" : "failed";
    }
    case "choch_confirmed": {
      const hasChoch = structures.some((s) => s.type === "choch");
      return hasChoch ? "passed" : "failed";
    }
    case "entry_at_ob": {
      if (!price || orderBlocks.length === 0) return "unknown";
      const nearOb = orderBlocks.some((ob) => price >= ob.low && price <= ob.high);
      return nearOb ? "passed" : "failed";
    }
    case "premium_discount": {
      if (!price || !premiumDiscount) return "unknown";
      const inZone = price <= premiumDiscount.eq * 0.98 || price >= premiumDiscount.eq * 1.02;
      return inZone ? "passed" : "failed";
    }
    case "liquidity_taken":
    case "min_rr":
    case "session_ok":
    default:
      return "unknown";
  }
}

// ── Decision logic ───────────────────────────────────────────────────────────

function computeDecision(checks: RuleCheck[]): { decision: Decision; confirmed: string[]; missing: string[]; blocking: string[] } {
  const confirmed = checks.filter((c) => c.status === "passed").map((c) => c.label);
  const failed = checks.filter((c) => c.status === "failed");
  const unknown = checks.filter((c) => c.status === "unknown");

  const blocking = failed.map((c) => c.label);
  const missing = unknown.map((c) => c.label);

  if (failed.length > 0) return { decision: "no-trade", confirmed, missing, blocking };
  if (unknown.length > checks.length * 0.5) return { decision: "incomplete", confirmed, missing, blocking };
  if (confirmed.length >= checks.length * 0.6) return { decision: "valid", confirmed, missing, blocking };
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
  const [profile, setProfile] = useState<DecisionProfile>(() => loadProfile());
  const [showSettings, setShowSettings] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [manualOverrides, setManualOverrides] = useState<Record<string, RuleStatus>>({});
  const [activeStrategy, setActiveStrategy] = useState<SavedStrategy | null>(null);
  const [newCustomRule, setNewCustomRule] = useState("");

  useEffect(() => { setActiveStrategy(getActiveStrategy()); }, [open]);

  // Build rule checks
  const ruleChecks = useMemo((): RuleCheck[] => {
    const checks: RuleCheck[] = [];

    for (const rule of BUILTIN_RULES) {
      if (!profile.enabledRules.includes(rule.key)) continue;
      const override = manualOverrides[rule.key];
      if (override) {
        checks.push({ key: rule.key, label: rule.label, status: override, auto: false });
      } else if (profile.autoEval) {
        checks.push({ key: rule.key, label: rule.label, status: autoEvaluateRule(rule.key, smcData, price), auto: true });
      } else {
        checks.push({ key: rule.key, label: rule.label, status: "unknown", auto: false });
      }
    }

    // Custom rules — always manual
    for (const cr of profile.customRules) {
      const key = `custom_${cr}`;
      checks.push({ key, label: cr, status: manualOverrides[key] ?? "unknown", auto: false });
    }

    return checks;
  }, [profile, smcData, price, manualOverrides]);

  const { decision, confirmed, missing, blocking } = useMemo(() => computeDecision(ruleChecks), [ruleChecks]);

  function toggleManual(key: string) {
    setManualOverrides((prev) => {
      const current = prev[key];
      const next = current === "passed" ? "failed" : current === "failed" ? undefined : "passed";
      const copy = { ...prev };
      if (next) copy[key] = next;
      else delete copy[key];
      return copy;
    });
  }

  function updateProfile(patch: Partial<DecisionProfile>) {
    setProfile((prev) => { const next = { ...prev, ...patch }; saveProfile(next); return next; });
  }

  function toggleRule(key: string) {
    const enabled = profile.enabledRules.includes(key)
      ? profile.enabledRules.filter((k) => k !== key)
      : [...profile.enabledRules, key];
    updateProfile({ enabledRules: enabled });
  }

  function addCustomRule() {
    if (!newCustomRule.trim()) return;
    updateProfile({ customRules: [...profile.customRules, newCustomRule.trim()] });
    setNewCustomRule("");
  }

  function removeCustomRule(idx: number) {
    updateProfile({ customRules: profile.customRules.filter((_, i) => i !== idx) });
  }

  function saveNotes() {
    setNotesSaved(true);
    setTimeout(() => setNotesSaved(false), 2000);
  }

  if (!open) return null;

  return (
    <div className="fixed top-0 right-0 bottom-0 z-[60] w-[360px] flex flex-col glass-strong border-l border-white/[0.06] shadow-2xl shadow-black/40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[#0EA5E9]" />
          <span className="text-sm font-bold text-foreground">Decision Engine</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSettings((v) => !v)} className={cn("rounded p-1", showSettings ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* ── Settings panel ────────────────────────────────────────── */}
        {showSettings && (
          <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 space-y-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Enabled Rules</p>
            <div className="flex flex-wrap gap-1">
              {BUILTIN_RULES.map((r) => (
                <button key={r.key} onClick={() => toggleRule(r.key)} className={cn("rounded px-2 py-0.5 text-[10px] font-medium transition-colors", profile.enabledRules.includes(r.key) ? "bg-[#0EA5E9]/15 text-[#0EA5E9]" : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]")}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Min R:R</span>
              <input type="number" min={1} max={10} step={0.5} value={profile.minRR} onChange={(e) => updateProfile({ minRR: parseFloat(e.target.value) || 2 })} className="w-14 rounded bg-white/[0.06] border border-white/[0.08] px-1.5 py-0.5 text-xs text-foreground text-center focus:outline-none" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Auto-evaluate</span>
              <button onClick={() => updateProfile({ autoEval: !profile.autoEval })} className={cn("rounded px-2 py-0.5 text-[10px] font-medium", profile.autoEval ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.06] text-muted-foreground")}>{profile.autoEval ? "On" : "Off"}</button>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Custom Rules</p>
              {profile.customRules.map((cr, i) => (
                <div key={i} className="flex items-center justify-between rounded bg-white/[0.04] px-2 py-1 mb-1 text-[10px] text-foreground">
                  <span className="truncate">{cr}</span>
                  <button onClick={() => removeCustomRule(i)} className="text-muted-foreground hover:text-red-400"><X className="h-3 w-3" /></button>
                </div>
              ))}
              <div className="flex gap-1">
                <input value={newCustomRule} onChange={(e) => setNewCustomRule(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomRule()} placeholder="Add rule..." className="flex-1 rounded bg-white/[0.06] border border-white/[0.08] px-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
                <button onClick={addCustomRule} className="rounded bg-white/[0.06] px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">Add</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Context summary ───────────────────────────────────────── */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Context</p>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="rounded bg-white/[0.02] px-2 py-1"><span className="text-muted-foreground">Symbol</span> <span className="font-bold text-foreground ml-1">{symbol}</span></div>
            <div className="rounded bg-white/[0.02] px-2 py-1"><span className="text-muted-foreground">TF</span> <span className="font-bold text-foreground ml-1">{timeframe}</span></div>
            <div className="rounded bg-white/[0.02] px-2 py-1"><span className="text-muted-foreground">Price</span> <span className="font-bold text-foreground ml-1">{price?.toFixed(2) ?? "N/A"}</span></div>
            {smcData && (
              <>
                {smcData.structures.length > 0 && (() => {
                  const last = smcData.structures[smcData.structures.length - 1];
                  return <div className="rounded bg-white/[0.02] px-2 py-1"><span className="text-muted-foreground">Bias</span> <span className={cn("font-bold ml-1", last.direction === "bullish" ? "text-emerald-400" : "text-red-400")}>{last.direction} {last.type.toUpperCase()}</span></div>;
                })()}
                {smcData.premiumDiscount && (
                  <div className="rounded bg-white/[0.02] px-2 py-1"><span className="text-muted-foreground">Zone</span> <span className="font-bold text-foreground ml-1">{price && price > smcData.premiumDiscount.eq ? "Premium" : "Discount"}</span></div>
                )}
                {smcData.previousLevels.pdh != null && (
                  <div className="rounded bg-white/[0.02] px-2 py-1 col-span-2"><span className="text-muted-foreground">PDH/PDL</span> <span className="font-mono text-foreground ml-1">{smcData.previousLevels.pdh.toFixed(2)} / {smcData.previousLevels.pdl?.toFixed(2)}</span></div>
                )}
              </>
            )}
          </div>
          {activeStrategy && (
            <div className="rounded bg-[#8B5CF6]/5 border border-[#8B5CF6]/15 px-2 py-1.5 text-[11px]">
              <span className="text-[#8B5CF6] font-bold">Strategy:</span> <span className="text-foreground">{activeStrategy.name}</span>
            </div>
          )}
        </div>

        {/* ── Rule checklist ─────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Checklist</p>
          {ruleChecks.map((check) => (
            <button key={check.key} onClick={() => toggleManual(check.key)} className="w-full flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5 text-[11px] hover:bg-white/[0.04] transition-colors text-left">
              <StatusIcon status={check.status} />
              <span className="flex-1 text-foreground">{check.label}</span>
              {check.auto && <span className="text-[9px] text-muted-foreground/40">auto</span>}
            </button>
          ))}
          {ruleChecks.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-2">No rules enabled. Open settings to configure.</p>
          )}
        </div>

        {/* ── Decision result ────────────────────────────────────────── */}
        {ruleChecks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <DecisionBadge decision={decision} />
            </div>
            <div className="text-[11px] space-y-1">
              {confirmed.length > 0 && <p className="text-emerald-400">Confirmed: {confirmed.join(", ")}</p>}
              {missing.length > 0 && <p className="text-amber-400">Unknown: {missing.join(", ")}</p>}
              {blocking.length > 0 && <p className="text-red-400">Blocking: {blocking.join(", ")}</p>}
            </div>
          </div>
        )}

        {/* ── Notes ──────────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Decision Notes</p>
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }}
            placeholder="Why are you taking / skipping this trade..."
            rows={3}
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#0EA5E9]/40 resize-none"
          />
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className="border-t border-white/[0.06] px-4 py-3 space-y-1.5 shrink-0">
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={onOpenCoach} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#8B5CF6]/15 px-3 py-1.5 text-[11px] font-semibold text-[#8B5CF6] hover:bg-[#8B5CF6]/25">
            <MessageCircle className="h-3 w-3" /> Coach
          </button>
          <button onClick={onCreateTrade} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0EA5E9]/15 px-3 py-1.5 text-[11px] font-semibold text-[#0EA5E9] hover:bg-[#0EA5E9]/25">
            <Plus className="h-3 w-3" /> Trade
          </button>
          <button onClick={saveNotes} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-white/[0.1]">
            <Save className="h-3 w-3" /> {notesSaved ? "Saved!" : "Save Note"}
          </button>
          <button onClick={onAnalyze} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-foreground hover:bg-white/[0.1]">
            <Zap className="h-3 w-3" /> Analyzer
          </button>
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
