"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, X, Calendar, Shield, ShieldAlert, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trade } from "@/types/trade";

// ── Types ────────────────────────────────────────────────────────────────────

interface MarketEvent {
  id: string;
  title: string;
  time: string;
  impact: "low" | "medium" | "high";
  currency: string;
}

type SafetyStatus = "safe" | "caution" | "avoid";

interface DayData {
  date: string; // YYYY-MM-DD
  trades: Trade[];
  events: MarketEvent[];
  pnl: number;
  tradeCount: number;
  wins: number;
  losses: number;
  safety: SafetyStatus;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey(): string { return dateKey(new Date()); }

function computeSafety(events: MarketEvent[]): SafetyStatus {
  let hasHigh = false;
  let hasMedium = false;
  for (const e of events) {
    if (e.impact === "high") hasHigh = true;
    if (e.impact === "medium") hasMedium = true;
  }
  if (hasHigh) return "caution";
  if (hasMedium) return "safe";
  return "safe";
}

function formatTimeLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Props ────────────────────────────────────────────────────────────────────

interface TradingCalendarProps {
  trades?: Trade[];
}

// ── Component ────────────────────────────────────────────────────────────────

export function TradingCalendar({ trades = [] }: TradingCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Fetch events
  useEffect(() => {
    fetch("/api/calendar/market-events")
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => {});
  }, []);

  // Group trades by date
  const tradesByDate = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of trades) {
      const key = t.trade_date.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [trades]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, MarketEvent[]>();
    for (const e of events) {
      const key = e.time.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Monday = 0
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const days: (DayData | null)[] = [];

    // Leading empty cells
    for (let i = 0; i < startOffset; i++) days.push(null);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dt = new Date(year, month, d);
      const key = dateKey(dt);
      const dayTrades = tradesByDate.get(key) ?? [];
      const dayEvents = eventsByDate.get(key) ?? [];
      const closedTrades = dayTrades.filter((t) => t.status === "closed");
      const pnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

      days.push({
        date: key,
        trades: dayTrades,
        events: dayEvents,
        pnl,
        tradeCount: dayTrades.length,
        wins: closedTrades.filter((t) => t.result === "win").length,
        losses: closedTrades.filter((t) => t.result === "loss").length,
        safety: computeSafety(dayEvents),
      });
    }

    return days;
  }, [year, month, tradesByDate, eventsByDate]);

  const today = todayKey();
  const selectedData = selectedDay ? calendarDays.find((d) => d?.date === selectedDay) ?? null : null;
  const monthLabel = new Date(year, month).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#0EA5E9]" />
          <span className="text-sm font-bold text-foreground">Trading Calendar</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="text-xs font-medium text-foreground min-w-[120px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="px-2 py-2">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-[9px] font-bold text-muted-foreground/50 uppercase py-1">{w}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px">
          {calendarDays.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="aspect-square" />;
            const isToday = day.date === today;
            const isSelected = day.date === selectedDay;
            const dayNum = parseInt(day.date.split("-")[2], 10);
            const hasEvents = day.events.length > 0;
            const highEvents = day.events.filter((e) => e.impact === "high").length;
            const medEvents = day.events.filter((e) => e.impact === "medium").length;

            // PnL background tint
            let bgClass = "";
            if (day.tradeCount > 0) {
              bgClass = day.pnl > 0 ? "bg-emerald-500/8" : day.pnl < 0 ? "bg-red-500/8" : "bg-white/[0.02]";
            }

            return (
              <button
                key={day.date}
                onClick={() => setSelectedDay(isSelected ? null : day.date)}
                className={cn(
                  "relative aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 transition-colors text-center",
                  bgClass,
                  isToday && "ring-1 ring-[#0EA5E9]/40",
                  isSelected && "ring-1 ring-white/30 bg-white/[0.06]",
                  !isSelected && "hover:bg-white/[0.04]",
                )}
              >
                <span className={cn("text-[11px] font-medium", isToday ? "text-[#0EA5E9] font-bold" : "text-foreground")}>{dayNum}</span>

                {/* Trade count + PnL indicator */}
                {day.tradeCount > 0 && (
                  <span className={cn("text-[8px] font-bold tabular-nums", day.pnl >= 0 ? "text-emerald-400/70" : "text-red-400/70")}>
                    {day.pnl >= 0 ? "+" : ""}{day.pnl.toFixed(0)}
                  </span>
                )}

                {/* Event dots */}
                {hasEvents && (
                  <div className="flex gap-0.5 absolute bottom-0.5">
                    {highEvents > 0 && <span className="h-1 w-1 rounded-full bg-red-400" />}
                    {medEvents > 0 && <span className="h-1 w-1 rounded-full bg-amber-400" />}
                    {highEvents === 0 && medEvents === 0 && <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Day detail panel ──────────────────────────────────────── */}
      {selectedData && (
        <div className="border-t border-white/[0.06] px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                {new Date(selectedData.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </span>
              <SafetyBadge status={selectedData.safety} />
            </div>
            <button onClick={() => setSelectedDay(null)} className="rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>

          {/* Daily summary */}
          {selectedData.tradeCount > 0 && (
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-muted-foreground">{selectedData.tradeCount} trade{selectedData.tradeCount !== 1 ? "s" : ""}</span>
              {selectedData.wins > 0 && <span className="text-emerald-400">{selectedData.wins}W</span>}
              {selectedData.losses > 0 && <span className="text-red-400">{selectedData.losses}L</span>}
              <span className={cn("font-bold font-mono", selectedData.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                {selectedData.pnl >= 0 ? "+" : ""}{selectedData.pnl.toFixed(2)}
              </span>
            </div>
          )}

          {/* Trades list */}
          {selectedData.trades.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Trades</p>
              {selectedData.trades.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded bg-white/[0.02] px-2 py-1 text-[11px]">
                  <span className="font-mono font-bold text-foreground">{t.symbol}</span>
                  <span className={cn("text-[10px] font-bold uppercase", t.direction === "long" ? "text-emerald-400" : "text-red-400")}>{t.direction}</span>
                  {t.result && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                      t.result === "win" ? "bg-emerald-500/15 text-emerald-400" : t.result === "loss" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
                    )}>{t.result}</span>
                  )}
                  {t.pnl != null && (
                    <span className={cn("ml-auto font-mono text-[10px] font-bold", t.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Events list */}
          {selectedData.events.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Events</p>
              {selectedData.events.map((e) => (
                <div key={e.id} className="flex items-center gap-2 rounded bg-white/[0.02] px-2 py-1 text-[11px]">
                  <span className="font-mono text-muted-foreground w-10 shrink-0 text-[10px]">{formatTimeLocal(e.time)}</span>
                  <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[9px] font-bold text-muted-foreground shrink-0">{e.currency}</span>
                  <span className="flex-1 text-foreground truncate">{e.title}</span>
                  <ImpactDot impact={e.impact} />
                </div>
              ))}
            </div>
          )}

          {selectedData.tradeCount === 0 && selectedData.events.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-2">No trades or events</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ImpactDot({ impact }: { impact: string }) {
  const cls = impact === "high" ? "bg-red-400" : impact === "medium" ? "bg-amber-400" : "bg-muted-foreground/30";
  return <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cls)} />;
}

function SafetyBadge({ status }: { status: SafetyStatus }) {
  if (status === "safe") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
      <Shield className="h-2.5 w-2.5" /> Safe
    </span>
  );
  if (status === "caution") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
      <ShieldAlert className="h-2.5 w-2.5" /> Caution
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
      <ShieldOff className="h-2.5 w-2.5" /> Avoid
    </span>
  );
}
