import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // If already completed onboarding, go to dashboard
  const { data: profile } = await supabase
    .from("assistant_profiles")
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .single();

  if (profile?.onboarding_completed) redirect("/dashboard");

  return <OnboardingFlow />;
}
