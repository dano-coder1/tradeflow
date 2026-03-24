import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });

    const fileExt = file.name.split(".").pop() ?? "png";
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from("trade-screenshots")
      .upload(filePath, buffer, { contentType: file.type });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const { data } = await supabase.storage
      .from("trade-screenshots")
      .createSignedUrl(filePath, 60 * 60 * 24 * 7);

    return NextResponse.json({ imageUrl: data?.signedUrl });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}