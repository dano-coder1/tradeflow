"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Loader2, BookOpen, ShieldCheck, ShieldOff, Sparkles, FileText, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal";
import type { PlaybookSetup } from "@/types/playbook";

// ── Templates ────────────────���─────────────────────────────���─────────────────

interface PlaybookTemplate {
  id: string;
  name: string;
  description: string;
  entry_rules: string;
  invalidation_rules: string;
  target_rules: string;
  risk_reward_min: number;
}

const TEMPLATES: PlaybookTemplate[] = [
  {
    id: "ob-fvg",
    name: "OB + FVG Retest",
    description: "Enter on a retest of an order block that overlaps with a fair value gap after a break of structure.",
    entry_rules: "1. Identify BOS on M15 in the direction of HTF bias\n2. Locate the order block that caused the BOS\n3. Wait for price to retrace into the OB zone\n4. Confirm FVG overlap within the OB\n5. Enter on M5 bullish/bearish engulfing at the zone",
    invalidation_rules: "1. Price closes through the entire OB on M15\n2. CHoCH forms against the trade direction\n3. Displacement candle invalidates the zone",
    target_rules: "TP1: Previous swing high/low (1:2 R:R)\nTP2: Opposing order block\nTP3: Next liquidity pool (equal highs/lows)",
    risk_reward_min: 2,
  },
  {
    id: "liq-sweep",
    name: "Liquidity Sweep Reversal",
    description: "Trade the reversal after price sweeps a clean high or low and shows displacement back into range.",
    entry_rules: "1. Identify clean equal highs or lows (liquidity pool)\n2. Wait for price to sweep beyond the level\n3. Look for immediate rejection with displacement candle\n4. Confirm with BOS on LTF (M5/M15)\n5. Enter on the first pullback after displacement",
    invalidation_rules: "1. Price continues beyond the sweep with strong momentum\n2. No BOS forms within 3 candles after sweep\n3. Higher timeframe structure contradicts the reversal",
    target_rules: "TP1: Midpoint of the range (1:1 R:R)\nTP2: Opposing liquidity pool\nTP3: HTF demand/supply zone",
    risk_reward_min: 2,
  },
  {
    id: "breakout-retest",
    name: "Breakout Retest",
    description: "Enter on the retest of a broken key level after a strong breakout with volume confirmation.",
    entry_rules: "1. Identify key resistance/support level on H1/H4\n2. Wait for a clean breakout with a strong candle close beyond the level\n3. Wait for price to pull back and retest the broken level\n4. Enter on a confirmation candle (pin bar, engulfing) at the retest\n5. SL below the retest candle wick",
    invalidation_rules: "1. Price closes back below the broken level on H1\n2. Retest takes too long (more than 8 candles)\n3. No confirmation candle at the retest",
    target_rules: "TP1: Distance equal to the breakout move (1:1)\nTP2: Next key resistance/support level\nTP3: Measured move projection",
    risk_reward_min: 1.5,
  },
  {
    id: "trend-pullback",
    name: "Trend Pullback",
    description: "Trade pullbacks to dynamic support/resistance within an established trend using EMA confluence.",
    entry_rules: "1. Confirm trend direction: price above EMA 50 (bullish) or below (bearish)\n2. Wait for pullback to EMA 21 zone\n3. Look for rejection candle at EMA 21 (pin bar, hammer, engulfing)\n4. Confirm EMA 9 crosses back in trend direction\n5. Enter on the candle close after confirmation",
    invalidation_rules: "1. Price closes below EMA 50 (bullish) or above (bearish)\n2. EMA 21 and EMA 50 begin converging (trend weakening)\n3. RSI shows divergence against the trend",
    target_rules: "TP1: Previous swing high/low\nTP2: 1.618 Fibonacci extension\nTrailing stop: below EMA 21",
    risk_reward_min: 2,
  },
  {
    id: "range-reversal",
    name: "Range Reversal",
    description: "Trade reversals at the boundaries of a well-defined range using support/resistance rejection.",
    entry_rules: "1. Identify clear range with at least 3 touches on both sides\n2. Wait for price to reach range boundary\n3. Look for rejection pattern (double top/bottom, pin bar)\n4. Confirm with RSI overbought/oversold\n5. Enter on the next candle after rejection confirmation",
    invalidation_rules: "1. Price closes beyond the range boundary with strong momentum\n2. Range has been tested more than 5 times (breakout likely)\n3. Fundamental event disrupts the range",
    target_rules: "TP1: Range midpoint\nTP2: Opposing range boundary\nSL: Beyond the range boundary + buffer",
    risk_reward_min: 1.5,
  },
];

