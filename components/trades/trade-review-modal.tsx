"use client";

import { useState, useEffect } from "react";
import { X, Loader2, AlertTriangle, CheckCircle, Target, Lightbulb, Tag, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { tagLabel, tagColor, confidenceColor } from "@/lib/trade-tags";
import type { Trade, TradeReview } from "@/types/trade";

// ── Component ────────────────────────────────────────────────────────────────

interface TradeReviewModalProps {
  trade: Trade;
  onClose: () => void;
  onUpdated: () => void;
}

export function TradeReviewModal({ trade, onClose, onUpdated }: TradeReviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TradeReview | null>(trade.autopsy_json ?? null);
  const [error, setError] = useState("");

  async function runReview() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/trades/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeId: trade.id }),
      });
      const data = await res.json();
      if (data.review) {
        setResult(data.review);
        onUpdated();
      } else {
        setError(data.error ?? "Review failed");
      }
    } catch {
      setError("Connection error");
    }
    setLoading(false);
  }

  // Only auto-run if trade has no existing review
  useEffect(() => {
    if (!trade.autopsy_json && !result && !loading && !error) runReview();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="glass-strong relative w-full max-w-lg max-h-[85vh] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5 shrink-0">
          <div>
            <h3 className="text-sm font-bold text-foreground">Trade Review</h3>
            <p className="text-[11px] text-muted-foreground">{trade.symbol} · {trade.direction.toUpperCase()} · {trade.trade_date}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 text-[#0EA5E9] animate-spin" />
              <p className="text-sm font-medium text-foreground">Reviewing your trade...</p>
              <p className="text-[11px] text-muted-foreground">Analyzing entry, exit, and execution</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="text-center py-8 space-y-3">
              <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto" />
              <p className="text-sm text-foreground">{error}</p>
              <button onClick={runReview} className="rounded-lg bg-white/[0.06] px-4 py-2 text-xs text-foreground hover:bg-white/[0.1]">Retry</button>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <>
              {/* Verdict + confidence */}
              <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Verdict</p>
                    <p className="text-sm font-semibold text-foreground leading-relaxed">{result.verdict}</p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0", confidenceColor(result.confidence))}>
                    {result.confidence}
                  </span>
                </div>
                {result.summary && result.summary !== result.verdict && (
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{result.summary}</p>
                )}
              </div>

              {/* What went well / wrong */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Went Well</p>
                  </div>
                  <ul className="space-y-1.5">
                    {(result.what_went_well ?? []).map((item, i) => (
                      <li key={i} className="text-[11px] text-foreground leading-relaxed flex gap-1.5">
                        <span className="text-emerald-400 shrink-0">+</span>{item}
                      </li>
                    ))}
                    {(result.what_went_well ?? []).length === 0 && (
                      <li className="text-[11px] text-muted-foreground italic">Nothing notable</li>
                    )}
                  </ul>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Went Wrong</p>
                  </div>
                  <ul className="space-y-1.5">
                    {(result.what_went_wrong ?? []).map((item, i) => (
                      <li key={i} className="text-[11px] text-foreground leading-relaxed flex gap-1.5">
                        <span className="text-red-400 shrink-0">-</span>{item}
                      </li>
                    ))}
                    {(result.what_went_wrong ?? []).length === 0 && (
                      <li className="text-[11px] text-muted-foreground italic">Clean trade</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Key mistake */}
              {result.key_mistake && (
                <div className="rounded-lg bg-red-500/5 border border-red-500/10 px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="h-3.5 w-3.5 text-red-400" />
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Key Mistake</p>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{result.key_mistake}</p>
                </div>
              )}

              {/* Improvement tip */}
              {result.improvement_tip && (
                <div className="rounded-lg bg-[#0EA5E9]/5 border border-[#0EA5E9]/10 px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Lightbulb className="h-3.5 w-3.5 text-[#0EA5E9]" />
                    <p className="text-[10px] font-bold text-[#0EA5E9] uppercase tracking-wider">Improvement Tip</p>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{result.improvement_tip}</p>
                </div>
              )}

              {/* Behavior tags */}
              {(result.behavior_tags ?? []).length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Behavior Tags</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.behavior_tags.map((tag) => (
                      <span key={tag} className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", tagColor(tag))}>
                        {tagLabel(tag)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer: timestamp + re-run */}
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                <p className="text-[10px] text-muted-foreground">
                  {new Date(result.generated_at).toLocaleString()}
                </p>
                <button onClick={runReview} disabled={loading} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-white/[0.06] disabled:opacity-50">
                  <RefreshCw className="h-3 w-3" />
                  Re-run
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
