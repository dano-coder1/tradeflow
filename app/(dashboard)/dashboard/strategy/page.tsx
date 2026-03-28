import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StrategySetup } from "@/components/strategy/strategy-setup";
import { StrategyLibrary } from "@/components/strategy/strategy-library";
import { TraderProfile } from "@/types/trader-profile";
import { Brain } from "lucide-react";

export default async function StrategyPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("trader_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (profileError && profileError.code !== "PGRST116") {
    console.error("[strategy-page] failed to fetch trader profile:", profileError);
  }

  const hasProfile = !!profile;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gradient">Strategy Setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasProfile
              ? "Update your trading strategy. AI analysis and trade reviews will use these rules."
              : "Define your trading rules once. The AI coach will evaluate every trade against your specific strategy — not generic principles."}
          </p>
        </div>
      </div>

      {/* Strategy Library — curated + search + custom + saved */}
      <StrategyLibrary />

      {/* Strategy setup — full width */}
      <StrategySetup initialProfile={profile as TraderProfile | null} />
    </div>
  );
}
