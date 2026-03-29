import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_FILE_SIZE = 1_048_576; // 1 MB

const SYSTEM_PROMPT = `You are a trading data parser. You will receive a CSV export from any trading broker or platform.

Your job is to extract all CLOSED trades and return them as a JSON array.

For each trade return:
{
  "symbol": "XAUUSD",
  "direction": "buy" or "sell",
  "entry_price": 2345.50,
  "exit_price": 2360.00,
  "entry_time": "2024-01-15T09:30:00Z",
  "exit_time": "2024-01-15T14:20:00Z",
  "profit_loss": 145.00,
  "volume": 0.10,
  "broker_detected": "MetaTrader5"
}

Rules:
- Only extract CLOSED trades
- Convert times to ISO 8601
- Use null if unknown
- Return ONLY valid JSON array`;

interface ParsedTrade {
  symbol?: unknown;
  direction?: unknown;
  entry_price?: unknown;
  exit_price?: unknown;
  entry_time?: unknown;
  exit_time?: unknown;
  profit_loss?: unknown;
  volume?: unknown;
  broker_detected?: unknown;
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

function isValidISO(s: string | null): boolean {
  if (!s) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

function isValidDirection(d: string | null): d is "buy" | "sell" {
  if (!d) return false;
  return ["buy", "sell"].includes(d.toLowerCase());
}

function validateTrade(t: ParsedTrade) {
  const symbol = safeStr(t.symbol);
  const direction = safeStr(t.direction);
  const entry_price = safeNum(t.entry_price);
  const exit_price = safeNum(t.exit_price);
  const entry_time = safeStr(t.entry_time);
  const exit_time = safeStr(t.exit_time);
  const profit_loss = safeNum(t.profit_loss);
  const volume = safeNum(t.volume);

  if (!symbol) return null;
  if (!isValidDirection(direction)) return null;
  if (entry_price === null && exit_price === null) return null;

  return {
    symbol: symbol.toUpperCase(),
    direction: direction!.toLowerCase() as "buy" | "sell",
    entry_price,
    exit_price,
    entry_time: entry_time && isValidISO(entry_time) ? entry_time : null,
    exit_time: exit_time && isValidISO(exit_time) ? exit_time : null,
    profit_loss,
    volume,
  };
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

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File))
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });

    if (file.size > MAX_FILE_SIZE)
      return NextResponse.json(
        { error: "File too large. Maximum size is 1 MB." },
        { status: 413 }
      );

    const csvText = await file.text();

    if (!csvText.trim())
      return NextResponse.json({ error: "File is empty" }, { status: 400 });

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: csvText },
      ],
      max_tokens: 4000,
      temperature: 0.1,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[csv-parse] JSON parse failed:", raw);
      return NextResponse.json(
        { error: "AI parsing failed. The CSV format may not be supported." },
        { status: 422 }
      );
    }

    if (!Array.isArray(parsed) || parsed.length === 0)
      return NextResponse.json(
        { error: "No closed trades found in the CSV." },
        { status: 422 }
      );

    // Detect broker from first trade
    const brokerDetected = safeStr(parsed[0]?.broker_detected) ?? "Unknown";

    const validTrades = parsed
      .map((t: ParsedTrade) => validateTrade(t))
      .filter((t): t is NonNullable<typeof t> => t !== null);

    if (validTrades.length === 0)
      return NextResponse.json(
        { error: "No valid trades could be extracted from the CSV." },
        { status: 422 }
      );

    return NextResponse.json({
      trades: validTrades,
      broker_detected: brokerDetected,
      total_parsed: parsed.length,
      total_valid: validTrades.length,
    });
  } catch (e) {
    console.error("[csv-parse] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
