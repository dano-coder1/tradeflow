import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ExtractTradeResponse } from "@/types/ai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are an expert SMC trading analyst specializing in reading trading charts and extracting trade data.
Analyze the provided trading screenshot and extract all visible trade information.
Always respond with valid JSON only — no markdown, no commentary outside the JSON object.`;

const USER_PROMPT = `Extract trade data from this screenshot and return a JSON object with this exact structure:
{
  "symbol": "<ticker or null>",
  "direction": "<long|short|null>",
  "entry": <number or null>,
  "sl": <number or null>,
  "tp": <number or null>,
  "exit": <number or null>,
  "timeframe": "<timeframe string or null>",
  "notes_from_chart": "<any visible labels, text or context on the chart, or null>",
  "confidence": <0.0-1.0>,
  "detected_elements": {
    "position_tool": <true/false>,
    "horizontal_levels": <true/false>,
    "trendlines": <true/false>,
    "labels": <true/false>
  }
}

If a value cannot be determined from the chart, use null. Be precise with price levels.`;

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
    const { imageUrl } = body as { imageUrl: string };
    if (!imageUrl)
      return NextResponse.json({ error: "imageUrl required" }, { status: 400 });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text" as const, text: USER_PROMPT },
            {
              type: "image_url" as const,
              image_url: { url: imageUrl, detail: "high" as const },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const extracted = JSON.parse(raw) as ExtractTradeResponse;

    return NextResponse.json(extracted);
  } catch (e) {
    console.error("[extract-trade] error:", e);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
