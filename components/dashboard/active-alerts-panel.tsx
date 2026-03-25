"use client";

import { useEffect, useState, useCallback } from "react";
import { getAlerts, removeAlert, type StoredAlert } from "@/lib/alert-store";
import { Bell, X, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

const PRICE_POLL_MS = 15_000;

function labelColor(label: string): string {
  if (label === "SL") return "text-red-400";
  if (label.startsWith("TP")) return "text-emerald-400";
  return "text-[#0EA5E9]";
}

export function ActiveAlertsPanel() {
  const [alerts, setAlerts] = useState<StoredAlert[]>([]);
  const [prices, setPrices] = useState<Record<string, number | null>>({});

  const refresh = useCallback(() => {
    setAlerts(getAlerts());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("tf:alerts-changed", refresh);
    return () => window.removeEventListener("tf:alerts-changed", refresh);
  }, [refresh]);

  // Collect unique symbols
  const symbols = [...new Set(alerts.map((a) => a.symbol))];

  // Poll live prices
  useEffect(() => {
    if (symbols.length === 0) return;
    let active = true;

    async function fetchAll() {
      const next: Record<string, number | null> = {};
      await Promise.all(
        symbols.map(async (sym) => {
          try {
            const res = await fetch(`/api/prices/${sym}`, { cache: "no-store" });
            if (!res.ok) {
              console.warn(`[alerts-panel] price fetch failed for ${sym}:`, res.status);
              next[sym] = null;
              return;
            }
            const json = await res.json();
            next[sym] = typeof json.price === "number" ? json.price : null;
            console.log(`[alerts-panel] ${sym} = ${next[sym]}`);
          } catch {
            next[sym] = null;
          }
        })
      );
      if (active) setPrices(next);
    }

    fetchAll();
    const id = setInterval(fetchAll, PRICE_POLL_MS);
    return () => { active = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(",")]);

  // Group alerts by symbol
  const bySymbol = new Map<string, StoredAlert[]>();
  for (const a of alerts) {
    const arr = bySymbol.get(a.symbol) ?? [];
    arr.push(a);
    bySymbol.set(a.symbol, arr);
  }

  function handleRemove(id: string) {
    removeAlert(id);
    refresh();
  }

  return (
    <div className="glass rounded-xl">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <Bell className="h-4 w-4 text-[#0EA5E9]" />
        <h3 className="text-sm font-semibold">Active Alerts</h3>
        {alerts.length > 0 && (
          <span className="ml-auto rounded-full bg-[#0EA5E9]/15 px-2 py-0.5 text-[10px] font-bold text-[#0EA5E9]">
            {alerts.length}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground/20" />
          <p className="text-xs text-muted-foreground">No active alerts</p>
          <p className="mt-1 text-[11px] text-muted-foreground/50">
            Set alerts from an analysis result
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {Array.from(bySymbol.entries()).map(([symbol, symbolAlerts]) => {
            const livePrice = prices[symbol];
            const priceAvailable = livePrice != null;

            return (
              <div key={symbol} className="px-4 py-3 space-y-2">
                {/* Symbol header + live price */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{symbol}</span>
                    {symbolAlerts[0]?.direction && symbolAlerts[0].direction !== "NEUTRAL" && (
                      <span className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold",
                        symbolAlerts[0].direction === "BUY" ? "bg-emerald-400/15 text-emerald-400" : "bg-red-400/15 text-red-400"
                      )}>
                        {symbolAlerts[0].direction}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {priceAvailable ? (
                      <>
                        <Wifi className="h-3 w-3 text-emerald-400/60" />
                        <span className="font-mono text-xs font-semibold text-foreground/80">
                          {livePrice.toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3 w-3 text-muted-foreground/30" />
                        <span className="text-[11px] text-muted-foreground/40">offline</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Alert levels */}
                <div className="space-y-1">
                  {symbolAlerts.map((a) => {
                    const near = priceAvailable && Math.abs(livePrice - a.level) / a.level <= 0.005;
                    return (
                      <div
                        key={a.id}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-md px-2 py-1 transition-colors",
                          near && "bg-amber-400/10"
                        )}
                      >
                        <div className="flex items-center gap-2.5 text-xs">
                          <span className={cn("w-10 shrink-0 font-bold", labelColor(a.label))}>
                            {a.label}
                          </span>
                          <span className="font-mono text-foreground/70">{a.level.toFixed(2)}</span>
                          {near && (
                            <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                              NEAR
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemove(a.id)}
                          className="rounded p-1 text-muted-foreground/30 transition-colors hover:bg-white/[0.06] hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
