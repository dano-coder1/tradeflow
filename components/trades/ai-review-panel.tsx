"use client";

import { useState } from "react";
import { Trade } from "@/types/trade";
import { ReviewTradeResponse } from "@/types/ai";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 8 ? "bg-success" : score >= 5 ? "bg-warning" : "bg-destructive";
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{score}/10</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${score * 10}%` }}
        />
      </div>
    </div>
  );
}

export function AIReviewPanel({ trade }: { trade: Trade }) {
  const [status, setStatus] = useState(trade.ai_review_status);
  const [review, setReview] = useState<ReviewTradeResponse | null>(
    trade.ai_review_json as ReviewTradeResponse | null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateReview() {
    setLoading(true);
    setError(null);
    setStatus("processing");
    try {
      const res = await fetch("/api/ai/review-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeId: trade.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Analysis failed");
      setReview(json);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setStatus("failed");
    } finally {
      setLoading(false);
    }
  }

  if (status === "none" || status === "failed") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <Brain className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            Get an AI-powered SMC analysis of this trade
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button onClick={generateReview} loading={loading} className="gap-2">
            <Brain className="h-4 w-4" />
            Generate AI Review
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "processing") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <Brain className="h-10 w-10 animate-pulse text-primary" />
          <p className="text-sm text-muted-foreground">Analyzing trade…</p>
        </CardContent>
      </Card>
    );
  }

  if (!review) return null;

  const smcElements = [
    { key: "bos", label: "BOS" },
    { key: "choch", label: "CHoCH" },
    { key: "liquidity_sweep", label: "Liquidity Sweep" },
    { key: "order_block", label: "Order Block" },
    { key: "fvg", label: "FVG" },
    { key: "premium_discount_context", label: "Premium/Discount" },
    { key: "unclear_structure", label: "Unclear Structure" },
  ] as const;

  const execFeedback = [
    { key: "entry_was_late", label: "Entry was late" },
    { key: "sl_too_tight", label: "SL too tight" },
    { key: "tp_realistic", label: "TP realistic" },
    { key: "rr_good", label: "R:R good" },
  ] as const;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            AI SMC Review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{review.summary}</p>

          <div className="space-y-3">
            <ScoreBar label="Setup Quality" score={review.setup_quality} />
            <ScoreBar label="Entry Quality" score={review.entry_quality} />
            <ScoreBar label="Risk Management" score={review.risk_management} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold text-success">Strengths</p>
              <ul className="space-y-1">
                {review.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-destructive">Mistakes</p>
              <ul className="space-y-1">
                {review.mistakes.map((m, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              Detected SMC Elements
            </p>
            <div className="flex flex-wrap gap-1.5">
              {smcElements.map(({ key, label }) => (
                <Badge
                  key={key}
                  variant={
                    review.detected_smc_elements[key] ? "default" : "outline"
                  }
                  className={cn(
                    !review.detected_smc_elements[key] && "opacity-40"
                  )}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              Execution Feedback
            </p>
            <div className="grid grid-cols-2 gap-2">
              {execFeedback.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  {review.execution_feedback[key] ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold text-primary">Coach Note</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {review.coach_note}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
