"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { AssistantProfile } from "@/types/assistant";

const WELCOME_MESSAGES: Record<string, string> = {
  beginner_coach: "I'll help you build a strong foundation. Let's start with the basics and work our way up.",
  discipline_coach: "I'll help you focus on discipline and emotional control. No more revenge trades.",
  execution_coach: "I'll help you sharpen your entries and exits. Precision is everything.",
  strategy_mentor: "I'll help you build and refine your own trading system. Let's make it bulletproof.",
  general_coach: "I'm here to help you become a better trader. Let's get started.",
};

function getFocusMessage(profile: AssistantProfile): string {
  const parts: string[] = [];
  if (profile.focus_area) {
    const focus = profile.focus_area.replace(/_/g, " ");
    parts.push(`focusing on ${focus}`);
  }
  if (profile.biggest_problem) {
    const problem = profile.biggest_problem.replace(/_/g, " ");
    parts.push(`tackling ${problem}`);
  }
  return parts.length > 0 ? ` We'll start by ${parts.join(" and ")}.` : "";
}

export function AssistantWelcomeCard({ profile }: { profile: AssistantProfile }) {
  const baseMsg = WELCOME_MESSAGES[profile.assistant_mode] ?? WELCOME_MESSAGES.general_coach;
  const focusMsg = getFocusMessage(profile);

  return (
    <Link
      href="/dashboard/assistant"
      className="flex items-start gap-3 rounded-xl border border-[#8B5CF6]/20 bg-[#8B5CF6]/5 px-4 py-4 transition-colors hover:border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/8"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8B5CF6]/15">
        <Sparkles className="h-4 w-4 text-[#8B5CF6]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Your Assistant</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
          {baseMsg}{focusMsg}
        </p>
      </div>
    </Link>
  );
}
