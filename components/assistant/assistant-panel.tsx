"use client";

import { Sparkles, Target, Shield, Brain, BookOpen, Lightbulb, MessageCircle } from "lucide-react";
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
