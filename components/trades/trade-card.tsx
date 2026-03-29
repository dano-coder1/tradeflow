"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trade } from "@/types/trade";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Brain, Image as ImageIcon, Pencil, Trash2, X, Loader2, Stethoscope } from "lucide-react";
import { TradeReviewModal } from "./trade-review-modal";

function directionColor(d: string) {
  return d === "long" ? "text-emerald-400" : "text-red-400";
}

function directionBg(d: string) {
  return d === "long" ? "bg-emerald-400/10" : "bg-red-400/10";
}

function resultVariant(r: string | null) {
  if (r === "win") return "success";
  if (r === "loss") return "destructive";
  if (r === "breakeven") return "warning";
  return "secondary";
}

// ── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  trade,
  onClose,
  onSaved,
}: {
  trade: Trade;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sl, setSl] = useState(trade.sl?.toString() ?? "");
  const [tp, setTp] = useState(trade.tp?.toString() ?? "");
  const [notes, setNotes] = useState(trade.notes ?? "");
  const [tag, setTag] = useState(trade.tag ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        sl: sl.trim() ? Number(sl) : null,
        tp: tp.trim() ? Number(tp) : null,
        notes: notes.trim() || null,
        tag: tag.trim() || null,
      };
      const res = await fetch(`/api/trades/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Save failed");
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="glass-strong relative w-full max-w-md rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <h3 className="text-sm font-bold text-foreground">
            Edit {trade.symbol} <span className="text-muted-foreground font-normal">· {trade.direction.toUpperCase()}</span>
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">SL</span>
              <input
                type="number"
                step="any"
                value={sl}
                onChange={(e) => setSl(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-[#0EA5E9]/40"
                placeholder="—"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">TP</span>
              <input
                type="number"
                step="any"
                value={tp}
                onChange={(e) => setTp(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-[#0EA5E9]/40"
                placeholder="—"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tag / Setup</span>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus:border-[#0EA5E9]/40"
              placeholder="e.g. OB + FVG"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus:border-[#0EA5E9]/40"
              placeholder="Reason for trade..."
            />
          </label>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-gradient rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({
  trade,
  onClose,
  onDeleted,
}: {
  trade: Trade;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/trades/${trade.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Delete failed");
      }
      onDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="glass-strong relative w-full max-w-sm rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-5 text-center space-y-2">
          <p className="text-sm font-bold text-foreground">Delete trade?</p>
          <p className="text-xs text-muted-foreground">
            {trade.symbol} · {trade.direction.toUpperCase()} · {trade.trade_date}
          </p>
          <p className="text-xs text-muted-foreground/60">This cannot be undone.</p>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex items-center justify-center gap-3 border-t border-white/[0.06] px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-white/[0.08] px-4 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-red-500/90 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Trade Card ───────────────────────────────────────────────────────────────

export function TradeCard({ trade }: { trade: Trade }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const pnlPositive = trade.pnl != null && trade.pnl >= 0;
  const canReview = trade.status === "closed" || trade.result === "win" || trade.result === "loss" || trade.result === "breakeven";

  return (
    <>
      <div className="group relative">
        <Link
          href={`/trades/${trade.id}`}
          className="block glass rounded-xl px-5 py-4 transition-all duration-200 hover:bg-white/[0.04] hover:shadow-lg hover:shadow-black/20"
        >
          {/* Header: symbol + direction + badges */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg font-extrabold tracking-tight">{trade.symbol}</span>
              <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide", directionColor(trade.direction), directionBg(trade.direction))}>
                {trade.direction}
              </span>
              {trade.timeframe && (
                <span className="text-xs text-muted-foreground/50">{trade.timeframe}</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {trade.screenshot_url && (
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
              )}
              {trade.autopsy_json && (
                <Stethoscope className="h-3.5 w-3.5 text-[#0EA5E9]" />
              )}
              {trade.result ? (
                <Badge variant={resultVariant(trade.result)}>{trade.result}</Badge>
              ) : (
                <Badge variant="outline">{trade.status}</Badge>
              )}
            </div>
          </div>

          {/* Date + tag */}
          <p className="mt-1.5 text-xs text-muted-foreground/60">
            {new Date(trade.trade_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            {trade.tag && <span className="ml-2 text-muted-foreground/40">· {trade.tag}</span>}
          </p>

          {/* Entry / SL / TP row */}
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Entry</p>
              <p className="mt-0.5 font-mono text-sm font-semibold">{trade.entry ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">SL</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-red-400">{trade.sl ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">TP</p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-400">{trade.tp ?? "—"}</p>
            </div>
          </div>

          {/* PnL + RR footer */}
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">PnL</p>
              <p className={cn("mt-0.5 font-mono text-base font-extrabold", trade.pnl != null ? (pnlPositive ? "text-emerald-400" : "text-red-400") : "text-muted-foreground/30")}>
                {trade.pnl != null ? (pnlPositive ? "+" : "") + trade.pnl.toFixed(2) : "—"}
              </p>
            </div>
            {trade.rr != null && (
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">R:R</p>
                <p className="mt-0.5 font-mono text-base font-extrabold text-foreground/80">1:{trade.rr}</p>
              </div>
            )}
          </div>
        </Link>

        {/* Action buttons — visible on hover */}
        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 z-10">
          {canReview && (
            <button
              onClick={() => setReviewOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-[#0EA5E9]/10 hover:text-[#0EA5E9]"
              title="Trade Review"
            >
              <Stethoscope className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setEditOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-white/[0.08] hover:text-foreground"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-red-500/10 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {editOpen && (
        <EditModal
          trade={trade}
          onClose={() => setEditOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
      {deleteOpen && (
        <DeleteConfirm
          trade={trade}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => router.refresh()}
        />
      )}
      {reviewOpen && (
        <TradeReviewModal
          trade={trade}
          onClose={() => setReviewOpen(false)}
          onUpdated={() => router.refresh()}
        />
      )}
    </>
  );
}
