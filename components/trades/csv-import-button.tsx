"use client";

import { useState, useRef, useCallback } from "react";
import { FileSpreadsheet, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface ParsedTrade {
  symbol: string;
  direction: "buy" | "sell";
  entry_price: number | null;
  exit_price: number | null;
  entry_time: string | null;
  exit_time: string | null;
  profit_loss: number | null;
  volume: number | null;
}

interface ParseResult {
  trades: ParsedTrade[];
  broker_detected: string;
  total_parsed: number;
  total_valid: number;
}

type Step = "idle" | "uploading" | "parsing" | "preview" | "saving" | "done" | "error";

const MAX_PREVIEW = 50;

export function CSVImportButton() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("idle");
  const [trades, setTrades] = useState<ParsedTrade[]>([]);
  const [broker, setBroker] = useState("");
  const [totalParsed, setTotalParsed] = useState(0);
  const [error, setError] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a CSV file.");
      setStep("error");
      return;
    }

    if (file.size > 1_048_576) {
      setError("File too large. Maximum size is 1 MB.");
      setStep("error");
      return;
    }

    setStep("parsing");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/trades/universal-csv-import/parse", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Parsing failed");

      const result = json as ParseResult;
      if (!result.trades?.length) throw new Error("No closed trades found in the CSV.");

      setTrades(result.trades);
      setBroker(result.broker_detected);
      setTotalParsed(result.total_parsed);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parsing failed");
      setStep("error");
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (trades.length === 0) return;
    setStep("saving");
    try {
      const res = await fetch("/api/trades/universal-csv-import/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setSavedCount(json.saved);
      setSkippedCount(json.skipped);
      setStep("done");
      setTimeout(() => {
        setStep("idle");
        setTrades([]);
        router.refresh();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("error");
    }
  }, [trades, router]);

  const close = useCallback(() => {
    setStep("idle");
    setTrades([]);
    setBroker("");
    setTotalParsed(0);
    setError("");
    setSavedCount(0);
    setSkippedCount(0);
  }, []);

  // Stats
  const totalPnl = trades.reduce((s, t) => s + (t.profit_loss ?? 0), 0);
  const wins = trades.filter((t) => (t.profit_loss ?? 0) > 0).length;
  const winRate = trades.length > 0 ? ((wins / trades.length) * 100).toFixed(0) : "0";

  const showModal = step !== "idle";
  const previewTrades = trades.slice(0, MAX_PREVIEW);

  return (
    <>
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={step === "parsing" || step === "saving"}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-4 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.08] disabled:opacity-50"
      >
        <FileSpreadsheet className="h-4 w-4" />
        Import CSV
      </button>

      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={close}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="glass-strong relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <h2 className="text-lg font-bold text-foreground">
                {step === "parsing" && "Parsing CSV..."}
                {step === "preview" && `${trades.length} trade${trades.length !== 1 ? "s" : ""} found`}
                {step === "saving" && "Importing..."}
                {step === "done" && "Import complete"}
                {step === "error" && "Error"}
              </h2>
              <button onClick={close} className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {step === "parsing" && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-[#0EA5E9]" />
                  <p className="text-sm text-muted-foreground">AI is analyzing your CSV...</p>
                </div>
              )}

              {step === "error" && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                  <p className="text-sm text-red-400 text-center max-w-sm">{error}</p>
                  <button onClick={close} className="mt-2 rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-foreground hover:bg-white/[0.06]">
                    Close
                  </button>
                </div>
              )}

              {step === "done" && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                  <p className="text-sm text-foreground font-medium">
                    Imported {savedCount} trade{savedCount !== 1 ? "s" : ""}
                    {skippedCount > 0 && ` (${skippedCount} skipped)`}
                    {broker && broker !== "Unknown" && ` — Detected: ${broker}`}
                  </p>
                </div>
              )}

              {(step === "preview" || step === "saving") && (
                <>
                  {/* Summary */}
                  <div className="flex items-center gap-4 mb-4 flex-wrap">
                    {broker && broker !== "Unknown" && (
                      <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-center">
                        <p className="text-xs text-muted-foreground">Broker</p>
                        <p className="text-sm font-bold text-foreground">{broker}</p>
                      </div>
                    )}
                    <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-center">
                      <p className="text-xs text-muted-foreground">Valid</p>
                      <p className="text-lg font-bold text-foreground">{trades.length}</p>
                    </div>
                    {totalParsed > trades.length && (
                      <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-center">
                        <p className="text-xs text-muted-foreground">Filtered</p>
                        <p className="text-lg font-bold text-muted-foreground">{totalParsed - trades.length}</p>
                      </div>
                    )}
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
                          <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Symbol</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Dir</th>
                          <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground">Entry</th>
                          <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground">Exit</th>
                          <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground">PnL</th>
                          <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground">Volume</th>
                          <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {previewTrades.map((t, i) => (
                          <tr key={i} className="hover:bg-white/[0.02]">
                            <td className="px-2 py-2 font-mono text-xs font-bold text-foreground">{t.symbol}</td>
                            <td className="px-2 py-2">
                              <span className={cn("text-xs font-semibold uppercase", t.direction === "buy" ? "text-emerald-400" : "text-red-400")}>
                                {t.direction}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-xs text-muted-foreground">
                              {t.entry_price?.toFixed(5) ?? "—"}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-xs text-muted-foreground">
                              {t.exit_price?.toFixed(5) ?? "—"}
                            </td>
                            <td className={cn("px-2 py-2 text-right font-mono text-xs font-semibold", (t.profit_loss ?? 0) >= 0 ? "text-emerald-400" : "text-red-400")}>
                              {t.profit_loss !== null ? `${t.profit_loss >= 0 ? "+" : ""}${t.profit_loss.toFixed(2)}` : "—"}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-xs text-muted-foreground">
                              {t.volume ?? "—"}
                            </td>
                            <td className="px-2 py-2 text-left text-xs text-muted-foreground truncate max-w-[140px]">
                              {t.entry_time
                                ? new Date(t.entry_time).toLocaleString(undefined, {
                                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                                  })
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {trades.length > MAX_PREVIEW && (
                    <p className="mt-2 text-xs text-muted-foreground text-center">
                      Showing {MAX_PREVIEW} of {trades.length} trades
                    </p>
                  )}
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
                  disabled={trades.length === 0}
                  className="btn-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Confirm Import
                </button>
              </div>
            )}

            {step === "saving" && (
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
