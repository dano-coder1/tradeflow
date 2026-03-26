"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface ExtractedTrade {
  symbol: string;
  direction: "LONG" | "SHORT";
  size: number | null;
  entry: number | null;
  exit: number | null;
  pnl: number | null;
  date: string | null;
}

type Step = "idle" | "extracting" | "preview" | "importing" | "done" | "error";

export function MT5ImportButton() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("idle");
  const [trades, setTrades] = useState<ExtractedTrade[]>([]);
  const [error, setError] = useState("");
  const [importedCount, setImportedCount] = useState(0);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      setStep("error");
      return;
    }

    setStep("extracting");
    setError("");

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/trades/import-screenshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: reader.result }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Extraction failed");
        if (!json.trades?.length) throw new Error("No trades found in the screenshot.");
        setTrades(json.trades);
        setStep("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Extraction failed");
        setStep("error");
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleImport = useCallback(async () => {
    setStep("importing");
    try {
      const res = await fetch("/api/trades/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setImportedCount(json.imported);
      setStep("done");
      setTimeout(() => {
        setStep("idle");
        setTrades([]);
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("error");
    }
  }, [trades, router]);

  const close = useCallback(() => {
    setStep("idle");
    setTrades([]);
    setError("");
  }, []);

  // Stats
  const totalPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins = trades.filter((t) => (t.pnl ?? 0) > 0).length;
  const winRate = trades.length > 0 ? ((wins / trades.length) * 100).toFixed(0) : "0";

  const showModal = step === "preview" || step === "importing" || step === "extracting" || step === "done" || step === "error";

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={step === "extracting" || step === "importing"}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.08] disabled:opacity-50"
      >
        <Upload className="h-4 w-4" />
        Import MT5
      </button>

      {/* Modal overlay */}
      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={close}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="glass-strong relative w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <h2 className="text-lg font-bold text-foreground">
                {step === "extracting" && "Extracting trades..."}
                {step === "preview" && `Found ${trades.length} trades`}
                {step === "importing" && "Importing..."}
                {step === "done" && "Import complete"}
                {step === "error" && "Error"}
              </h2>
              <button onClick={close} className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Extracting */}
              {step === "extracting" && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-[#0EA5E9]" />
                  <p className="text-sm text-muted-foreground">Analyzing screenshot with AI...</p>
                </div>
              )}

              {/* Error */}
              {step === "error" && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                  <p className="text-sm text-red-400">{error}</p>
                  <button onClick={close} className="mt-2 rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-foreground hover:bg-white/[0.06]">
                    Close
                  </button>
                </div>
              )}

              {/* Done */}
              {step === "done" && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                  <p className="text-sm text-foreground font-medium">{importedCount} trades imported successfully</p>
                </div>
              )}

              {/* Preview table */}
              {(step === "preview" || step === "importing") && (
                <>
                  {/* Summary */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground">Trades</p>
                      <p className="text-lg font-bold text-foreground">{trades.length}</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground">Win Rate</p>
                      <p className="text-lg font-bold text-foreground">{winRate}%</p>
                    </div>
                    <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground">Total PnL</p>
                      <p className={cn("text-lg font-bold font-mono", totalPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Symbol</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Dir</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Entry</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Exit</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">PnL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {trades.map((t, i) => (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-3 py-2 font-mono text-xs font-bold text-foreground">{t.symbol}</td>
                            <td className="px-3 py-2">
                              <span className={cn("text-xs font-semibold", t.direction === "LONG" ? "text-emerald-400" : "text-red-400")}>
                                {t.direction}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                              {t.entry?.toFixed(5) ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                              {t.exit?.toFixed(5) ?? "—"}
                            </td>
                            <td className={cn("px-3 py-2 text-right font-mono text-xs font-semibold", (t.pnl ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
                              {t.pnl !== null ? `${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {step === "preview" && (
              <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] px-6 py-4">
                <button onClick={close} className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  className="btn-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white"
                >
                  Import All
                </button>
              </div>
            )}

            {step === "importing" && (
              <div className="flex items-center justify-center border-t border-white/[0.06] px-6 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-[#0EA5E9] mr-2" />
                <span className="text-sm text-muted-foreground">Saving trades...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
