"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Wallet, TrendingUp, TrendingDown, Loader2, Plus, ChevronDown, AlertTriangle, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal";
import { CreateDemoAccountModal } from "./create-demo-account-modal";
import type { DemoAccount, DemoPosition, DemoTrade } from "@/types/demo";
import { formatPnL, currencySymbol } from "@/lib/currency";
import {
  getInstrument,
  requiredMargin,
  positionValue,
  calculateDemoPnL,
  type InstrumentConfig,
} from "@/lib/trading/instruments";

const QUICK_SYMBOLS = [
  "XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "GBPJPY",
  "NAS100", "US30", "BTCUSD", "ETHUSD", "USOIL",
];

interface DemoTradingPanelProps {
  symbol?: string;
  currentPrice?: number | null;
}

export function DemoTradingPanel({ symbol: externalSymbol = "EURUSD", currentPrice: externalPrice }: DemoTradingPanelProps) {
  // ── Accounts state ─────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [positions, setPositions] = useState<DemoPosition[]>([]);
  const [recentTrades, setRecentTrades] = useState<DemoTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showFundsModal, setShowFundsModal] = useState(false);
  const [tab, setTab] = useState<"trade" | "positions" | "history">("trade");

  const account = accounts.find((a) => a.id === activeAccountId) ?? null;

  // ── Symbol state ───────────────────────────────────────────────────────────
  const [localSymbol, setLocalSymbol] = useState(externalSymbol);
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const activeSymbol = localSymbol;
  const currentPrice = activeSymbol === externalSymbol ? externalPrice : null;

  useEffect(() => { setLocalSymbol(externalSymbol); }, [externalSymbol]);

  const instrument = useMemo(() => getInstrument(activeSymbol), [activeSymbol]);

  // ── Trade form ─────────────────────────────────────────────────────────────
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [size, setSize] = useState("0.01");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [closingId, setClosingId] = useState<string | null>(null);

  const cur = account?.currency ?? "USD";
  const sym = currencySymbol(cur);
  const leverage = account?.leverage ?? 100;

  // ── Unrealized PnL ─────────────────────────────────────────────────────────
  function unrealizedPnl(p: DemoPosition): number {
    if (!currentPrice || p.symbol !== activeSymbol) return 0;
    return calculateDemoPnL(p.direction, Number(p.entry_price), currentPrice, Number(p.size), Number(p.contract_size));
  }

  // ── Account metrics ────────────────────────────────────────────────────────
  const floatingPnl = positions.reduce((sum, p) => sum + unrealizedPnl(p), 0);
  const balance = Number(account?.balance ?? 0);
  const usedMargin = Number(account?.used_margin ?? 0);
  const equity = balance + floatingPnl;
  const freeMargin = equity - usedMargin;
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : Infinity;
  const isMarginWarning = marginLevel < 150 && marginLevel !== Infinity;

  // ── New order values ───────────────────────────────────────────────────────
  const lots = Number(size) || 0;
  const posValue = currentPrice ? positionValue(lots, instrument.contract_size, currentPrice) : 0;
  const orderMargin = currentPrice ? requiredMargin(lots, instrument.contract_size, currentPrice, leverage) : 0;
  const canOpen = currentPrice != null && lots > 0 && orderMargin <= freeMargin && account != null;

  // ── Data fetching ──────────────────────────────────────────────────────────
  const refresh = useCallback(async (accId?: string | null) => {
    try {
      const targetId = accId ?? activeAccountId;
      const qs = targetId ? `?account_id=${targetId}` : "";
      const [accRes, posRes, tradeRes] = await Promise.all([
        fetch("/api/demo/account"),
        fetch(`/api/demo/positions${qs}`),
        fetch(`/api/demo/trades${qs}`),
      ]);
      const accData = await accRes.json();
      const posData = await posRes.json();
      const tradeData = await tradeRes.json();

      const accs: DemoAccount[] = accData.accounts ?? [];
      setAccounts(accs);

      // Auto-select first account if none active
      if (!targetId && accs.length > 0) {
        setActiveAccountId(accs[0].id);
      }

      setPositions(posData.positions ?? []);
      setRecentTrades((tradeData.trades ?? []).slice(0, 20));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [activeAccountId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Refetch positions/trades when switching account
  function switchAccount(id: string) {
    setActiveAccountId(id);
    setShowAccountPicker(false);
    setLoading(true);
    refresh(id);
  }

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
          symbol: activeSymbol,
          direction,
          size: lots,
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

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="glass rounded-xl p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── No accounts ────────────────────────────────────────────────────────────
  if (accounts.length === 0) {
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
            onCreated={(acc) => { setShowCreateModal(false); setActiveAccountId(acc.id); refresh(); }}
          />
        )}
      </>
    );
  }

  // ── Main panel ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="glass rounded-xl overflow-hidden">
        {/* ── Account switcher + metrics ─────────────────────── */}
        <div className="px-3 py-2 border-b border-white/[0.06] space-y-1.5">
          {/* Account selector row */}
          <div className="flex items-center justify-between">
            <div className="relative flex items-center gap-1.5">
              <span className="rounded bg-[#8B5CF6]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#8B5CF6] uppercase">SIM</span>
              <button
                onClick={() => setShowAccountPicker((v) => !v)}
                className="flex items-center gap-1 text-xs font-bold text-foreground hover:text-[#0EA5E9] transition-colors"
              >
                {account?.name ?? "Select"} <ChevronDown className="h-3 w-3" />
              </button>

              {showAccountPicker && (
                <div className="absolute left-0 top-full mt-1 z-30 w-52 rounded-lg glass-strong border border-white/[0.08] shadow-xl overflow-hidden">
                  {accounts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => switchAccount(a.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-xs transition-colors",
                        a.id === activeAccountId ? "bg-white/[0.06] text-foreground" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                      )}
                    >
                      <span className="font-medium truncate">{a.name}</span>
                      <span className="font-mono text-[10px]">${Number(a.balance).toLocaleString()}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => { setShowAccountPicker(false); setShowCreateModal(true); }}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-[#0EA5E9] hover:bg-white/[0.04] border-t border-white/[0.06]"
                  >
                    <Plus className="h-3 w-3" /> New Account
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-muted-foreground">1:{leverage}</span>
              <button
                onClick={() => setShowFundsModal(true)}
                className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400 hover:bg-emerald-500/25 transition-colors"
              >
                + Funds
              </button>
              {isMarginWarning && (
                <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                </span>
              )}
            </div>
          </div>

          {/* 4-column metrics */}
          <div className="grid grid-cols-4 gap-1.5">
            <MetricCell label="Balance" value={`${sym}${balance.toFixed(2)}`} />
            <MetricCell label="Equity" value={`${sym}${equity.toFixed(2)}`} color={equity >= balance ? "text-emerald-400" : "text-red-400"} />
            <MetricCell label="Used" value={`${sym}${usedMargin.toFixed(2)}`} />
            <MetricCell label="Free" value={`${sym}${freeMargin.toFixed(2)}`} color={freeMargin < 0 ? "text-red-400" : undefined} />
          </div>

          {positions.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground">Floating P&L</span>
              <span className={cn("text-[10px] font-bold font-mono", floatingPnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                {formatPnL(floatingPnl, cur)}
              </span>
            </div>
          )}
        </div>

        {/* ── Tabs ─────────────────────────────────────────────── */}
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
              {/* Symbol selector */}
              <div className="relative">
                <button
                  onClick={() => setShowSymbolPicker((v) => !v)}
                  className="flex items-center justify-between w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-foreground">{activeSymbol}</span>
                    <InstrumentBadge config={instrument} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">
                      {currentPrice != null ? currentPrice.toFixed(instrument.digits) : "—"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </button>
                {showSymbolPicker && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg glass-strong border border-white/[0.08] shadow-xl p-2 max-h-48 overflow-y-auto">
                    <div className="flex flex-wrap gap-1">
                      {QUICK_SYMBOLS.map((s) => (
                        <button
                          key={s}
                          onClick={() => { setLocalSymbol(s); setShowSymbolPicker(false); }}
                          className={cn(
                            "rounded px-2 py-1 text-[10px] font-bold font-mono transition-colors",
                            s === activeSymbol ? "bg-[#0EA5E9]/15 text-[#0EA5E9]" : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Buy / Sell */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setDirection("buy")} className={cn("rounded-lg py-2.5 text-xs font-bold uppercase transition-all", direction === "buy" ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40" : "bg-white/[0.03] text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400")}>
                  <TrendingUp className="inline h-3.5 w-3.5 mr-1" /> Buy
                </button>
                <button onClick={() => setDirection("sell")} className={cn("rounded-lg py-2.5 text-xs font-bold uppercase transition-all", direction === "sell" ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/40" : "bg-white/[0.03] text-muted-foreground hover:bg-red-500/10 hover:text-red-400")}>
                  <TrendingDown className="inline h-3.5 w-3.5 mr-1" /> Sell
                </button>
              </div>

              {/* Size */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Size (Lots) · step {instrument.lot_step}</label>
                <input type="number" step={instrument.lot_step} min={instrument.min_lot} max={instrument.max_lot} value={size} onChange={(e) => setSize(e.target.value)} className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-[#0EA5E9]/40" />
              </div>

              {/* Margin info */}
              {currentPrice != null && lots > 0 && (
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">Pos. Value</p>
                    <p className="text-xs font-mono font-semibold text-foreground">{sym}{posValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">Margin Req.</p>
                    <p className={cn("text-xs font-mono font-semibold", orderMargin > freeMargin ? "text-red-400" : "text-foreground")}>{sym}{orderMargin.toFixed(2)}</p>
                  </div>
                </div>
              )}

              {/* SL / TP */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Stop Loss</label>
                  <input type="number" step="any" value={sl} onChange={(e) => setSl(e.target.value)} placeholder="—" className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-[#0EA5E9]/40" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Take Profit</label>
                  <input type="number" step="any" value={tp} onChange={(e) => setTp(e.target.value)} placeholder="—" className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-[#0EA5E9]/40" />
                </div>
              </div>

              {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

              <Button className="w-full" loading={submitting} disabled={!canOpen} onClick={handleOpen}>
                {direction === "buy" ? "Buy" : "Sell"} {activeSymbol}
              </Button>
            </div>
          )}

          {/* ── Positions Tab ──────────────────────────────────── */}
          {tab === "positions" && (
            <div className="space-y-1.5">
              {positions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No open positions</p>
              ) : positions.map((p) => {
                const uPnl = unrealizedPnl(p);
                const cfg = getInstrument(p.symbol);
                return (
                  <div key={p.id} className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">{p.symbol}</span>
                        <span className={cn("text-[9px] font-bold uppercase", p.direction === "buy" ? "text-emerald-400" : "text-red-400")}>{p.direction}</span>
                        <span className="text-[10px] text-muted-foreground">{Number(p.size)} lots</span>
                      </div>
                      <span className={cn("font-mono text-[10px] font-bold", uPnl >= 0 ? "text-emerald-400" : "text-red-400")}>{formatPnL(uPnl, cur)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-muted-foreground">Entry: {Number(p.entry_price).toFixed(cfg.digits)}</span>
                      <button onClick={() => handleClose(p.id)} disabled={closingId === p.id || p.symbol !== activeSymbol} className="rounded bg-red-500/15 px-2 py-0.5 text-[9px] font-bold text-red-400 hover:bg-red-500/25 disabled:opacity-50">
                        {closingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Close"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── History Tab ──────────────────────────────────── */}
          {tab === "history" && (
            <div className="space-y-1.5">
              {recentTrades.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No closed trades yet</p>
              ) : recentTrades.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded bg-white/[0.02] px-2 py-1.5 text-[11px]">
                  <span className="font-mono font-bold text-foreground">{t.symbol}</span>
                  <span className={cn("text-[9px] font-bold uppercase", t.direction === "buy" ? "text-emerald-400" : "text-red-400")}>{t.direction}</span>
                  <span className="text-muted-foreground">{Number(t.size)}</span>
                  <span className={cn("ml-auto font-mono font-bold", t.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>{formatPnL(t.pnl, cur)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateDemoAccountModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(acc) => { setShowCreateModal(false); setActiveAccountId(acc.id); refresh(); }}
        />
      )}

      {showFundsModal && account && (
        <FundsModal
          account={account}
          onClose={() => setShowFundsModal(false)}
          onDone={() => { setShowFundsModal(false); refresh(); }}
        />
      )}
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MetricCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[8px] font-semibold uppercase tracking-widest text-muted-foreground/50">{label}</p>
      <p className={cn("text-[10px] font-mono font-bold", color ?? "text-foreground")}>{value}</p>
    </div>
  );
}

function InstrumentBadge({ config }: { config: InstrumentConfig }) {
  const colors: Record<string, string> = {
    forex: "bg-[#0EA5E9]/15 text-[#0EA5E9]",
    metal: "bg-amber-500/15 text-amber-400",
    index: "bg-blue-500/15 text-blue-400",
    crypto: "bg-[#8B5CF6]/15 text-[#8B5CF6]",
    energy: "bg-emerald-500/15 text-emerald-400",
  };
  return (
    <span className={cn("rounded px-1 py-0.5 text-[8px] font-bold uppercase", colors[config.type] ?? colors.forex)}>
      {config.type}
    </span>
  );
}

// ── Funds Modal (Deposit / Withdraw) ─────────────────────────────────────────

function FundsModal({ account, onClose, onDone }: { account: DemoAccount; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const freeMargin = Number(account.equity) - Number(account.used_margin);

  async function handleSubmit() {
    const val = Number(amount);
    if (!val || val <= 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/demo/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: account.id, amount: val }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="funds-title" className="glass-strong relative w-full max-w-xs rounded-2xl shadow-2xl shadow-black/40 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            <h3 id="funds-title" className="text-sm font-bold text-foreground">Manage Funds</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted-foreground hover:bg-white/[0.06]">
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1.5">
            <button onClick={() => setMode("deposit")} className={cn("rounded-lg py-2 text-xs font-bold transition-all", mode === "deposit" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.03] text-muted-foreground hover:text-foreground")}>
              Deposit
            </button>
            <button onClick={() => setMode("withdraw")} className={cn("rounded-lg py-2 text-xs font-bold transition-all", mode === "withdraw" ? "bg-red-500/20 text-red-400" : "bg-white/[0.03] text-muted-foreground hover:text-foreground")}>
              Withdraw
            </button>
          </div>

          <div className="text-[10px] text-muted-foreground">
            {mode === "withdraw" && <span>Max: ${freeMargin.toFixed(2)} (free margin)</span>}
            {mode === "deposit" && <span>Current balance: ${Number(account.balance).toFixed(2)}</span>}
          </div>

          <input
            type="number"
            min="1"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm font-mono text-foreground outline-none focus:border-[#0EA5E9]/40"
          />

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

          <Button className="w-full" size="sm" loading={loading} onClick={handleSubmit} disabled={!Number(amount) || Number(amount) <= 0}>
            {mode === "deposit" ? "Deposit" : "Withdraw"}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}
