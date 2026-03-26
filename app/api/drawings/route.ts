import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const symbol = req.nextUrl.searchParams.get("symbol");
    if (!symbol)
      return NextResponse.json({ error: "symbol is required" }, { status: 400 });

    const { data, error } = await supabase
      .from("drawings")
      .select("*")
      .eq("user_id", user.id)
      .eq("symbol", symbol.toUpperCase())
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ drawings: data?.drawings ?? [] });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
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
    const { symbol, drawings } = body;

    if (!symbol || !Array.isArray(drawings))
      return NextResponse.json(
        { error: "symbol and drawings[] are required" },
        { status: 400 }
      );

    const { data, error } = await supabase
      .from("drawings")
      .insert({
        user_id: user.id,
        symbol: symbol.toUpperCase(),
        drawings,
      })
      .select("id")
      .single();

    if (error)
      return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ id: data.id });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
