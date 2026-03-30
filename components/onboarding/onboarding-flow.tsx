"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles, ArrowRight, Check } from "lucide-react";

// ── Step definitions ─────────────────────────────────────────────────────────

interface Option {
  value: string;
  label: string;
  /** Assistant reaction when selected */
  reaction: string;
}

interface Step {
  title: string;
  subtitle: string;
  options: Option[];
}

const STEPS: Step[] = [
  {
    title: "What is your trading level?",
    subtitle: "This helps me adjust how I explain things.",
    options: [
      { value: "beginner", label: "Beginner", reaction: "Good. I'll keep things simple and help you build a strong foundation first." },
      { value: "intermediate", label: "Intermediate", reaction: "Nice. You know the basics — let's sharpen your edge and eliminate weak spots." },
      { value: "advanced", label: "Advanced", reaction: "Respect. I'll skip the basics and focus on execution, psychology, and refinement." },
    ],
  },
  {
    title: "What is your main goal right now?",
    subtitle: "I'll tailor my guidance around this.",
    options: [
      { value: "learn_basics", label: "Learn the basics", reaction: "Perfect starting point. We'll build your knowledge step by step." },
      { value: "become_consistent", label: "Become consistent", reaction: "Consistency is the real edge. I'll help you build systems, not just take trades." },
      { value: "improve_entries", label: "Improve entries and exits", reaction: "Precision matters. I'll focus on timing, confluences, and execution." },
      { value: "master_discipline", label: "Master discipline", reaction: "Most traders fail here. I'll hold you accountable — no shortcuts." },
      { value: "build_system", label: "Build my own system", reaction: "Great ambition. I'll guide you through building a complete, rules-based strategy." },
    ],
  },
  {
    title: "What is your biggest problem?",
    subtitle: "Be honest — this shapes how I coach you.",
    options: [
      { value: "overtrading", label: "Overtrading", reaction: "Less is more. I'll help you learn to wait for A+ setups only." },
      { value: "emotions", label: "Emotions / revenge trading", reaction: "Understood. Your issue is not just strategy — it is decision control. We'll work on that." },
      { value: "late_entries", label: "Late entries", reaction: "Chasing kills accounts. I'll help you build a system to get in early and with confidence." },
      { value: "no_strategy", label: "No clear strategy", reaction: "That's actually good news — means you haven't cemented bad habits. Let's build it right." },
      { value: "no_review", label: "I don't review my trades properly", reaction: "Reviewing is where the real growth happens. I'll make sure you learn from every trade." },
    ],
  },
  {
    title: "How should I talk to you?",
    subtitle: "Choose the tone that keeps you engaged.",
    options: [
      { value: "simple", label: "Simple and slow", reaction: "Got it. I'll break everything down into clear, digestible steps." },
      { value: "practical", label: "Practical and concise", reaction: "No fluff. I'll give you what you need, straight to the point." },
      { value: "direct", label: "Direct and tough", reaction: "No sugar-coating. If you're wrong, you'll know it. If you're right, you'll know why." },
      { value: "mentor", label: "Like a mentor / coach", reaction: "I'll guide you with patience but push you when needed. Think of me as your trading coach." },
    ],
  },
  {
    title: "What do you want to focus on first?",
    subtitle: "I'll prioritize this in your learning path.",
    options: [
      { value: "market_structure", label: "Market structure", reaction: "The foundation of everything. Once you see structure, the market stops being random." },
      { value: "entry_setups", label: "Entry setups", reaction: "Entries are where confidence is built. I'll show you high-probability patterns." },
      { value: "risk_management", label: "Risk management", reaction: "Smart. Most traders focus on entries — the real edge is in how you manage risk." },
      { value: "psychology", label: "Trading psychology", reaction: "The hardest skill in trading. But the one that separates amateurs from professionals." },
      { value: "journaling", label: "Trade review / journaling", reaction: "The fastest way to improve. Your journal is your personal trading coach." },
    ],
  },
];

const FIELD_KEYS = [
  "experience_level",
  "primary_goal",
  "biggest_problem",
  "communication_style",
  "focus_area",
] as const;

// ── Component ────────────────────────────────────────────────────────────────

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [reaction, setReaction] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  function handleSelect(opt: Option) {
    setSelectedValue(opt.value);
    setReaction(opt.reaction);
  }

  function handleNext() {
    if (!selectedValue) return;

    const key = FIELD_KEYS[step];
    const next = { ...answers, [key]: selectedValue };
    setAnswers(next);
    setSelectedValue(null);
    setReaction(null);

    if (isLast) {
      handleFinish(next);
    } else {
      setStep((s) => s + 1);
    }
  }

  async function handleFinish(finalAnswers: Record<string, string>) {
    setSaving(true);
    try {
      await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalAnswers),
      });
      router.push("/dashboard");
      router.refresh();
    } catch {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background auth-bg px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0EA5E9] to-[#8B5CF6] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="glass-strong rounded-2xl p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0EA5E9]/20 to-[#8B5CF6]/20">
              <Sparkles className="h-4 w-4 text-[#8B5CF6]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">{current.title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{current.subtitle}</p>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            {current.options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt)}
                className={cn(
                  "w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all duration-200",
                  selectedValue === opt.value
                    ? "border-[#8B5CF6]/50 bg-[#8B5CF6]/10 text-foreground ring-1 ring-[#8B5CF6]/30"
                    : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:bg-white/[0.04] hover:text-foreground hover:border-white/[0.12]"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all",
                    selectedValue === opt.value
                      ? "border-[#8B5CF6] bg-[#8B5CF6]"
                      : "border-white/[0.15]"
                  )}>
                    {selectedValue === opt.value && <Check className="h-3 w-3 text-white" />}
                  </div>
                  {opt.label}
                </div>
              </button>
            ))}
          </div>

          {/* Assistant reaction */}
          {reaction && (
            <div className="rounded-xl bg-[#8B5CF6]/5 border border-[#8B5CF6]/15 px-4 py-3 animate-fade-in">
              <div className="flex items-start gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[#8B5CF6] mt-0.5 shrink-0" />
                <p className="text-xs text-foreground leading-relaxed">{reaction}</p>
              </div>
            </div>
          )}

          {/* Next button */}
          <button
            onClick={handleNext}
            disabled={!selectedValue || saving}
            className={cn(
              "w-full rounded-xl py-3 text-sm font-bold transition-all duration-200",
              selectedValue
                ? "btn-gradient text-white"
                : "bg-white/[0.04] text-muted-foreground/50 cursor-not-allowed"
            )}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            ) : isLast ? (
              <span className="flex items-center justify-center gap-1.5">Finish Setup <Check className="h-4 w-4" /></span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">Continue <ArrowRight className="h-4 w-4" /></span>
            )}
          </button>
        </div>

        {/* Skip */}
        <button
          onClick={() => handleFinish({})}
          className="w-full text-center text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
