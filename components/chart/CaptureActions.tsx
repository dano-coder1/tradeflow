"use client";

import { useState, useEffect } from "react";
import { Camera, Layers, Zap, Loader2, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CapturedShot {
  dataUrl: string;
  symbol: string;
  timeframe: string;
  chartMode: string;
  timestamp: number;
}

interface CaptureActionsProps {
  onCaptureCurrent: () => Promise<CapturedShot | null>;
  onCaptureFullSet: () => Promise<CapturedShot[]>;
  onAnalyzeNow: () => Promise<void>;
  drafts: CapturedShot[];
}

export function CaptureActions({ onCaptureCurrent, onCaptureFullSet, onAnalyzeNow, drafts }: CaptureActionsProps) {
  const [capturing, setCapturing] = useState(false);
  const [capturingSet, setCapturingSet] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleCapture() {
    setCapturing(true);
    try {
      const shot = await onCaptureCurrent();
      if (shot) setToast(`Captured ${shot.timeframe} chart`);
      else setToast("Capture failed — try Advanced Chart mode");
    } catch { setToast("Capture failed"); }
    setCapturing(false);
  }

  async function handleFullSet() {
    setCapturingSet(true);
    try {
      const shots = await onCaptureFullSet();
      if (shots.length > 0) setToast(`Captured ${shots.length} timeframes`);
      else setToast("No charts captured");
    } catch { setToast("Capture failed"); }
    setCapturingSet(false);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      await onAnalyzeNow();
    } catch { setToast("Failed to open analyzer"); }
    setAnalyzing(false);
  }

  const busy = capturing || capturingSet || analyzing;

  return (
    <div className="flex items-center gap-1.5 rounded-lg glass px-2 py-1.5 relative">
      <button
        onClick={handleCapture}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:opacity-50"
      >
        {capturing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        Capture TF
      </button>

      <button
        onClick={handleFullSet}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:opacity-50"
      >
        {capturingSet ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
        Full Set
      </button>

      <div className="mx-0.5 h-4 w-px bg-white/[0.08]" />

      <button
        onClick={handleAnalyze}
        disabled={busy}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
          "bg-[#8B5CF6]/15 text-[#8B5CF6] hover:bg-[#8B5CF6]/25 disabled:opacity-50"
        )}
      >
        {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
        Analyze Now
      </button>

      {drafts.length > 0 && (
        <span className="ml-1 rounded-full bg-[#0EA5E9]/15 px-2 py-0.5 text-[10px] font-bold text-[#0EA5E9]">
          {drafts.length} captured
        </span>
      )}

      {/* Toast */}
      {toast && (
        <div className="absolute -bottom-9 left-0 flex items-center gap-1.5 rounded-lg bg-white/[0.08] backdrop-blur-md px-3 py-1.5 text-xs text-foreground shadow-lg z-50 animate-fade-in">
          <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}
