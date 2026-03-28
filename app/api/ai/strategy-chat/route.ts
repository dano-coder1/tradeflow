import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchUserProfile, formatStrategyContext } from "@/lib/trader-profile";
import { CoachMessage } from "@/app/api/ai/coach-chat/route";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a trading coach inside a trading app. You always have access to the trader's strategy, the current analysis, and the full conversation history.

Your job:
- Help the trader understand their setup
- Point out mistakes and rule violations
- Suggest improvements grounded in their specific rules

Rules:
1. NEVER ask for more information if analysis already exists in the conversation
2. ALWAYS use the current analysis context — reference it directly
3. For follow-up questions: expand the previous analysis, highlight risks, suggest better execution
4. Be practical, not generic — name the actual rules being violated or confirmed

Response format (always use this structure):

🧠 Insight:
(one short summary sentence)

📉 Issues:
• ...

✅ What to do:
• ...

⭐ Rating: A / B / C
(one-line reason)`;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      message,
      history,
      imageUrls = [],
      activeStrategy,
    }: {
      message: string;
      history: CoachMessage[];
      imageUrls?: string[];
      activeStrategy?: { name: string; summary: string; rules: string[]; methodology: string };
    } = body;

    const hasImages = Array.isArray(imageUrls) && imageUrls.length > 0;

    if (!message?.trim() && !hasImages)
      return NextResponse.json(
        { error: "message or imageUrls is required" },
        { status: 400 }
      );

    // Build strategy context from active strategy (localStorage-based) or Supabase profile
    let strategyContext = "";
    if (activeStrategy) {
      const parts = [
        `=== ACTIVE STRATEGY: ${activeStrategy.name} ===`,
        activeStrategy.summary,
        `Methodology: ${activeStrategy.methodology}`,
        "",
        "Rules:",
        ...activeStrategy.rules.map((r, i) => `${i + 1}. ${r}`),
      ];
      strategyContext = parts.join("\n");
    } else {
      const profile = await fetchUserProfile(user.id);
      if (profile) {
        strategyContext = formatStrategyContext(profile);
      }
    }

    if (!strategyContext) {
      return NextResponse.json(
        { error: "No strategy found. Select or create a strategy first." },
        { status: 404 }
      );
    }

    const systemContent = `${SYSTEM_PROMPT}\n\n${strategyContext}`;

    // Build user message — vision content when images are present
    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
      {
        type: "text",
        text: message?.trim() || "Please analyze this chart based on my strategy.",
      },
      ...imageUrls.map((url) => ({
        type: "image_url" as const,
        image_url: { url, detail: "high" as const },
      })),
    ];

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemContent },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user",
        // Use vision array only when there are images (text-only stays a string for efficiency)
        content: hasImages ? userContent : (message?.trim() ?? ""),
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages,
      max_tokens: 700,
      temperature: 0.4,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ?? "No response.";
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[strategy-chat] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
