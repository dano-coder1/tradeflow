"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, X, Calendar, Shield, ShieldAlert, ShieldOff, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trade } from "@/types/trade";
import {
  type MarketEvent,
  fetchMonthEvents,
  preloadMonths,
  isCached,
} from "@/lib/calendar-cache";
import { detectCurrency, formatPnL } from "@/lib/currency";

// ── Types ────────────────────────────────────────────────────────────────────

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

function monthKeyFromState(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function computeSafety(events: MarketEvent[]): SafetyStatus {
  for (const e of events) {
    if (e.impact === "high") return "caution";
  }
  return "safe";
}

function formatTimeLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Day notes storage ────────────────────────────────────────────────────────

const NOTES_KEY = "tf:calendar-notes";

function loadAllNotes(): Record<string, string> {
  try { const r = localStorage.getItem(NOTES_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}

function saveNote(date: string, text: string) {
  const all = loadAllNotes();
  if (text.trim()) all[date] = text.trim();
  else delete all[date];
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(all)); } catch {}
}

// ── Props ────────────────────────────────────────────────────────────────────

interface TradingCalendarProps {
  trades?: Trade[];
}

// ── Component ────────────────────────────────────────────────────────────────

type SourceFilter = "real" | "sim" | "all";

export function TradingCalendar({ trades = [] }: TradingCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [eventsByMonth, setEventsByMonth] = useState<Map<string, MarketEvent[]>>(new Map());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>(() => loadAllNotes());
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const initialPreloadDone = useRef(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("real");
  const hasSim = trades.some((t) => t.source === "sim");

  // Filter trades by source
  const filteredTrades = useMemo(() => {
    if (sourceFilter === "all") return trades;
    if (sourceFilter === "sim") return trades.filter((t) => t.source === "sim");
    return trades.filter((t) => t.source !== "sim");
  }, [trades, sourceFilter]);

  // Detect account currency from trades
  const currency = useMemo(() => detectCurrency(filteredTrades), [filteredTrades]);

  // ── Event fetching with cache ──────────────────────────────────────────────

  const loadMonth = useCallback(async (monthKey: string) => {
    const events = await fetchMonthEvents(monthKey);
    setEventsByMonth((prev) => {
      const next = new Map(prev);
      next.set(monthKey, events);
      return next;
    });
  }, []);

  // Initial preload: current month + 3 months ahead
  useEffect(() => {
    if (initialPreloadDone.current) return;
    initialPreloadDone.current = true;

    const nowDate = new Date();
    const y = nowDate.getFullYear();
    const m = nowDate.getMonth();

    // Load current month immediately
    loadMonth(monthKeyFromState(y, m));

    // Preload next 3 months in background
    preloadMonths(y, m, 3);

    // After a short delay, also load months 1-3 into state
    const timer = setTimeout(() => {
      for (let i = 1; i <= 3; i++) {
        let futureM = m + i;
        let futureY = y;
        while (futureM > 11) { futureM -= 12; futureY++; }
        loadMonth(monthKeyFromState(futureY, futureM));
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [loadMonth]);

  // When user navigates to a new month, load it if not cached + preload next
  useEffect(() => {
    const key = monthKeyFromState(year, month);
    if (!eventsByMonth.has(key)) {
      loadMonth(key);
    }
    // Preload next month
    let nextM = month + 1;
    let nextY = year;
    if (nextM > 11) { nextM = 0; nextY++; }
    const nextKey = monthKeyFromState(nextY, nextM);
    if (!isCached(nextKey)) {
      fetchMonthEvents(nextKey).then((events) => {
        setEventsByMonth((prev) => {
          const next = new Map(prev);
          next.set(nextKey, events);
          return next;
        });
      });
    }
  }, [year, month, loadMonth, eventsByMonth]);

  // ── Current month events ───────────────────────────────────────────────────

  const currentMonthEvents = eventsByMonth.get(monthKeyFromState(year, month)) ?? [];

  // Group trades by date
  const tradesByDate = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of filteredTrades) {
      const key = t.trade_date.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [filteredTrades]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, MarketEvent[]>();
    for (const e of currentMonthEvents) {
      const key = e.time.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [currentMonthEvents]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;

    const days: (DayData | null)[] = [];

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

  // Sync note text when selected day changes
  useEffect(() => {
    if (selectedDay) {
      setNoteText(notes[selectedDay] ?? "");
      setEditingNote(false);
    }
  }, [selectedDay]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveNote = useCallback(() => {
    if (!selectedDay) return;
    saveNote(selectedDay, noteText);
    setNotes(loadAllNotes());
    setEditingNote(false);
  }, [selectedDay, noteText]);

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
          {hasSim && (
            <div className="flex items-center gap-0.5 ml-1">
              {(["real", "sim", "all"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setSourceFilter(f)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider transition-colors",
                    sourceFilter === f
                      ? f === "sim" ? "bg-[#8B5CF6]/15 text-[#8B5CF6]" : "bg-[#0EA5E9]/15 text-[#0EA5E9]"
                      : "text-muted-foreground/50 hover:text-muted-foreground"
                  )}
                >
                  {f === "real" ? "Real" : f === "sim" ? "Demo" : "All"}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} aria-label="Previous month" className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="text-xs font-medium text-foreground min-w-[120px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} aria-label="Next month" className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"><ChevronRight className="h-3.5 w-3.5" /></button>
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
            const hasNote = !!notes[day.date];
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

                {/* Trade count + PnL with currency */}
                {day.tradeCount > 0 && (
                  <span className={cn("text-[8px] font-bold tabular-nums", day.pnl >= 0 ? "text-emerald-400/70" : "text-red-400/70")}>
                    {formatPnL(day.pnl, currency, true)}
                  </span>
                )}

                {/* Indicator dots */}
                {(hasEvents || hasNote) && (
                  <div className="flex gap-0.5 absolute bottom-0.5">
                    {hasNote && <span className="h-1 w-1 rounded-full bg-[#0EA5E9]" />}
                    {highEvents > 0 && <span className="h-1 w-1 rounded-full bg-red-400" />}
                    {medEvents > 0 && <span className="h-1 w-1 rounded-full bg-amber-400" />}
                    {!hasNote && highEvents === 0 && medEvents === 0 && <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />}
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
            <button onClick={() => setSelectedDay(null)} aria-label="Close day detail" className="rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>

          {/* Daily summary */}
          {selectedData.tradeCount > 0 && (
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-muted-foreground">{selectedData.tradeCount} trade{selectedData.tradeCount !== 1 ? "s" : ""}</span>
              {selectedData.wins > 0 && <span className="text-emerald-400">{selectedData.wins}W</span>}
              {selectedData.losses > 0 && <span className="text-red-400">{selectedData.losses}L</span>}
              <span className={cn("font-bold font-mono", selectedData.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                {formatPnL(selectedData.pnl, currency)}
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
                      {formatPnL(t.pnl, currency)}
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

          {/* Day note */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <StickyNote className="h-3 w-3" /> Note
              </p>
              {!editingNote && (
                <button onClick={() => setEditingNote(true)} className="text-[10px] text-[#0EA5E9] hover:underline">
                  {notes[selectedData.date] ? "Edit" : "Add"}
                </button>
              )}
            </div>
            {editingNote ? (
              <div className="space-y-1.5">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Reflection, mood, lessons learned..."
                  rows={3}
                  autoFocus
                  className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#0EA5E9]/40 resize-none"
                />
                <div className="flex gap-1.5">
                  <button onClick={() => { setEditingNote(false); setNoteText(notes[selectedData.date] ?? ""); }} className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-white/[0.06]">Cancel</button>
                  <button onClick={handleSaveNote} className="rounded px-2 py-0.5 text-[10px] font-medium text-[#0EA5E9] bg-[#0EA5E9]/10 hover:bg-[#0EA5E9]/20">Save</button>
                </div>
              </div>
            ) : notes[selectedData.date] ? (
              <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap bg-white/[0.02] rounded-lg px-2.5 py-1.5 border border-white/[0.04]">{notes[selectedData.date]}</p>
            ) : (
              <p className="text-[10px] text-muted-foreground/50 italic">No note for this day</p>
            )}
          </div>
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
