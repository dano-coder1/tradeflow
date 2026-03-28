"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar, Clock, Shield, ShieldAlert, ShieldOff, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface MarketEvent {
  id: string;
  title: string;
  time: string;
  impact: "low" | "medium" | "high";
  currency: string;
}

type Session = "asia" | "london" | "newyork";
type SafetyStatus = "safe" | "caution" | "avoid";

// ── Session definitions (UTC hours) ──────────────────────────────────────────

const SESSIONS: { key: Session; label: string; startUTC: number; endUTC: number }[] = [
  { key: "asia", label: "Asia", startUTC: 0, endUTC: 9 },
  { key: "london", label: "London", startUTC: 7, endUTC: 16 },
  { key: "newyork", label: "New York", startUTC: 13, endUTC: 22 },
];

function getActiveSessions(nowUTC: number): Session[] {
  return SESSIONS.filter((s) => {
    if (s.startUTC < s.endUTC) return nowUTC >= s.startUTC && nowUTC < s.endUTC;
    return nowUTC >= s.startUTC || nowUTC < s.endUTC;
  }).map((s) => s.key);
}

function getNextSession(nowUTC: number): { label: string; startsIn: string } | null {
  for (const s of SESSIONS) {
    if (s.startUTC > nowUTC) {
      const diff = s.startUTC - nowUTC;
      return { label: s.label, startsIn: `${diff}h` };
    }
  }
  // Wrap to next day
  const first = SESSIONS[0];
  const diff = 24 - nowUTC + first.startUTC;
  return { label: first.label, startsIn: `${diff}h` };
}

// ── Time helpers ─────────────────────────────────────────────────────────────

function formatTimeLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function timeUntil(iso: string): string | null {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return null;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `in ${hrs}h ${rem}m` : `in ${hrs}h`;
}

// ── Safety logic ─────────────────────────────────────────────────────────────

function computeSafety(events: MarketEvent[]): SafetyStatus {
  const now = Date.now();
  const thirtyMin = 30 * 60 * 1000;
  const sixtyMin = 60 * 60 * 1000;

  for (const e of events) {
    const diff = new Date(e.time).getTime() - now;
    if (diff < 0) continue; // past
    if (e.impact === "high" && diff < thirtyMin) return "avoid";
    if (e.impact === "high" && diff < sixtyMin) return "caution";
    if (e.impact === "medium" && diff < thirtyMin) return "caution";
  }
  return "safe";
}

// ── Impact badge ─────────────────────────────────────────────────────────────

function ImpactBadge({ impact }: { impact: string }) {
  const cls = impact === "high"
    ? "bg-red-500/15 text-red-400"
    : impact === "medium"
    ? "bg-amber-500/15 text-amber-400"
    : "bg-white/[0.06] text-muted-foreground";
  return <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase", cls)}>{impact}</span>;
}

// ── Filter options ───────────────────────────────────────────────────────────

const IMPACT_FILTERS = ["all", "high"] as const;
const CURRENCY_FILTERS = ["all", "USD", "EUR", "GBP", "JPY", "XAU"] as const;

// ── Component ────────────────────────────────────────────────────────────────

export function TradingCalendar() {
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [impactFilter, setImpactFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState(true);
  const [, setTick] = useState(0);

  // Fetch events
  useEffect(() => {
    fetch("/api/calendar/market-events")
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Tick every minute for countdowns
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const nowUTC = new Date().getUTCHours();
  const activeSessions = getActiveSessions(nowUTC);
  const nextSession = getNextSession(nowUTC);
  const safety = computeSafety(events);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (impactFilter !== "all" && e.impact !== impactFilter) return false;
      if (currencyFilter !== "all" && e.currency !== currencyFilter) return false;
      return true;
    });
  }, [events, impactFilter, currencyFilter]);

  // Split into upcoming and past
  const now = Date.now();
  const upcoming = filtered.filter((e) => new Date(e.time).getTime() > now);
  const past = filtered.filter((e) => new Date(e.time).getTime() <= now);

  return (
    <div className="glass rounded-xl overflow-hidden">
      {/* Header */}
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#0EA5E9]" />
          <span className="text-sm font-bold text-foreground">Active Trading Calendar</span>
        </div>
        <div className="flex items-center gap-2">
          <SafetyBadge status={safety} />
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
          {/* Sessions row */}
          <div className="flex items-center gap-2 flex-wrap">
            {SESSIONS.map((s) => {
              const active = activeSessions.includes(s.key);
              return (
                <div key={s.key} className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium", active ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.04] text-muted-foreground")}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/30")} />
                  {s.label}
                </div>
              );
            })}
            {nextSession && activeSessions.length < 3 && (
              <span className="text-[10px] text-muted-foreground/60">
                Next: {nextSession.label} {nextSession.startsIn}
              </span>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-0.5 rounded bg-white/[0.04] p-0.5">
              {IMPACT_FILTERS.map((f) => (
                <button key={f} onClick={() => setImpactFilter(f)} className={cn("rounded px-2 py-0.5 text-[10px] font-medium capitalize transition-colors", impactFilter === f ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {f === "all" ? "All Impact" : "High Only"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 rounded bg-white/[0.04] p-0.5">
              {CURRENCY_FILTERS.map((f) => (
                <button key={f} onClick={() => setCurrencyFilter(f)} className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors", currencyFilter === f ? "bg-white/[0.08] text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {f === "all" ? "All" : f}
                </button>
              ))}
            </div>
          </div>

          {/* Events */}
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />
              <span className="text-xs text-muted-foreground ml-2">Loading events...</span>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No events match your filters</p>
          )}

          {!loading && upcoming.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Upcoming</p>
              {upcoming.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </div>
          )}

          {!loading && past.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">Earlier Today</p>
              {past.map((e) => (
                <EventRow key={e.id} event={e} muted />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function EventRow({ event, muted }: { event: MarketEvent; muted?: boolean }) {
  const countdown = timeUntil(event.time);
  return (
    <div className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs", muted ? "opacity-40" : "bg-white/[0.02]")}>
      <span className="font-mono text-muted-foreground w-12 shrink-0 text-[11px]">{formatTimeLocal(event.time)}</span>
      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground shrink-0">{event.currency}</span>
      <span className="flex-1 text-foreground truncate">{event.title}</span>
      <ImpactBadge impact={event.impact} />
      {countdown && !muted && (
        <span className="text-[10px] text-muted-foreground shrink-0">{countdown}</span>
      )}
    </div>
  );
}

function SafetyBadge({ status }: { status: SafetyStatus }) {
  if (status === "safe") return (
    <div className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
      <Shield className="h-3 w-3" /> Safe
    </div>
  );
  if (status === "caution") return (
    <div className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
      <ShieldAlert className="h-3 w-3" /> Caution
    </div>
  );
  return (
    <div className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
      <ShieldOff className="h-3 w-3" /> Avoid
    </div>
  );
}
