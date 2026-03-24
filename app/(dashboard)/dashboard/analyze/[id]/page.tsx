import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AnalysisResult } from "@/components/analyze/analysis-result";
import { ChartAnalysis } from "@/types/ai";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: run } = await supabase
    .from("analysis_runs")
    .select("id, output_json, image_urls, bias, no_trade, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!run) notFound();

  const analysis = run.output_json as ChartAnalysis;
  const imageUrls = run.image_urls as string[];

  const date = new Date(run.created_at).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/analyze"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Analyzer
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Analysis Detail</h1>
        <p className="mt-1 text-sm text-muted-foreground">{date}</p>
      </div>

      {/* Screenshots */}
      {imageUrls.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Screenshots ({imageUrls.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {imageUrls.map((url, i) => (
                <div
                  key={i}
                  className="relative aspect-video overflow-hidden rounded-lg border border-border"
                >
                  <Image
                    src={url}
                    alt={`Chart ${i + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <span className="absolute bottom-1 left-1 rounded bg-background/70 px-1 text-xs backdrop-blur-sm">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis result cards */}
      <AnalysisResult result={analysis} />
    </div>
  );
}
