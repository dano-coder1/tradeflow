import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import type { AssistantProfile } from "@/types/assistant";

export default async function AssistantPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("assistant_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const profile = (data as AssistantProfile) ?? null;

  return <AssistantPanel profile={profile} />;
}
