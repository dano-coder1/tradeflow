"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2, BookOpen, ShieldCheck, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal";
import type { PlaybookSetup } from "@/types/playbook";

// ── Playbook Tab ─────────────────────────────────────────────────────────────

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
              {/* Header */}
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

              {/* Rules preview */}
              <div className="mt-3 space-y-1.5">
                {pb.entry_rules && (
                  <RulePreview label="Entry" text={pb.entry_rules} color="text-emerald-400" />
                )}
                {pb.invalidation_rules && (
                  <RulePreview label="Invalid" text={pb.invalidation_rules} color="text-red-400" />
                )}
                {pb.target_rules && (
                  <RulePreview label="Target" text={pb.target_rules} color="text-[#0EA5E9]" />
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-white/[0.04]">
                <button
                  onClick={() => handleToggleActive(pb)}
                  className={cn(
                    "rounded px-2 py-1 text-[9px] font-bold transition-colors",
                    pb.is_active
                      ? "text-muted-foreground hover:bg-white/[0.06]"
                      : "text-emerald-400 hover:bg-emerald-500/10"
                  )}
                  aria-label={pb.is_active ? "Deactivate" : "Activate"}
                >
                  {pb.is_active ? <ShieldOff className="inline h-3 w-3 mr-0.5" /> : <ShieldCheck className="inline h-3 w-3 mr-0.5" />}
                  {pb.is_active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => setEditTarget(pb)}
                  className="rounded px-2 py-1 text-[9px] font-bold text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors"
                  aria-label="Edit"
                >
                  <Pencil className="inline h-3 w-3 mr-0.5" /> Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(pb)}
                  className="rounded px-2 py-1 text-[9px] font-bold text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 className="inline h-3 w-3 mr-0.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <PlaybookFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); refresh(); }}
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <PlaybookFormModal
          playbook={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); refresh(); }}
        />
      )}

      {/* Delete confirmation */}
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

// ── Rule preview line ────────────────────────────────────────────────────────

function RulePreview({ label, text, color }: { label: string; text: string; color: string }) {
  const firstLine = text.split("\n")[0].slice(0, 80);
  return (
    <div className="flex items-start gap-2 text-[10px]">
      <span className={cn("shrink-0 font-bold uppercase tracking-wider w-10", color)}>{label}</span>
      <span className="text-muted-foreground truncate">{firstLine}{text.length > 80 ? "..." : ""}</span>
    </div>
  );
}

// ── Create / Edit modal ──────────────────────────────────────────────────────

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
  const [name, setName] = useState(playbook?.name ?? "");
  const [description, setDescription] = useState(playbook?.description ?? "");
  const [entryRules, setEntryRules] = useState(playbook?.entry_rules ?? "");
  const [invalidationRules, setInvalidationRules] = useState(playbook?.invalidation_rules ?? "");
  const [targetRules, setTargetRules] = useState(playbook?.target_rules ?? "");
  const [rrMin, setRrMin] = useState(playbook?.risk_reward_min?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="playbook-form-title"
        className="glass-strong relative w-full max-w-lg max-h-[85vh] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5 shrink-0">
          <h3 id="playbook-form-title" className="text-sm font-bold text-foreground">
            {isEdit ? "Edit Setup" : "New Playbook Setup"}
          </h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-muted-foreground hover:bg-white/[0.06]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Name */}
          <Field label="Setup Name *">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. OB + FVG Retest"
              maxLength={60}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus:border-[#0EA5E9]/40"
            />
          </Field>

          {/* Description */}
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When and why to use this setup..."
              rows={2}
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus:border-[#0EA5E9]/40"
            />
          </Field>

          {/* Entry rules */}
          <Field label="Entry Rules">
            <textarea
              value={entryRules}
              onChange={(e) => setEntryRules(e.target.value)}
              placeholder="1. Wait for BOS on M15&#10;2. Identify OB in discount zone&#10;3. Enter on FVG fill..."
              rows={3}
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-[#0EA5E9]/40"
            />
          </Field>

          {/* Invalidation rules */}
          <Field label="Invalidation Rules">
            <textarea
              value={invalidationRules}
              onChange={(e) => setInvalidationRules(e.target.value)}
              placeholder="1. CHoCH against bias on H1&#10;2. Price breaks above supply zone..."
              rows={3}
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-[#0EA5E9]/40"
            />
          </Field>

          {/* Target rules */}
          <Field label="Target Rules">
            <textarea
              value={targetRules}
              onChange={(e) => setTargetRules(e.target.value)}
              placeholder="TP1: opposing OB&#10;TP2: liquidity pool&#10;TP3: HTF level..."
              rows={3}
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-[#0EA5E9]/40"
            />
          </Field>

          {/* Min R:R */}
          <Field label="Minimum R:R (optional)">
            <input
              type="number"
              step="0.1"
              min="0"
              value={rrMin}
              onChange={(e) => setRrMin(e.target.value)}
              placeholder="e.g. 2.0"
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-[#0EA5E9]/40"
            />
          </Field>

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3 shrink-0">
          <button onClick={onClose} className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.06]">
            Cancel
          </button>
          <Button size="sm" loading={saving} onClick={handleSubmit}>
            {isEdit ? "Save Changes" : "Create Setup"}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{label}</p>
      {children}
    </div>
  );
}
