import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TraderProfile } from "@/types/trader-profile";

export async function fetchUserProfile(userId: string): Promise<TraderProfile | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("trader_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  return (data as TraderProfile | null) ?? null;
}

export function formatStrategyContext(profile: TraderProfile): string {
  const section = (title: string, items: string[]) =>
    items.length ? `${title}:\n${items.map((r) => `• ${r}`).join("\n")}` : "";

  return [
    `=== TRADER STRATEGY PROFILE ===`,
    `Style: ${profile.style.toUpperCase()} | Experience: ${profile.experience_level}`,
    ``,
    section("Entry Rules", profile.strategy_json.entry_rules),
    section("Exit Rules", profile.strategy_json.exit_rules),
    section("Confirmation Requirements", profile.strategy_json.confirmation_rules),
    section("Risk Management", profile.strategy_json.risk_management),
    section("Non-Negotiable Rules", profile.strategy_json.non_negotiables ?? []),
  ]
    .filter(Boolean)
    .join("\n");
}
