"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, FileSpreadsheet, Image, PenLine, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { CSVImportButton } from "./csv-import-button";
import { MT5ImportButton } from "./mt5-import-button";

export function AddTradeMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-gradient inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-sm font-semibold text-white"
      >
        <Plus className="h-4 w-4" />
        Add Trade
        <ChevronDown className="h-3.5 w-3.5 ml-0.5 opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl glass-strong border border-white/[0.08] shadow-2xl shadow-black/40 overflow-hidden">
          <div className="py-1.5">
            <button
              onClick={() => {
                setOpen(false);
                router.push("/trades/new");
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-white/[0.06] transition-colors"
            >
              <PenLine className="h-4 w-4 text-[#0EA5E9]" />
              <div className="text-left">
                <p className="font-medium">New Trade</p>
                <p className="text-[11px] text-muted-foreground">Log manually</p>
              </div>
            </button>

            <div className="mx-3 my-1 border-t border-white/[0.06]" />

            <CSVImportButton
              renderTrigger={(onClick) => (
                <button
                  onClick={() => { setOpen(false); onClick(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-white/[0.06] transition-colors"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                  <div className="text-left">
                    <p className="font-medium">Import CSV</p>
                    <p className="text-[11px] text-muted-foreground">Any broker export</p>
                  </div>
                </button>
              )}
            />

            <MT5ImportButton
              renderTrigger={(onClick) => (
                <button
                  onClick={() => { setOpen(false); onClick(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-white/[0.06] transition-colors"
                >
                  <Image className="h-4 w-4 text-amber-400" />
                  <div className="text-left">
                    <p className="font-medium">Import Screenshot</p>
                    <p className="text-[11px] text-muted-foreground">AI extracts trades</p>
                  </div>
                </button>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
