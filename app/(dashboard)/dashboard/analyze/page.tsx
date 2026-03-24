import { ChartAnalyzer } from "@/components/analyze/chart-analyzer";

export default function AnalyzePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">SMC Chart Analyzer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload 1–6 screenshots. AI analyzes HTF bias, key levels, and gives a structured trading plan.
        </p>
      </div>
      <ChartAnalyzer />
    </div>
  );
}
