"use client";

import { useState } from "react";
import { Sparkles, Target, Shield, Brain, BookOpen, Lightbulb, MessageCircle, CheckCircle2, ArrowRight, Flame } from "lucide-react";
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

// ── Today's Focus ────────────────────────────────────────────────────────────

interface FocusContent {
  title: string;
  nextStep: string;
  rule: string;
}

const FOCUS_MAP: Record<string, FocusContent> = {
  overtrading: {
    title: "Control overtrading",
    nextStep: "Wait for confirmation before entry. No setup, no trade.",
    rule: "If no clear setup \u2192 no trade",
  },
  late_entries: {
    title: "Improve timing",
    nextStep: "Wait for pullback instead of chasing price.",
    rule: "No entry on extended candles",
  },
  emotions: {
    title: "Control emotional trading",
    nextStep: "Pause for 10 minutes after a loss before next trade.",
    rule: "No revenge trades \u2014 ever",
  },
  no_strategy: {
    title: "Define one setup",
    nextStep: "Focus on a single repeatable setup today. Ignore everything else.",
    rule: "No random trades",
  },
  no_review: {
    title: "Start reviewing trades",
    nextStep: "Review your last trade before opening a new one.",
    rule: "No trade without review",
  },
};

const FOCUS_FALLBACK: FocusContent = {
  title: "Stay focused today",
  nextStep: "Follow your trading plan. One setup, one execution.",
  rule: "Plan the trade, trade the plan",
};

function TodaysFocus({ profile }: { profile: AssistantProfile }) {
  const [done, setDone] = useState(false);
  const [showExplain, setShowExplain] = useState(false);

  const focus = FOCUS_MAP[profile.biggest_problem] ?? FOCUS_FALLBACK;

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-5 py-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="text-sm font-bold text-emerald-400">Focus completed</p>
            <p className="text-xs text-muted-foreground mt-0.5">Great work. Stay disciplined for the rest of the session.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-cyan-500/20 overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.06] via-transparent to-violet-500/[0.04]" />

      <div className="relative px-5 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15">
              <Flame className="h-4 w-4 text-cyan-400" />
            </div>
            <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Today&apos;s Focus</p>
          </div>
        </div>

        {/* Focus content */}
        <div className="space-y-3">
          <h3 className="text-lg font-extrabold text-foreground tracking-tight">{focus.title}</h3>

          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <ArrowRight className="h-3.5 w-3.5 mt-0.5 text-cyan-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Next step</p>
                <p className="text-sm text-foreground mt-0.5">{focus.nextStep}</p>
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
            {profile.biggest_problem === "overtrading" && (
              <p>Overtrading is the #1 account killer. Every trade without a clear setup is a gamble. Your job today is to prove you can wait. Quality over quantity — always.</p>
            )}
            {profile.biggest_problem === "late_entries" && (
              <p>Chasing price feels urgent, but it destroys your R:R. The best entries come from patience — wait for price to come to your level, not the other way around.</p>
            )}
            {profile.biggest_problem === "emotions" && (
              <p>After a loss, your brain wants revenge. It tells you to &ldquo;make it back.&rdquo; That is a trap. The 10-minute pause breaks the cycle and lets logic return.</p>
            )}
            {profile.biggest_problem === "no_strategy" && (
              <p>Trading without a system is just gambling with extra steps. Pick ONE setup today. Learn it. Master it. You can always add more later.</p>
            )}
            {profile.biggest_problem === "no_review" && (
              <p>You can&apos;t fix what you don&apos;t measure. Reviewing forces you to see patterns in your behavior — the good ones and the destructive ones. Start before your next trade.</p>
            )}
            {!FOCUS_MAP[profile.biggest_problem] && (
              <p>Discipline is doing the right thing when no one is watching. Follow your plan, respect your rules, and trust the process.</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDone(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3.5 py-2 text-xs font-semibold text-cyan-400 transition-colors hover:bg-cyan-500/25"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Mark as done
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
