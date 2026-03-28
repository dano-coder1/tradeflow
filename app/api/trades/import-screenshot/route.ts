import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EXTRACT_PROMPT = `Extract all trades from this MT5 history screenshot.

Return ONLY valid JSON array, no markdown:
[
  {
    "symbol": string,
    "direction": "LONG" or "SHORT",
    "size": number,
    "entry": number,
    "exit": number,
    "pnl": number,
    "date": string
  }
]

Rules:
- buy = LONG, sell = SHORT
- PnL positive = win, negative = loss
- If any value is unclear, set it to null
- Do not hallucinate values
- Extract exactly what is visible`;

interface RawTrade {
  symbol?: unknown;
  direction?: unknown;
  size?: unknown;
  entry?: unknown;
  exit?: unknown;
  pnl?: unknown;
  date?: unknown;
}

function safeNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

function safeStr(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function validateTrades(raw: unknown): RawTrade[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t) => {
    if (!t || typeof t !== "object") return false;
    // Must have at least symbol and direction
    const sym = safeStr(t.symbol);
    const dir = safeStr(t.direction);
    if (!sym || !dir) return false;
    if (!["LONG", "SHORT"].includes(dir.toUpperCase())) return false;
    return true;
  });
}

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
    const { imageBase64 }: { imageBase64: string } = body;

    if (!imageBase64)
      return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACT_PROMPT },
            { type: "image_url", image_url: { url: imageBase64, detail: "high" } },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";

    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[import-screenshot] JSON parse failed:", raw);
      return NextResponse.json(
        { error: "Could not parse AI response. Try a clearer screenshot." },
        { status: 422 }
      );
    }

    const valid = validateTrades(parsed);

    const trades = valid.map((t) => {
      const dir = safeStr(t.direction)!.toUpperCase() as "LONG" | "SHORT";
      return {
        symbol: safeStr(t.symbol)!.toUpperCase(),
        direction: dir,
        size: safeNum(t.size),
        entry: safeNum(t.entry),
        exit: safeNum(t.exit),
        pnl: safeNum(t.pnl),
        date: safeStr(t.date),
      };
    });

    return NextResponse.json({ trades });
  } catch (e) {
    console.error("[import-screenshot] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
