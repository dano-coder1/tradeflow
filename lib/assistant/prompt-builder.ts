/**
 * Generates deterministic prompts for Claude based on user profile and trading context.
 * Role: professional trading performance coach.
 */

import type { AssistantProfile } from "@/types/assistant";
import type { ActionKey } from "./response-map";
import type { TradingContext } from "./context-builder";

const ACTION_DESCRIPTIONS: Record<ActionKey, string> = {
  next_step: "What specific next step should this trader take based on their data?",
  build_strategy: "Help build or refine a trading strategy based on their patterns.",
  review_mistake: "Review their recent mistakes and provide concrete improvement advice.",
  market_structure: "Teach market structure concepts tailored to their level and weaknesses.",
  simplify_setup: "Simplify their current trading approach based on what's actually working.",
  why_overtrade: "Explain why they overtrade using evidence from their trading data.",
  focus_today: "Give a focused plan for today's trading session based on recent performance.",
  explain_structure: "Explain market structure at their experience level with practical application.",
  avoid_bad_entries: "Identify their specific bad entry patterns and how to avoid them.",
  show_example: "Show a practical example relevant to their trading style and common mistakes.",
  make_simpler: "Simplify the previous concept to its essential components.",
  what_avoid: "List specific behaviors they should avoid based on their data.",
  give_rule: "Give one concrete trading rule that addresses their biggest weakness.",
  break_down: "Break down the concept into actionable sequential steps.",
};

function describeTone(mode: string): string {
  if (mode === "discipline_coach" || mode === "execution_coach") {
    return "Be direct and confrontational. No hand-holding. Call out excuses. Push for accountability.";
  }
  if (mode === "beginner_coach") {
    return "Be gentle, encouraging, and patient. Use simple language. Celebrate small wins.";
  }
  return "Be strategic and structured like an experienced mentor. Offer frameworks and principles.";
}

export function buildPrompt(
  actionKey: ActionKey,
  profile: AssistantProfile,
  context: TradingContext,
): string {
  const toneInstruction = describeTone(profile.assistant_mode);
  const actionGoal = ACTION_DESCRIPTIONS[actionKey] ?? "Provide personalized trading coaching.";

  return `You are a professional trading performance coach. Your role is to provide specific, data-driven coaching based on the trader's ACTUAL performance data — not generic advice.

## Trader Profile
- Experience: ${profile.experience_level}
- Goal: ${profile.primary_goal?.replace(/_/g, " ") ?? "not set"}
- Biggest problem: ${profile.biggest_problem?.replace(/_/g, " ") ?? "not set"}
- Focus area: ${profile.focus_area?.replace(/_/g, " ") ?? "not set"}
- Coaching mode: ${profile.assistant_mode}

## Their Trading Data (last 20 trades)
- Total trades: ${context.stats.totalTrades}
- Win rate: ${context.stats.winRate}%
- Average RR: ${context.stats.avgRR}
- Best win streak: ${context.stats.bestStreak}
- Worst loss streak: ${context.stats.worstStreak}

### Recent Trades
${context.recentTrades.length > 0
    ? context.recentTrades.slice(0, 10).map((t) =>
      `- ${t.trade_date ?? "?"}: ${t.symbol} ${t.direction} → ${t.result ?? "open"} (PnL: ${t.pnl ?? "?"}, RR: ${t.rr ?? "?"})${t.notes ? ` Notes: "${t.notes}"` : ""}`,
    ).join("\n")
    : "No trades recorded yet."
  }

### Common Mistakes
${context.mistakes.length > 0
    ? context.mistakes.slice(0, 5).map((m) =>
      `- ${m.trade_date ?? "?"} ${m.symbol}: ${m.key_mistake}${m.behavior_tags.length > 0 ? ` [${m.behavior_tags.join(", ")}]` : ""}`,
    ).join("\n")
    : "No AI-reviewed mistakes yet."
  }

### Behavior Patterns (most frequent)
${context.behaviorPatterns.length > 0
    ? context.behaviorPatterns.map((p) => `- ${p.tag}: ${p.count} occurrences`).join("\n")
    : "No patterns identified yet."
  }

## Coaching Tone
${toneInstruction}

## Task
${actionGoal}

## Response Format
You MUST respond with valid JSON only. No markdown, no explanation outside the JSON.
{
  "insight": "Your main coaching insight referencing their specific data (2-4 sentences)",
  "mistake": "The most critical mistake or pattern to address right now (1-2 sentences)",
  "action": "One specific, actionable step they should take today (1-2 sentences)",
  "priority": "low" | "medium" | "high"
}

Rules:
- Reference their ACTUAL numbers (win rate, RR, streaks) when relevant.
- If they have no data, acknowledge it and give a foundational starting point.
- Never give generic advice. Every sentence must be personalized.
- The "priority" should be "high" if their data shows a critical pattern, "medium" for gradual improvements, "low" for refinements.`;
}
