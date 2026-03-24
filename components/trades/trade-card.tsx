import Link from "next/link";
import { Trade } from "@/types/trade";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Brain, Image as ImageIcon } from "lucide-react";

function directionColor(d: string) {
  return d === "long" ? "text-success" : "text-destructive";
}

function resultVariant(r: string | null) {
  if (r === "win") return "success";
  if (r === "loss") return "destructive";
  if (r === "breakeven") return "warning";
  return "secondary";
}

export function TradeCard({ trade }: { trade: Trade }) {
  return (
    <Link
      href={`/trades/${trade.id}`}
      className="block rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40 hover:bg-card/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold">{trade.symbol}</span>
              <span className={cn("text-xs font-semibold uppercase", directionColor(trade.direction))}>
                {trade.direction}
              </span>
              {trade.timeframe && (
                <span className="text-xs text-muted-foreground">{trade.timeframe}</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(trade.trade_date).toLocaleDateString()}
              {trade.tag && ` · ${trade.tag}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {trade.screenshot_url && (
            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {trade.ai_review_status === "done" && (
            <Brain className="h-3.5 w-3.5 text-primary" />
          )}
          {trade.result ? (
            <Badge variant={resultVariant(trade.result)}>
              {trade.result}
            </Badge>
          ) : (
            <Badge variant="outline">{trade.status}</Badge>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-3 text-xs">
        <div>
          <p className="text-muted-foreground">Entry</p>
          <p className="font-mono">{trade.entry ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">SL</p>
          <p className="font-mono text-destructive">{trade.sl ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">TP</p>
          <p className="font-mono text-success">{trade.tp ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">PnL / RR</p>
          <p className={cn("font-mono", trade.pnl != null && trade.pnl >= 0 ? "text-success" : "text-destructive")}>
            {trade.pnl != null ? (trade.pnl >= 0 ? "+" : "") + trade.pnl.toFixed(2) : "—"}
            {trade.rr != null ? ` · 1:${trade.rr}` : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}
