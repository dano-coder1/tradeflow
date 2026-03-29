"use client";

import { useState, useEffect, useCallback } from "react";
import { Wallet, TrendingUp, TrendingDown, X, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CreateDemoAccountModal } from "./create-demo-account-modal";
import type { DemoAccount, DemoPosition, DemoTrade } from "@/types/demo";
import { formatPnL, currencySymbol } from "@/lib/currency";

// ── Props ───────────────────────────────────────────────────────────────────

interface DemoTradingPanelProps {
  /** Current symbol from chart context */
  symbol?: string;
  /** Current live price */
  currentPrice?: number | null;
}

// ── Component ───────────────────────────────────────────────────────────────

export function DemoTradingPanel({ symbol = "EURUSD", currentPrice }: DemoTradingPanelProps) {
  const [account, setAccount] = useState<DemoAccount | null>(null);
  const [positions, setPositions] = useState<DemoPosition[]>([]);
  const [recentTrades, setRecentTrades] = useState<DemoTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tab, setTab] = useState<"trade" | "positions" | "history">("trade");

  // Trade form state
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("0.01");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [closingId, setClosingId] = useState<string | null>(null);

  const cur = account?.currency ?? "USD";
  const sym = currencySymbol(cur);

  // ── Fetch account + positions ──────────────────────────────────────────────

  const refresh = useCallback(async () => {
    try {
      const [accRes, posRes, tradeRes] = await Promise.all([
        fetch("/api/demo/account"),
        fetch("/api/demo/positions"),
        fetch("/api/demo/trades"),
      ]);
      const accData = await accRes.json();
      const posData = await posRes.json();
      const tradeData = await tradeRes.json();

      setAccount(accData.account ?? null);
      setPositions(posData.positions ?? []);
      setRecentTrades((tradeData.trades ?? []).slice(0, 20));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Open position ──────────────────────────────────────────────────────────

  async function handleOpen() {
    if (!account || !currentPrice) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/demo/open-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: account.id,
          symbol,
          direction,
          size: Number(size),
          entry_price: currentPrice,
          sl: sl.trim() ? Number(sl) : null,
          tp: tp.trim() ? Number(tp) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open position");
      setSl("");
      setTp("");
      setTab("positions");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Close position ─────────────────────────────────────────────────────────

  async function handleClose(posId: string) {
    if (!currentPrice) return;
    setClosingId(posId);
    try {
      const res = await fetch("/api/demo/close-position", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position_id: posId, exit_price: currentPrice, close_reason: "manual" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to close");
      }
      refresh();
    } catch {
      // silent
    } finally {
      setClosingId(null);
    }
  }

  // ── Loading / No Account ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="glass rounded-xl p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!account) {
    return (
      <>
        <div className="glass rounded-xl p-5 text-center space-y-3">
          <Wallet className="h-8 w-8 text-[#8B5CF6] mx-auto" />
          <p className="text-sm font-semibold text-foreground">Paper Trading</p>
          <p className="text-xs text-muted-foreground">Practice trading with simulated funds</p>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-3.5 w-3.5" /> Create Demo Account
          </Button>
        </div>
        {showCreateModal && (
          <CreateDemoAccountModal
            onClose={() => setShowCreateModal(false)}
            onCreated={(acc) => { setAccount(acc); setShowCreateModal(false); }}
          />
        )}
      </>
    );
  }

  // ── Main Panel ─────────────────────────────────────────────────────────────

  const openPnl = positions.reduce((sum, p) => {
    if (!currentPrice) return sum;
    const pnl = p.direction === "buy"
      ? (currentPrice - Number(p.entry_price)) * Number(p.size)
      : (Number(p.entry_price) - currentPrice) * Number(p.size);
    return sum + pnl;
  }, 0);

  return (
    <>
      <div className="glass rounded-xl overflow-hidden">
        {/* Account bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#8B5CF6]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#8B5CF6] uppercase">SIM</span>
            <span className="text-xs font-bold text-foreground">{sym}{Number(account.balance).toLocaleString()}</span>
          </div>
          {positions.length > 0 && (
            <span className={cn("text-[10px] font-bold font-mono", openPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
              P&L: {formatPnL(openPnl, cur)}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06]">
          {(["trade", "positions", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors",
                tab === t ? "text-foreground border-b-2 border-[#0EA5E9]" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "positions" ? `Positions (${positions.length})` : t}
            </button>
          ))}
        </div>

        <div className="p-3">
          {/* ── Trade Tab ─────────────────────────────────────── */}
          {tab === "trade" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-foreground">{symbol}</span>
                <span className="font-mono text-sm text-muted-foreground">
                  {currentPrice != null ? currentPrice.toFixed(5) : "—"}
                </span>
              </div>

              {/* Buy / Sell buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDirection("buy")}
                  className={cn(
                    "rounded-lg py-2.5 text-xs font-bold uppercase transition-all",
                    direction === "buy"
                      ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                      : "bg-white/[0.03] text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400"
                  )}
                >
                  <TrendingUp className="inline h-3.5 w-3.5 mr-1" /> Buy
                </button>
                <button
                  onClick={() => setDirection("sell")}
                  className={cn(
                    "rounded-lg py-2.5 text-xs font-bold uppercase transition-all",
                    direction === "sell"
                      ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/40"
                      : "bg-white/[0.03] text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                  )}
                >
                  <TrendingDown className="inline h-3.5 w-3.5 mr-1" /> Sell
                </button>
              </div>

              {/* Size */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Size (Lots)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-[#0EA5E9]/40"
                />
              </div>

              {/* SL / TP */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Stop Loss</label>
                  <input
                    type="number"
                    step="any"
                    value={sl}
                    onChange={(e) => setSl(e.target.value)}
                    placeholder="—"
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-[#0EA5E9]/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Take Profit</label>
                  <input
                    type="number"
                    step="any"
                    value={tp}
                    onChange={(e) => setTp(e.target.value)}
                    placeholder="—"
                    className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-[#0EA5E9]/40"
                  />
                </div>
              </div>

              {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

              <Button
                className="w-full"
                loading={submitting}
                disabled={!currentPrice}
                onClick={handleOpen}
              >
                {direction === "buy" ? "Buy" : "Sell"} {symbol}
              </Button>
            </div>
          )}

          {/* ── Positions Tab ──────────────────────────────────── */}
          {tab === "positions" && (
            <div className="space-y-1.5">
              {positions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No open positions</p>
              ) : (
                positions.map((p) => {
                  const unrealizedPnl = currentPrice
                    ? p.direction === "buy"
                      ? (currentPrice - Number(p.entry_price)) * Number(p.size)
                      : (Number(p.entry_price) - currentPrice) * Number(p.size)
                    : 0;
                  return (
                    <div key={p.id} className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-foreground">{p.symbol}</span>
                          <span className={cn("text-[9px] font-bold uppercase", p.direction === "buy" ? "text-emerald-400" : "text-red-400")}>
                            {p.direction}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{Number(p.size)} lots</span>
                        </div>
                        <span className={cn("font-mono text-[10px] font-bold", unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {formatPnL(unrealizedPnl, cur)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          Entry: {Number(p.entry_price).toFixed(5)}
                        </span>
                        <button
                          onClick={() => handleClose(p.id)}
                          disabled={closingId === p.id}
                          className="rounded bg-red-500/15 px-2 py-0.5 text-[9px] font-bold text-red-400 hover:bg-red-500/25 disabled:opacity-50"
                        >
                          {closingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Close"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── History Tab ──────────────────────────────────── */}
          {tab === "history" && (
            <div className="space-y-1.5">
              {recentTrades.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No closed trades yet</p>
              ) : (
                recentTrades.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 rounded bg-white/[0.02] px-2 py-1.5 text-[11px]">
                    <span className="font-mono font-bold text-foreground">{t.symbol}</span>
                    <span className={cn("text-[9px] font-bold uppercase", t.direction === "buy" ? "text-emerald-400" : "text-red-400")}>{t.direction}</span>
                    <span className="text-muted-foreground">{Number(t.size)}</span>
                    <span className={cn("ml-auto font-mono font-bold", t.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {formatPnL(t.pnl, cur)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateDemoAccountModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(acc) => { setAccount(acc); setShowCreateModal(false); }}
        />
      )}
    </>
  );
}
