"use client";

import { useState, useRef } from "react";
import { Plus, Upload, X, Pencil, Trash2, ImageIcon, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

export type VisualLabelType = "valid" | "invalid" | "entry" | "sltp";

export interface StrategyVisual {
  id: string;
  strategy_id: string;
  title: string;
  image: string; // base64 data URL
  description: string;
  label_type: VisualLabelType;
  created_at: string;
}

// ── Storage ──────────────────────────────────────────────────────────────────

const VISUALS_KEY = "tf:strategy-visuals";

function loadAllVisuals(): StrategyVisual[] {
  try { const r = localStorage.getItem(VISUALS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}

function saveAllVisuals(v: StrategyVisual[]) {
  try { localStorage.setItem(VISUALS_KEY, JSON.stringify(v)); } catch {}
}

function getVisualsForStrategy(strategyId: string): StrategyVisual[] {
  return loadAllVisuals().filter((v) => v.strategy_id === strategyId);
}

function addVisual(v: StrategyVisual) {
  const all = loadAllVisuals();
  all.push(v);
  saveAllVisuals(all);
}

function updateVisual(id: string, patch: Partial<StrategyVisual>) {
  const all = loadAllVisuals().map((v) => v.id === id ? { ...v, ...patch } : v);
  saveAllVisuals(all);
}

function deleteVisual(id: string) {
  saveAllVisuals(loadAllVisuals().filter((v) => v.id !== id));
}

// ── Label badge ──────────────────────────────────────────────────────────────

const LABEL_STYLES: Record<VisualLabelType, string> = {
  valid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  invalid: "bg-red-500/15 text-red-400 border-red-500/20",
  entry: "bg-[#0EA5E9]/15 text-[#0EA5E9] border-[#0EA5E9]/20",
  sltp: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

const LABEL_NAMES: Record<VisualLabelType, string> = {
  valid: "Valid Setup",
  invalid: "Invalid Setup",
  entry: "Entry Example",
  sltp: "SL/TP Example",
};

function LabelBadge({ type }: { type: VisualLabelType }) {
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium", LABEL_STYLES[type])}>
      {LABEL_NAMES[type]}
    </span>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface StrategyVisualsProps {
  strategyId: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function StrategyVisuals({ strategyId }: StrategyVisualsProps) {
  const [visuals, setVisuals] = useState<StrategyVisual[]>(() => getVisualsForStrategy(strategyId));
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLabel, setFormLabel] = useState<VisualLabelType>("valid");
  const [formImage, setFormImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function refresh() { setVisuals(getVisualsForStrategy(strategyId)); }

  function resetForm() {
    setFormTitle("");
    setFormDesc("");
    setFormLabel("valid");
    setFormImage(null);
    setAdding(false);
    setEditingId(null);
  }

  function handleFileUpload(files: FileList) {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") setFormImage(reader.result); };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    if (!formTitle.trim() || !formImage) return;

    if (editingId) {
      updateVisual(editingId, {
        title: formTitle.trim(),
        description: formDesc.trim(),
        label_type: formLabel,
        image: formImage,
      });
    } else {
      addVisual({
        id: crypto.randomUUID(),
        strategy_id: strategyId,
        title: formTitle.trim(),
        image: formImage,
        description: formDesc.trim(),
        label_type: formLabel,
        created_at: new Date().toISOString(),
      });
    }
    resetForm();
    refresh();
  }

  function startEdit(v: StrategyVisual) {
    setEditingId(v.id);
    setFormTitle(v.title);
    setFormDesc(v.description);
    setFormLabel(v.label_type);
    setFormImage(v.image);
    setAdding(true);
  }

  function handleDelete(id: string) {
    deleteVisual(id);
    setDeleteConfirm(null);
    refresh();
  }

  const previewVisual = previewId ? visuals.find((v) => v.id === previewId) : null;

  return (
    <div className="space-y-2 pt-2 border-t border-white/[0.04]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Visual Examples</p>
        {!adding && (
          <button onClick={() => { resetForm(); setAdding(true); }} className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-[#0EA5E9] hover:bg-[#0EA5E9]/10">
            <Plus className="h-3 w-3" /> Add Example
          </button>
        )}
      </div>

      {/* ── Add/Edit form ─────────────────────────────────────────── */}
      {adding && (
        <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 space-y-2">
          {/* Image upload */}
          {formImage ? (
            <div className="relative">
              <img src={formImage} alt="Preview" className="w-full max-h-40 object-contain rounded-lg bg-black/20" />
              <button onClick={() => setFormImage(null)} className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 hover:bg-black/80">
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-white/[0.08] hover:border-white/[0.15] px-4 py-4 text-center transition-colors"
            >
              <Upload className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-[11px] text-muted-foreground">Click to upload image</p>
              <p className="text-[10px] text-muted-foreground/50">JPG, PNG, WebP</p>
            </button>
          )}
          <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files)} />

          {/* Title */}
          <input
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Example title..."
            className="w-full rounded bg-white/[0.06] border border-white/[0.08] px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#0EA5E9]/40"
          />

          {/* Description */}
          <textarea
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            placeholder="Brief explanation of what this example shows..."
            rows={2}
            className="w-full rounded bg-white/[0.06] border border-white/[0.08] px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#0EA5E9]/40 resize-none"
          />

          {/* Label type */}
          <div className="flex items-center gap-1.5">
            {(Object.keys(LABEL_NAMES) as VisualLabelType[]).map((lt) => (
              <button
                key={lt}
                onClick={() => setFormLabel(lt)}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                  formLabel === lt ? LABEL_STYLES[lt] : "border-white/[0.06] text-muted-foreground hover:bg-white/[0.04]"
                )}
              >
                {LABEL_NAMES[lt]}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={resetForm} className="flex-1 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.06]">Cancel</button>
            <button onClick={handleSave} disabled={!formTitle.trim() || !formImage} className="flex-1 rounded-lg bg-[#0EA5E9]/15 px-3 py-1.5 text-xs font-semibold text-[#0EA5E9] hover:bg-[#0EA5E9]/25 disabled:opacity-40">
              {editingId ? "Update" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* ── Visual gallery ────────────────────────────────────────── */}
      {visuals.length === 0 && !adding && (
        <div className="text-center py-4">
          <ImageIcon className="h-6 w-6 text-muted-foreground/20 mx-auto mb-1.5" />
          <p className="text-[11px] text-muted-foreground">No visual examples yet</p>
        </div>
      )}

      {visuals.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {visuals.map((v) => (
            <div key={v.id} className="rounded-lg bg-white/[0.02] border border-white/[0.06] overflow-hidden group">
              {/* Image */}
              <div className="relative cursor-pointer" onClick={() => setPreviewId(v.id)}>
                <img src={v.image} alt={v.title} className="w-full h-24 object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Eye className="h-4 w-4 text-white" />
                </div>
              </div>
              {/* Info */}
              <div className="px-2 py-1.5 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-medium text-foreground truncate">{v.title}</span>
                  <LabelBadge type={v.label_type} />
                </div>
                {v.description && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{v.description}</p>
                )}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(v)} className="rounded p-0.5 text-muted-foreground hover:text-foreground"><Pencil className="h-2.5 w-2.5" /></button>
                  {deleteConfirm === v.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-red-400">Delete?</span>
                      <button onClick={() => handleDelete(v.id)} className="text-[9px] text-red-400 font-bold hover:underline">Yes</button>
                      <button onClick={() => setDeleteConfirm(null)} className="text-[9px] text-muted-foreground hover:underline">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(v.id)} className="rounded p-0.5 text-muted-foreground hover:text-red-400"><Trash2 className="h-2.5 w-2.5" /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Lightbox preview ──────────────────────────────────────── */}
      {previewVisual && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setPreviewId(null)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewId(null)} className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80">
              <X className="h-4 w-4" />
            </button>
            <img src={previewVisual.image} alt={previewVisual.title} className="w-full max-h-[65vh] object-contain rounded-t-xl bg-black" />
            <div className="bg-white/[0.06] backdrop-blur-xl rounded-b-xl px-4 py-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{previewVisual.title}</span>
                <LabelBadge type={previewVisual.label_type} />
              </div>
              {previewVisual.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">{previewVisual.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
