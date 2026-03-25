import { ChartAnalyzer } from "@/components/analyze/chart-analyzer";
import { AnalysesByInstrument } from "@/components/analyze/analyses-by-instrument";

export default function AnalyzePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gradient">SMC Chart Analyzer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload 1–6 screenshots. AI analyzes HTF bias, key levels, and gives a structured trading plan.
        </p>
      </div>
      <ChartAnalyzer />
      <div>
        <h2 className="mb-3 text-base font-semibold">Analyses by Instrument</h2>
        <AnalysesByInstrument />
      </div>
    </div>
  );
}