// ── Playbook Tab ───────────────────────────���─────────────────────────────────

export function PlaybookTab() {
  const [playbooks, setPlaybooks] = useState<PlaybookSetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<PlaybookSetup | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlaybookSetup | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/playbooks");
      const data = await res.json();
      setPlaybooks(data.playbooks ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleToggleActive(pb: PlaybookSetup) {
    await fetch(`/api/playbooks/${pb.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !pb.is_active }),
    });
    refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/playbooks/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    setDeleting(false);
    refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#8B5CF6]" />
          <h3 className="text-sm font-bold text-foreground">Playbook Setups</h3>
          <span className="text-[10px] text-muted-foreground">{playbooks.length} setup{playbooks.length !== 1 ? "s" : ""}</span>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" /> New Setup
        </Button>
      </div>

      {playbooks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] py-12 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No playbook setups yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Create your first repeatable trading setup.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {playbooks.map((pb) => (
            <div
              key={pb.id}
              className={cn(
                "glass rounded-xl p-4 transition-all duration-200 border",
                pb.is_active
                  ? "border-[#8B5CF6]/20 hover:border-[#8B5CF6]/40"
                  : "border-white/[0.04] opacity-60 hover:opacity-80"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground truncate">{pb.name}</span>
                    {pb.is_active ? (
                      <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400 uppercase">Active</span>
                    ) : (
                      <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-bold text-muted-foreground uppercase">Inactive</span>
                    )}
                  </div>
                  {pb.description && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{pb.description}</p>
                  )}
                </div>
                {pb.risk_reward_min != null && (
                  <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                    R:R {pb.risk_reward_min}+
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-1.5">
                {pb.entry_rules && <RulePreview label="Entry" text={pb.entry_rules} color="text-emerald-400" />}
                {pb.invalidation_rules && <RulePreview label="Invalid" text={pb.invalidation_rules} color="text-red-400" />}
                {pb.target_rules && <RulePreview label="Target" text={pb.target_rules} color="text-[#0EA5E9]" />}
              </div>

              <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-white/[0.04]">
                <button onClick={() => handleToggleActive(pb)} className={cn("rounded px-2 py-1 text-[9px] font-bold transition-colors", pb.is_active ? "text-muted-foreground hover:bg-white/[0.06]" : "text-emerald-400 hover:bg-emerald-500/10")} aria-label={pb.is_active ? "Deactivate" : "Activate"}>
                  {pb.is_active ? <ShieldOff className="inline h-3 w-3 mr-0.5" /> : <ShieldCheck className="inline h-3 w-3 mr-0.5" />}
                  {pb.is_active ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => setEditTarget(pb)} className="rounded px-2 py-1 text-[9px] font-bold text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors" aria-label="Edit">
                  <Pencil className="inline h-3 w-3 mr-0.5" /> Edit
                </button>
                <button onClick={() => setDeleteTarget(pb)} className="rounded px-2 py-1 text-[9px] font-bold text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors" aria-label="Delete">
                  <Trash2 className="inline h-3 w-3 mr-0.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <PlaybookFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); refresh(); }}
        />
      )}

      {editTarget && (
        <PlaybookFormModal
          playbook={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); refresh(); }}
        />
      )}

      {deleteTarget && (
        <ModalOverlay onClose={() => setDeleteTarget(null)}>
          <div role="alertdialog" aria-modal="true" className="glass-strong relative w-full max-w-sm rounded-2xl shadow-2xl shadow-black/40 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-5 text-center space-y-2">
              <p className="text-sm font-bold text-foreground">Delete &ldquo;{deleteTarget.name}&rdquo;?</p>
              <p className="text-xs text-muted-foreground">This cannot be undone.</p>
            </div>
            <div className="flex items-center justify-center gap-3 border-t border-white/[0.06] px-5 py-3">
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-white/[0.08] px-4 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.06]">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="rounded-lg bg-red-500/90 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50">
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────��───────────────────────────────────────

function RulePreview({ label, text, color }: { label: string; text: string; color: string }) {
  const firstLine = text.split("\n")[0].slice(0, 80);
  return (
    <div className="flex items-start gap-2 text-[10px]">
      <span className={cn("shrink-0 font-bold uppercase tracking-wider w-10", color)}>{label}</span>
      <span className="text-muted-foreground truncate">{firstLine}{text.length > 80 ? "..." : ""}</span>
    </div>
  );
}

// ── Create / Edit Modal ──────────────────────────────────────────────────────

type CreationMode = "manual" | "template" | "ai";

function PlaybookFormModal({
  playbook,
  onClose,
  onSaved,
}: {
  playbook?: PlaybookSetup;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!playbook;
  const [mode, setMode] = useState<CreationMode>("manual");
  const [name, setName] = useState(playbook?.name ?? "");
  const [description, setDescription] = useState(playbook?.description ?? "");
  const [entryRules, setEntryRules] = useState(playbook?.entry_rules ?? "");
  const [invalidationRules, setInvalidationRules] = useState(playbook?.invalidation_rules ?? "");
  const [targetRules, setTargetRules] = useState(playbook?.target_rules ?? "");
  const [rrMin, setRrMin] = useState(playbook?.risk_reward_min?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // AI mode state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);

  // Apply a template
  function applyTemplate(tpl: PlaybookTemplate) {
    setName(tpl.name);
    setDescription(tpl.description);
    setEntryRules(tpl.entry_rules);
    setInvalidationRules(tpl.invalidation_rules);
    setTargetRules(tpl.target_rules);
    setRrMin(tpl.risk_reward_min.toString());
    setMode("manual"); // Switch to manual so user can edit
  }

  // AI generation (mock for now — generates from prompt keywords)
  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setError("");

    // Simulate AI delay
    await new Promise((r) => setTimeout(r, 1200));

    const prompt = aiPrompt.toLowerCase();

    // Smart keyword-based generation
    const isSell = prompt.includes("sell") || prompt.includes("short") || prompt.includes("bearish");
    const isBuy = prompt.includes("buy") || prompt.includes("long") || prompt.includes("bullish");
    const direction = isSell ? "sell" : isBuy ? "buy" : "trade";

    const hasFVG = prompt.includes("fvg") || prompt.includes("fair value");
    const hasOB = prompt.includes("ob") || prompt.includes("order block");
    const hasLiquidity = prompt.includes("liquidity") || prompt.includes("sweep");
    const hasBreakout = prompt.includes("breakout") || prompt.includes("break");
    const hasTrend = prompt.includes("trend") || prompt.includes("pullback");

    let generatedName = "Custom Setup";
    const entrySteps: string[] = [];
    const invalidSteps: string[] = [];
    const targetSteps: string[] = [];

    if (hasLiquidity) {
      generatedName = `Liquidity Sweep ${direction === "sell" ? "Short" : "Long"}`;
      entrySteps.push(
        "1. Identify clean equal highs/lows as liquidity target",
        "2. Wait for price to sweep the liquidity level",
        "3. Look for displacement candle + BOS on M15",
        `4. Enter ${direction} on pullback into the displacement zone`,
      );
      invalidSteps.push("1. Price continues strongly beyond the sweep", "2. No BOS forms within 4 candles");
      targetSteps.push("TP1: Range midpoint", "TP2: Opposing liquidity pool");
    } else if (hasFVG && hasOB) {
      generatedName = `OB + FVG ${direction === "sell" ? "Short" : "Long"}`;
      entrySteps.push(
        "1. Confirm HTF bias direction on H4/Daily",
        "2. Wait for BOS on M15 in bias direction",
        "3. Identify overlapping OB + FVG zone",
        `4. Enter ${direction} on M5 confirmation at the zone`,
      );
      invalidSteps.push("1. Price closes through the OB zone", "2. CHoCH against trade direction on M15");
      targetSteps.push("TP1: Previous swing structure (1:2 R:R)", "TP2: Next liquidity level");
    } else if (hasFVG) {
      generatedName = `FVG Mitigation ${direction === "sell" ? "Short" : "Long"}`;
      entrySteps.push(
        "1. Identify fresh FVG after displacement",
        `2. Wait for price to retrace into the FVG`,
        "3. Confirm with LTF BOS/CHoCH",
        `4. Enter ${direction} at FVG midpoint`,
      );
      invalidSteps.push("1. FVG fully filled with close beyond it", "2. Opposing displacement invalidates zone");
      targetSteps.push("TP1: Origin of the FVG displacement", "TP2: Opposing POI");
    } else if (hasBreakout) {
      generatedName = `Breakout ${direction === "sell" ? "Short" : "Long"}`;
      entrySteps.push(
        "1. Identify key level on H1 with multiple touches",
        "2. Wait for strong candle close beyond the level",
        "3. Wait for retest of the broken level",
        `4. Enter ${direction} on confirmation candle at retest`,
      );
      invalidSteps.push("1. Price reclaims the broken level", "2. Retest takes more than 8 candles");
      targetSteps.push("TP1: Measured move equal to breakout distance", "TP2: Next key level");
    } else if (hasTrend) {
      generatedName = `Trend Pullback ${direction === "sell" ? "Short" : "Long"}`;
      entrySteps.push(
        "1. Confirm established trend with EMA 50 slope",
        "2. Wait for pullback to EMA 21 zone",
        "3. Look for rejection candle at dynamic support/resistance",
        `4. Enter ${direction} after EMA 9 crosses back in trend direction`,
      );
      invalidSteps.push("1. Price closes through EMA 50", "2. EMAs begin converging");
      targetSteps.push("TP1: Previous swing extreme", "Trailing stop below EMA 21");
    } else {
      generatedName = `AI Generated: ${aiPrompt.slice(0, 30)}`;
      entrySteps.push(
        "1. Identify the setup condition described",
        "2. Wait for confirmation on your entry timeframe",
        `3. Enter ${direction} with proper risk management`,
      );
      invalidSteps.push("1. Setup conditions no longer valid", "2. Price structure contradicts the thesis");
      targetSteps.push("TP1: 1:2 Risk to Reward", "TP2: Next key structural level");
    }

    setName(generatedName);
    setDescription(`AI-generated from: "${aiPrompt.trim().slice(0, 100)}"`);
    setEntryRules(entrySteps.join("\n"));
    setInvalidationRules(invalidSteps.join("\n"));
    setTargetRules(targetSteps.join("\n"));
    setRrMin("2");
    setAiGenerated(true);
    setAiGenerating(false);
  }

  async function handleSubmit() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        entry_rules: entryRules.trim(),
        invalidation_rules: invalidationRules.trim(),
        target_rules: targetRules.trim(),
        risk_reward_min: rrMin.trim() ? Number(rrMin) : null,
      };
      const url = isEdit ? `/api/playbooks/${playbook.id}` : "/api/playbooks";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const hasContent = name.trim() || entryRules.trim();

  return (
    <ModalOverlay onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="playbook-form-title"
        className="glass-strong relative w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5 shrink-0">
          <h3 id="playbook-form-title" className="text-sm font-bold text-foreground">
            {isEdit ? "Edit Setup" : "New Playbook Setup"}
          </h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-muted-foreground hover:bg-white/[0.06]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* ── Creation mode selector (only for new) ─────────── */}
          {!isEdit && !hasContent && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "manual" as const, icon: PenLine, label: "Manual", desc: "Start from scratch" },
                  { key: "template" as const, icon: FileText, label: "Template", desc: "Use a preset" },
                  { key: "ai" as const, icon: Sparkles, label: "With AI", desc: "Describe your idea" },
                ]).map(({ key, icon: Icon, label, desc }) => (
                  <button
                    key={key}
                    onClick={() => setMode(key)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      mode === key
                        ? "border-[#8B5CF6]/40 bg-[#8B5CF6]/8"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 mb-1.5", mode === key ? "text-[#8B5CF6]" : "text-muted-foreground")} />
                    <p className="text-xs font-bold text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </button>
                ))}
              </div>

              {/* Template picker */}
              {mode === "template" && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Choose a template</p>
                  <div className="grid gap-2">
                    {TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => applyTemplate(tpl)}
                        className="glass rounded-lg px-3 py-2.5 text-left transition-all hover:bg-white/[0.04] border border-white/[0.06] hover:border-[#8B5CF6]/30"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-foreground">{tpl.name}</span>
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-bold text-amber-400">R:R {tpl.risk_reward_min}+</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{tpl.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* AI generator */}
              {mode === "ai" && !aiGenerated && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Describe your setup</p>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder='e.g. "When NY session sweeps liquidity below Asia lows and price returns into a M15 FVG, I want to look for a buy."'
                      rows={3}
                      className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus:border-[#8B5CF6]/40 placeholder:text-muted-foreground/40"
                    />
                    <p className="text-[9px] text-muted-foreground/60 mt-1">
                      Mention concepts like: OB, FVG, liquidity sweep, breakout, trend, buy/sell, timeframe
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    loading={aiGenerating}
                    disabled={!aiPrompt.trim()}
                    onClick={handleAiGenerate}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Generate Playbook
                  </Button>
                </div>
              )}

              {/* Show form only in manual mode (template/ai switch to it after filling) */}
              {mode === "manual" && <FormDivider />}
            </>
          )}

          {/* ── Form fields (always shown when content exists or manual mode) ── */}
          {(isEdit || hasContent || mode === "manual") && (
            <div className="space-y-3">
              {aiGenerated && (
                <div className="rounded-lg bg-[#8B5CF6]/8 border border-[#8B5CF6]/20 px-3 py-2 text-[10px] text-[#8B5CF6]">
                  <Sparkles className="inline h-3 w-3 mr-1" />
                  AI-generated — review and edit before saving
                </div>
              )}

              <GuidedField
                label="Setup Name *"
                hint="Give it a clear, recognizable name you'll remember."
                example='e.g. "NY Session OB Short" or "London Breakout Long"'
              >
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="OB + FVG Retest"
                  maxLength={60}
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus:border-[#0EA5E9]/40"
                />
              </GuidedField>

              <GuidedField
                label="Description"
                hint="When would you use this setup? What market conditions?"
                example="Best in trending markets during NY session with clear HTF bias."
              >
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="When and why to use this setup..."
                  rows={2}
                  className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus:border-[#0EA5E9]/40"
                />
              </GuidedField>

              <GuidedField
                label="Entry Rules"
                hint="Step-by-step checklist of what must happen before you enter."
                example="1. BOS on M15  2. OB in discount  3. FVG overlap  4. M5 engulfing"
              >
                <textarea
                  value={entryRules}
                  onChange={(e) => setEntryRules(e.target.value)}
                  placeholder={"1. Wait for BOS on M15\n2. Identify OB in discount zone\n3. Enter on FVG fill..."}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-[#0EA5E9]/40"
                />
              </GuidedField>

              <GuidedField
                label="Invalidation Rules"
                hint="What tells you the setup is no longer valid? When do you NOT enter?"
                example="CHoCH against bias, price closes through OB, no displacement"
              >
                <textarea
                  value={invalidationRules}
                  onChange={(e) => setInvalidationRules(e.target.value)}
                  placeholder={"1. CHoCH against bias on H1\n2. Price breaks above supply zone..."}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-[#0EA5E9]/40"
                />
              </GuidedField>

              <GuidedField
                label="Target Rules"
                hint="Where will you take profit? Define TP1, TP2, etc."
                example="TP1: opposing OB (1:2 R:R), TP2: liquidity pool, TP3: HTF level"
              >
                <textarea
                  value={targetRules}
                  onChange={(e) => setTargetRules(e.target.value)}
                  placeholder={"TP1: opposing OB\nTP2: liquidity pool\nTP3: HTF level..."}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-[#0EA5E9]/40"
                />
              </GuidedField>

              <GuidedField
                label="Minimum R:R"
                hint="What is the minimum Risk-to-Reward ratio you require before entering?"
                example="Most SMC traders use 2.0 or higher. Scalpers may use 1.0-1.5."
              >
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={rrMin}
                  onChange={(e) => setRrMin(e.target.value)}
                  placeholder="2.0"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-[#0EA5E9]/40"
                />
              </GuidedField>

              {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer — only show save when form has content */}
        {(isEdit || hasContent || mode === "manual") && (
          <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3 shrink-0">
            <button onClick={onClose} className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.06]">
              Cancel
            </button>
            <Button size="sm" loading={saving} onClick={handleSubmit}>
              {isEdit ? "Save Changes" : "Create Setup"}
            </Button>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}

// ── Guided field with helper text ─────────────────��──────────────────────────

function GuidedField({ label, hint, example, children }: {
  label: string;
  hint: string;
  example: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      {children}
      <p className="text-[9px] text-muted-foreground/50 mt-1">{hint}</p>
      <p className="text-[9px] text-muted-foreground/30 italic">{example}</p>
    </div>
  );
}

function FormDivider() {
  return (
    <div className="relative py-1">
      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/[0.06]" /></div>
      <div className="relative flex justify-center"><span className="bg-[#111] px-2 text-[9px] text-muted-foreground/40">Fill in your setup details</span></div>
    </div>
  );
}
