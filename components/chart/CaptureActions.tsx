"use client";

import { useState, useEffect } from "react";
import { Camera, Layers, Zap, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CapturedShot {
  id: string;
  dataUrl: string;
  symbol: string;
  timeframe: string;
  chartMode: string;
  capturedAt: number;
}

interface CaptureActionsProps {
  onCaptureCurrent: () => Promise<CapturedShot | null>;
  onCaptureFullSet: () => Promise<CapturedShot[]>;
  onAnalyzeNow: () => Promise<void>;
  drafts: CapturedShot[];
  chartMode: string | null;
  /** Progress text during full-set capture, e.g. "Capturing 3/7…" */
  fullSetProgress?: string | null;
}

const TV_MSG = "TradingView screenshots are not supported. Switch to Advanced Chart to capture.";

export function CaptureActions({ onCaptureCurrent, onCaptureFullSet, onAnalyzeNow, drafts, chartMode, fullSetProgress }: CaptureActionsProps) {
  const [capturing, setCapturing] = useState(false);
  const [capturingSet, setCapturingSet] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "warn" | "error" } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (message: string, type: "success" | "warn" | "error" = "success") =>
    setToast({ message, type });

  const isTradingView = chartMode === "tradingview";

  async function handleCapture() {
    if (isTradingView) { showToast(TV_MSG, "warn"); return; }
    setCapturing(true);
    try {
      const shot = await onCaptureCurrent();
      if (shot) showToast(`Captured ${shot.timeframe} chart — added to analyzer draft`);
      else showToast("Capture failed — chart may not be ready", "error");
    } catch { showToast("Capture failed", "error"); }
    setCapturing(false);
  }

  async function handleFullSet() {
    if (isTradingView) { showToast(TV_MSG, "warn"); return; }
    setCapturingSet(true);
    try {
      const shots = await onCaptureFullSet();
      if (shots.length > 0) showToast(`Captured ${shots.length} timeframes`);
      else showToast("No charts captured", "error");
    } catch { showToast("Capture failed", "error"); }
    setCapturingSet(false);
  }

  async function handleAnalyze() {
    if (isTradingView && drafts.length === 0) { showToast(TV_MSG, "warn"); return; }
    setAnalyzing(true);
    try {
      await onAnalyzeNow();
    } catch { showToast("Failed to open analyzer", "error"); }
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

      {/* Full-set progress */}
      {capturingSet && fullSetProgress && (
        <span className="ml-1 text-[10px] text-muted-foreground animate-pulse">
          {fullSetProgress}
        </span>
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          "absolute -bottom-10 left-0 flex items-center gap-1.5 rounded-lg backdrop-blur-md px-3 py-1.5 text-xs shadow-lg z-50 animate-fade-in max-w-xs",
          toast.type === "success" && "bg-white/[0.08] text-foreground",
          toast.type === "warn" && "bg-amber-500/10 text-amber-300 border border-amber-500/20",
          toast.type === "error" && "bg-red-500/10 text-red-300 border border-red-500/20",
        )}>
          {toast.type === "success" && <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />}
          {toast.type === "warn" && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />}
          {toast.type === "error" && <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
