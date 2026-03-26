import { LearnChat } from "@/components/learn/LearnChat";

export default function LearnPage() {
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">Learn</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Ask anything about trading, markets, psychology, or upload a chart to get it explained
        </p>
      </div>
      <LearnChat />
    </div>
  );
}
