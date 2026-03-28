"use client";

import { useState } from "react";
import { Stethoscope } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Trade } from "@/types/trade";
import { TradeReviewModal } from "./trade-review-modal";

export function TradeReviewButton({ trade }: { trade: Trade }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const canReview = trade.status === "closed" || trade.result === "win" || trade.result === "loss" || trade.result === "breakeven";

  if (!canReview) return null;

  const hasReview = !!trade.autopsy_json;

  return (
    <>
      <div className="glass rounded-xl px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0EA5E9]/10">
              <Stethoscope className="h-4 w-4 text-[#0EA5E9]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Trade Review</p>
              <p className="text-xs text-muted-foreground">
                {hasReview
                  ? `Last reviewed ${new Date(trade.autopsy_json!.generated_at).toLocaleDateString()}`
                  : "Get AI-powered analysis of this trade"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg bg-[#0EA5E9]/15 px-4 py-2 text-xs font-semibold text-[#0EA5E9] hover:bg-[#0EA5E9]/25 transition-colors"
          >
            {hasReview ? "View Review" : "Run Review"}
          </button>
        </div>
      </div>

      {open && (
        <TradeReviewModal
          trade={trade}
          onClose={() => setOpen(false)}
          onUpdated={() => router.refresh()}
        />
      )}
    </>
  );
}
