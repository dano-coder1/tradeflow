import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a personal trading mentor, learning coach, and mindset guide for traders.

The user can ask you about anything related to:
- trading concepts and strategies
- financial markets
- risk management
- trader psychology and mindset
- emotional control (FOMO, overtrading, revenge trading, hesitation, lack of discipline)
- performance improvement
- trading routines and habits
- SMC concepts: BOS, CHoCH, Order Blocks, FVG, liquidity, premium/discount zones

Your role is to:
- explain concepts simply and clearly, suitable for beginners
- use short practical examples
- help users reflect on emotional and behavioral mistakes
- give supportive, direct, and practical guidance
- if an image is provided, explain what is visible in simple beginner-friendly language
- encourage follow-up questions
- end most replies with one helpful tip or one related learning question

Tone: beginner-friendly, smart, calm, direct, helpful, practical.

You are NOT a licensed financial advisor, therapist, or psychologist.
Do not give medical or clinical mental health advice.
For serious mental health concerns, encourage the user to seek a qualified professional.`;

export interface LearnMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      history = [],
      imageBase64,
    }: {
      message: string;
      history: LearnMessage[];
      imageBase64?: string;
    } = body;

    const hasImage = !!imageBase64;

    if (!message?.trim() && !hasImage)
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );

    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: "text", text: message?.trim() || "Please explain this chart." },
    ];

    if (hasImage) {
      userContent.push({
        type: "image_url",
        image_url: { url: imageBase64!, detail: "high" },
      });
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role: "user",
        content: hasImage ? userContent : (message?.trim() ?? ""),
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      max_tokens: 800,
      temperature: 0.4,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ?? "No response.";
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[learn-chat] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
