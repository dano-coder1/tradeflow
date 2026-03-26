"use client";

import { Minus, Square, Trash2, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type DrawingTool = "line" | "zone" | null;

interface ChartToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onClear: () => void;
  onSave: () => void;
  saving: boolean;
}

export function ChartToolbar({ activeTool, onToolChange, onClear, onSave, saving }: ChartToolbarProps) {
  const tools: { key: DrawingTool; label: string; icon: typeof Minus }[] = [
    { key: "line", label: "Line", icon: Minus },
    { key: "zone", label: "Zone", icon: Square },
  ];

  return (
    <div className="flex items-center gap-1.5 rounded-lg glass px-2 py-1.5">
      {tools.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onToolChange(activeTool === key ? null : key)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            activeTool === key
              ? "bg-[#0EA5E9]/15 text-[#0EA5E9]"
              : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}

      <div className="mx-1 h-4 w-px bg-white/[0.08]" />

      <button
        onClick={onClear}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Clear
      </button>

      <button
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-400 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save
      </button>
    </div>
  );
}
