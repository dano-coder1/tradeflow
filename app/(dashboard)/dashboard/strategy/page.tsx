import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { StrategyLibrary } from "@/components/strategy/strategy-library";
import { Brain } from "lucide-react";

export default async function StrategyPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gradient">Strategy</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse curated strategies, search for new ones, or import your own. Your active strategy powers the Chart Coach and Trade Autopsy.
          </p>
        </div>
      </div>

      {/* Strategy Library — curated + search + custom + saved */}
      <StrategyLibrary />
    </div>
  );
}
