import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ParsedStrategySchema = z.object({
  style: z.enum(["smc", "breakout", "scalping", "custom"]),
  strategy: z.object({
    entry_rules: z.array(z.string()).min(1),
    exit_rules: z.array(z.string()).min(1),
    confirmation_rules: z.array(z.string()).min(1),
    risk_management: z.array(z.string()).min(1),
    non_negotiables: z.array(z.string()),
  }),
});

const SYSTEM_PROMPT = `You are a trading strategy analyst. Parse the user's strategy description into a structured JSON profile.

Identify the most likely trading style (smc/breakout/scalping/custom).
Extract and categorize rules into: entry_rules, exit_rules, confirmation_rules, risk_management.
Distill the 4-6 most important non-negotiable rules into "non_negotiables" inside the strategy object.

Be specific and actionable — do not generate generic advice. Only use what the user actually described.
Always respond with valid JSON only.`;

const USER_PROMPT_TEMPLATE = (text: string) => `Parse this trading strategy description:

"${text}"

Return this exact JSON structure:
{
  "style": "smc" | "breakout" | "scalping" | "custom",
  "strategy": {
    "entry_rules": ["specific entry rule 1", ...],
    "exit_rules": ["specific exit rule 1", ...],
    "confirmation_rules": ["confirmation requirement 1", ...],
    "risk_management": ["risk rule 1", ...],
    "non_negotiables": ["non-negotiable rule 1", ...] (4-6 max)
  }
}`;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await req.json();
  if (!text?.trim())
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  if (text.length > 3000)
    return NextResponse.json({ error: "text too long (max 3000 chars)" }, { status: 400 });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT_TEMPLATE(text.trim()) },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    const validated = ParsedStrategySchema.safeParse(parsed);
    if (!validated.success) {
      console.warn("[parse-strategy] validation failed:", validated.error.issues);
      return NextResponse.json({ error: "AI returned an unexpected strategy format" }, { status: 500 });
    }

    return NextResponse.json(validated.data);
  } catch (e) {
    console.error("[parse-strategy] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
