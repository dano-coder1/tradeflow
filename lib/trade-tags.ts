// ── Shared trade behavior tag utilities ─────────────────────────────────────
// Single source of truth for tag classification, labels, and colors.

export const POSITIVE_TAGS = new Set([
  "good_patience", "correct_invalidation", "clean_execution", "good_risk_management",
]);

export const NEGATIVE_TAGS = new Set([
  "late_entry", "no_confirmation", "buy_in_premium", "sell_in_discount",
  "liquidity_not_taken", "entered_before_bos", "revenge_trade", "bad_rr",
  "overtrading", "sl_too_tight", "tp_too_early", "wrong_bias",
]);

export function tagLabel(tag: string): string {
  return tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function tagColor(tag: string): string {
  if (POSITIVE_TAGS.has(tag)) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  if (NEGATIVE_TAGS.has(tag)) return "bg-red-500/15 text-red-400 border-red-500/20";
  return "bg-white/[0.06] text-muted-foreground border-white/[0.08]";
}

export function confidenceColor(c: string): string {
  if (c === "high") return "bg-emerald-500/15 text-emerald-400";
  if (c === "medium") return "bg-amber-500/15 text-amber-400";
  return "bg-red-500/15 text-red-400";
}
