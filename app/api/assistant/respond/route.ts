import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildTradingContext } from "@/lib/assistant/context-builder";
import { buildPrompt } from "@/lib/assistant/prompt-builder";
import { getAIResponse, type AICoachingResponse } from "@/lib/assistant/ai-client";
import { getResponse, type ActionKey } from "@/lib/assistant/response-map";
import type { AssistantProfile } from "@/types/assistant";

const VALID_ACTIONS: ActionKey[] = [
  "next_step", "build_strategy", "review_mistake", "market_structure", "simplify_setup",
  "why_overtrade", "focus_today", "explain_structure", "avoid_bad_entries",
  "show_example", "make_simpler", "what_avoid", "give_rule", "break_down",
];

/** Map action keys to contextual follow-ups for AI responses. */
const AI_FOLLOW_UPS: Record<string, string[]> = {
  next_step: ["Give me a rule", "Break this down", "What should I avoid?"],
  build_strategy: ["Show me an example", "Make it simpler", "Give me a rule"],
  review_mistake: ["What should I avoid?", "Give me a rule", "Break this down"],
  market_structure: ["Show me an example", "Make it simpler", "Break this down"],
  simplify_setup: ["Give me a rule", "Show me an example", "What should I avoid?"],
  why_overtrade: ["Give me a rule", "What should I avoid?", "Break this down"],
  focus_today: ["Give me a rule", "Break this down", "What should I avoid?"],
  explain_structure: ["Show me an example", "Make it simpler", "Give me a rule"],
  avoid_bad_entries: ["Give me a rule", "Break this down", "What should I avoid?"],
  show_example: ["Make it simpler", "Give me a rule"],
  make_simpler: ["Show me an example", "Give me a rule"],
  what_avoid: ["Give me a rule", "Break this down"],
  give_rule: ["Break this down", "Show me an example"],
  break_down: ["Give me a rule", "Make it simpler"],
};

function formatAIMessage(ai: AICoachingResponse): string {
  const priorityLabel = ai.priority === "high" ? "🔴 High Priority"
    : ai.priority === "medium" ? "🟡 Focus Area"
    : "🟢 Refinement";

  return `${ai.insight}\n\n**${priorityLabel} — Mistake to fix:** ${ai.mistake}\n\n**Action:** ${ai.action}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const actionKey = body.actionKey as string;

    if (!actionKey || !VALID_ACTIONS.includes(actionKey as ActionKey)) {
      return NextResponse.json({ error: "Invalid action key" }, { status: 400 });
    }

    // Fetch profile
    const { data: profile, error: profileErr } = await supabase
      .from("assistant_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const typedAction = actionKey as ActionKey;
    const typedProfile = profile as AssistantProfile;

    // Try AI first, fallback to hardcoded
    try {
      const context = await buildTradingContext(supabase, user.id);
      const prompt = buildPrompt(typedAction, typedProfile, context);

      if (process.env.NODE_ENV === "development") {
        console.log("[assistant] prompt length:", prompt.length);
      }

      const aiResponse = await getAIResponse(prompt);

      if (process.env.NODE_ENV === "development") {
        console.log("[assistant] AI response:", JSON.stringify(aiResponse));
      }

      return NextResponse.json({
        message: formatAIMessage(aiResponse),
        followUps: AI_FOLLOW_UPS[typedAction] ?? [],
        source: "ai",
      });
    } catch (aiError) {
      if (process.env.NODE_ENV === "development") {
        console.error("[assistant] AI failed, using fallback:", aiError);
      }

      // Fallback to hardcoded response-map
      const fallback = getResponse(typedAction, typedProfile);
      return NextResponse.json({
        ...fallback,
        source: "fallback",
      });
    }
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
