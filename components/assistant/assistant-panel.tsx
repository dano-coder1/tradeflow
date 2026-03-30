"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Target, Shield, Brain, BookOpen, Lightbulb, MessageCircle, CheckCircle2, ArrowRight, Flame, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssistantProfile } from "@/types/assistant";
import Link from "next/link";

const MODE_LABELS: Record<string, { label: string; color: string }> = {
  beginner_coach: { label: "Beginner Coach", color: "text-emerald-400" },
  discipline_coach: { label: "Discipline Coach", color: "text-amber-400" },
  execution_coach: { label: "Execution Coach", color: "text-[#0EA5E9]" },
  strategy_mentor: { label: "Strategy Mentor", color: "text-[#8B5CF6]" },
  general_coach: { label: "Trading Coach", color: "text-foreground" },
};

const QUICK_ACTIONS = [
  { label: "Explain my next step", icon: Lightbulb, color: "bg-[#0EA5E9]/10 text-[#0EA5E9] hover:bg-[#0EA5E9]/20" },
  { label: "Help me build a strategy", icon: Brain, color: "bg-[#8B5CF6]/10 text-[#8B5CF6] hover:bg-[#8B5CF6]/20" },
  { label: "Review my mistake", icon: Target, color: "bg-red-500/10 text-red-400 hover:bg-red-500/20" },
  { label: "Teach me market structure", icon: BookOpen, color: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" },
  { label: "Simplify this setup", icon: MessageCircle, color: "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" },
];

const PROFILE_FIELDS: { key: keyof AssistantProfile; label: string; icon: typeof Target }[] = [
  { key: "experience_level", label: "Level", icon: Shield },
  { key: "primary_goal", label: "Goal", icon: Target },
  { key: "biggest_problem", label: "Biggest challenge", icon: Lightbulb },
  { key: "focus_area", label: "Focus area", icon: BookOpen },
];

function formatValue(val: string): string {
  return val
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Props {
  profile: AssistantProfile | null;
}

export function AssistantPanel({ profile }: Props) {
  if (!profile) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#8B5CF6]/15">
            <Sparkles className="h-5 w-5 text-[#8B5CF6]" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gradient">Your Assistant</h1>
            <p className="mt-1 text-sm text-muted-foreground">Complete onboarding to personalize your assistant.</p>
          </div>
        </div>
        <div className="glass rounded-xl p-8 text-center space-y-3">
          <Sparkles className="h-10 w-10 text-[#8B5CF6]/40 mx-auto" />
          <p className="text-sm font-semibold text-foreground">No profile yet</p>
          <p className="text-xs text-muted-foreground">Complete the onboarding to get personalized guidance.</p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1.5 btn-gradient rounded-lg px-4 py-2 text-xs font-semibold text-white"
          >
            <Sparkles className="h-3.5 w-3.5" /> Start Onboarding
          </Link>
        </div>
      </div>
    );
  }

  const mode = MODE_LABELS[profile.assistant_mode] ?? MODE_LABELS.general_coach;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#8B5CF6]/15">
          <Sparkles className="h-5 w-5 text-[#8B5CF6]" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gradient">Your Assistant</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mode: <span className={cn("font-semibold", mode.color)}>{mode.label}</span>
          </p>
        </div>
      </div>

      <TodaysFocus profile={profile} />
      <DisciplineStreak />
      <RealityCheck />

      <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
        {/* Left: Profile summary */}
        <div className="space-y-4">
          <div className="glass rounded-xl p-4 space-y-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Your Profile</p>
            <div className="space-y-2.5">
              {PROFILE_FIELDS.map(({ key, label, icon: Icon }) => {
                const val = profile[key];
                if (!val || typeof val !== "string") return null;
                return (
                  <div key={key} className="flex items-center gap-2.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    <div>
                      <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">{label}</p>
                      <p className="text-xs font-medium text-foreground">{formatValue(val)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <Link
              href="/onboarding"
              className="block text-center text-[10px] text-[#0EA5E9] hover:underline mt-2"
            >
              Retake onboarding
            </Link>
          </div>
        </div>

        {/* Right: Quick actions + chat placeholder */}
        <div className="space-y-4">
          <div className="glass rounded-xl p-4 space-y-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Quick Actions</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-all text-left",
                    action.color
                  )}
                >
                  <action.icon className="h-4 w-4 shrink-0" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chat placeholder */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-[#8B5CF6]" />
                <p className="text-xs font-bold text-foreground">Assistant Chat</p>
              </div>
            </div>
            <div className="px-4 py-8 text-center">
              <Sparkles className="h-6 w-6 text-[#8B5CF6]/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                Ask me anything about trading, your strategy, or your recent trades.
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">Chat coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Today's Focus (API-driven with cycling) ─────────────────────────────────

interface FocusData {
  title: string;
  step: string;
  rule: string;
}

function TodaysFocus({ profile }: { profile: AssistantProfile }) {
  const [focus, setFocus] = useState<FocusData | null>(null);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(4);
  const [cycleComplete, setCycleComplete] = useState(false);
  const [justAdvanced, setJustAdvanced] = useState(false);
  const [streakMsg, setStreakMsg] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch progress on mount
  useEffect(() => {
    fetch("/api/assistant/progress")
      .then((r) => r.json())
      .then((data) => {
        if (data.current_focus) {
          setFocus(data.current_focus);
          setIndex(data.current_focus_index ?? 0);
          setTotal(data.total_steps ?? 4);
          setCycleComplete(data.is_cycle_complete ?? false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleComplete() {
    setCompleting(true);
    setShowExplain(false);
    try {
      const res = await fetch("/api/assistant/progress/complete", { method: "POST" });
      const data = await res.json();
      if (data.current_focus) {
        setFocus(data.current_focus);
        setIndex(data.current_focus_index ?? 0);
        setTotal(data.total_steps ?? 4);
        setCycleComplete(data.is_cycle_complete ?? false);
        setJustAdvanced(true);
        setTimeout(() => setJustAdvanced(false), 4000);
        if (data.stats?.streak_message) {
          setStreakMsg(data.stats.streak_message);
          setTimeout(() => setStreakMsg(null), 5000);
        }
        // Notify streak component to refresh
        window.dispatchEvent(new Event("tf:stats-changed"));
      }
    } catch {
      // silent
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-6 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!focus) return null;

  const progress = ((index + 1) / total) * 100;

  // Cycle complete state
  if (cycleComplete) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-5 py-4 space-y-2">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="text-sm font-bold text-emerald-400">Focus cycle completed</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You&apos;ve worked through all {total} focus steps. Great discipline.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-cyan-500/20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.06] via-transparent to-violet-500/[0.04]" />

      <div className="relative px-5 py-4 space-y-4">
        {/* Header + progress */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15">
              <Flame className="h-4 w-4 text-cyan-400" />
            </div>
            <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Today&apos;s Focus</p>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
            {index + 1} / {total}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Just advanced banner */}
        {justAdvanced && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-[11px] text-emerald-400 font-medium animate-fade-in space-y-1">
            <p><CheckCircle2 className="inline h-3 w-3 mr-1" /> Step completed. Next focus unlocked.</p>
            {streakMsg && <p className="text-[10px] text-emerald-400/70"><Flame className="inline h-3 w-3 mr-0.5" /> {streakMsg}</p>}
          </div>
        )}

        {/* Focus content */}
        <div className="space-y-3">
          <h3 className="text-lg font-extrabold text-foreground tracking-tight">{focus.title}</h3>

          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <ArrowRight className="h-3.5 w-3.5 mt-0.5 text-cyan-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Next step</p>
                <p className="text-sm text-foreground mt-0.5">{focus.step}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Shield className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Rule</p>
                <p className="text-sm font-mono text-amber-400/90 mt-0.5">{focus.rule}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Explain panel */}
        {showExplain && (
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-3 text-xs text-muted-foreground leading-relaxed animate-fade-in">
            <p className="font-semibold text-foreground mb-1">Why this matters:</p>
            <p>This step builds on your previous progress. Completing it strengthens the habit and moves you closer to consistency. Focus on executing this one thing today — mastery comes from repetition, not information.</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleComplete}
            disabled={completing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3.5 py-2 text-xs font-semibold text-cyan-400 transition-colors hover:bg-cyan-500/25 disabled:opacity-50"
          >
            {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Mark as done
          </button>
          <button
            onClick={() => setShowExplain((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          >
            <Lightbulb className="h-3.5 w-3.5" /> {showExplain ? "Hide" : "Explain"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Discipline Streak ────────────────────────────────────────────────────────

function DisciplineStreak() {
  const [stats, setStats] = useState<{
    focus_completed_count: number; current_streak: number; best_streak: number;
    honest_completions: number; total_reflections: number;
  } | null>(null);

  const fetchStats = useCallback(() => {
    fetch("/api/assistant/progress")
      .then((r) => r.json())
      .then((data) => { if (data.stats) setStats(data.stats); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStats();
    window.addEventListener("tf:stats-changed", fetchStats);
    return () => window.removeEventListener("tf:stats-changed", fetchStats);
  }, [fetchStats]);

  if (!stats) return null;

  const streakColor = stats.current_streak >= 7
    ? "text-amber-400"
    : stats.current_streak >= 3
      ? "text-cyan-400"
      : "text-muted-foreground";

  const realDiscipline = stats.total_reflections > 0
    ? Math.round((stats.honest_completions / stats.total_reflections) * 100)
    : 0;

  return (
    <div className="glass rounded-xl px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className={cn("h-4 w-4", streakColor)} />
          <p className="text-xs font-bold text-foreground">Discipline Streak</p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className={cn("text-lg font-extrabold tabular-nums", streakColor)}>
              {stats.current_streak}
            </p>
            <p className="text-[8px] text-muted-foreground/50 uppercase tracking-wider">
              day{stats.current_streak !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="border-l border-white/[0.06] pl-4">
            <p className="text-xs font-bold text-muted-foreground tabular-nums">{stats.best_streak}</p>
            <p className="text-[8px] text-muted-foreground/50 uppercase tracking-wider">best</p>
          </div>
          <div className="border-l border-white/[0.06] pl-4">
            <p className="text-xs font-bold text-muted-foreground tabular-nums">{stats.focus_completed_count}</p>
            <p className="text-[8px] text-muted-foreground/50 uppercase tracking-wider">steps</p>
          </div>
          {stats.total_reflections > 0 && (
            <div className="border-l border-white/[0.06] pl-4">
              <p className={cn("text-xs font-bold tabular-nums", realDiscipline >= 70 ? "text-emerald-400" : realDiscipline >= 40 ? "text-amber-400" : "text-red-400")}>
                {realDiscipline}%
              </p>
              <p className="text-[8px] text-muted-foreground/50 uppercase tracking-wider">real</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reality Check ────────────────────────────────────────────────────────────

const BREAK_REASONS = [
  "Entered without confirmation",
  "Emotional trade",
  "Ignored my rules",
  "Market was unclear",
  "Other",
];

function RealityCheck() {
  const [show, setShow] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedFollowed, setSubmittedFollowed] = useState<boolean | null>(null);
  const [followed, setFollowed] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/assistant/reflection/today")
      .then((r) => r.json())
      .then((data) => {
        if (data.reflection) {
          // Already reflected today
          setSubmitted(true);
          setSubmittedFollowed(data.reflection.followed);
        } else if (data.completed_focus_today) {
          // Completed focus but no reflection yet
          setShow(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit() {
    if (followed === null) return;
    setSaving(true);
    try {
      const res = await fetch("/api/assistant/reflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followed, reason: !followed ? reason : null }),
      });
      if (res.ok) {
        setSubmitted(true);
        setSubmittedFollowed(followed);
        window.dispatchEvent(new Event("tf:stats-changed"));
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  // Already submitted — show result briefly
  if (submitted) {
    if (submittedFollowed === null) return null;
    return (
      <div className={cn(
        "rounded-xl border px-4 py-3",
        submittedFollowed
          ? "border-emerald-500/20 bg-emerald-500/[0.04]"
          : "border-amber-500/20 bg-amber-500/[0.04]"
      )}>
        <div className="flex items-center gap-2">
          {submittedFollowed
            ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            : <Shield className="h-4 w-4 text-amber-400" />
          }
          <p className={cn("text-xs font-medium", submittedFollowed ? "text-emerald-400" : "text-amber-400")}>
            {submittedFollowed
              ? "Great. Keep the streak going."
              : "Honest answer. That's how you improve. Tomorrow is a new day."
            }
          </p>
        </div>
      </div>
    );
  }

  if (!show) return null;

  return (
    <div className="glass rounded-xl px-4 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-amber-400" />
        <p className="text-xs font-bold text-foreground">Did you actually follow your focus today?</p>
      </div>

      {followed === null ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setFollowed(true)}
            className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] py-2.5 text-xs font-bold text-emerald-400 transition-all hover:bg-emerald-500/10"
          >
            Yes, I followed it
          </button>
          <button
            onClick={() => setFollowed(false)}
            className="rounded-lg border border-red-500/20 bg-red-500/[0.04] py-2.5 text-xs font-bold text-red-400 transition-all hover:bg-red-500/10"
          >
            No, I broke it
          </button>
        </div>
      ) : followed ? (
        <div className="space-y-2">
          <p className="text-xs text-emerald-400">Good. Confirming your discipline.</p>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-lg bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm"}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">What happened?</p>
          <div className="flex flex-wrap gap-1.5">
            {BREAK_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition-all",
                  reason === r
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    : "border-white/[0.06] text-muted-foreground hover:bg-white/[0.04]"
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving || !reason}
            className="rounded-lg bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/25 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Submit Reflection"}
          </button>
        </div>
      )}
    </div>
  );
}
