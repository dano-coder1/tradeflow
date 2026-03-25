import Link from "next/link";
import { Trade } from "@/types/trade";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Brain, Image as ImageIcon } from "lucide-react";

function directionColor(d: string) {
  return d === "long" ? "text-emerald-400" : "text-red-400";
}

function directionBg(d: string) {
  return d === "long" ? "bg-emerald-400/10" : "bg-red-400/10";
}

function resultVariant(r: string | null) {
  if (r === "win") return "success";
  if (r === "loss") return "destructive";
  if (r === "breakeven") return "warning";
  return "secondary";
}

export function TradeCard({ trade }: { trade: Trade }) {
  const pnlPositive = trade.pnl != null && trade.pnl >= 0;

  return (
    <Link
      href={`/trades/${trade.id}`}
      className="block rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40 hover:bg-card/80"
    >
      {/* Header: symbol + direction + badges */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-extrabold tracking-tight">{trade.symbol}</span>
          <span className={cn("rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide", directionColor(trade.direction), directionBg(trade.direction))}>
            {trade.direction}
          </span>
          {trade.timeframe && (
            <span className="text-xs text-muted-foreground">{trade.timeframe}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {trade.screenshot_url && (
            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          {trade.ai_review_status === "done" && (
            <Brain className="h-3.5 w-3.5 text-primary" />
          )}
          {trade.result ? (
            <Badge variant={resultVariant(trade.result)}>{trade.result}</Badge>
          ) : (
            <Badge variant="outline">{trade.status}</Badge>
          )}
        </div>
      </div>

      {/* Date + tag */}
      <p className="mt-1 text-xs text-muted-foreground">
        {new Date(trade.trade_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        {trade.tag && <span className="ml-2 text-muted-foreground/60">· {trade.tag}</span>}
      </p>

      {/* Entry / SL / TP row */}
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/30 px-3 py-2.5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Entry</p>
          <p className="mt-0.5 font-mono text-sm font-semibold">{trade.entry ?? "—"}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">SL</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-red-400">{trade.sl ?? "—"}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">TP</p>
          <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-400">{trade.tp ?? "—"}</p>
        </div>
      </div>

      {/* PnL + RR footer */}
      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">PnL</p>
          <p className={cn("mt-0.5 font-mono text-base font-bold", trade.pnl != null ? (pnlPositive ? "text-emerald-400" : "text-red-400") : "text-muted-foreground")}>
            {trade.pnl != null ? (pnlPositive ? "+" : "") + trade.pnl.toFixed(2) : "—"}
          </p>
        </div>
        {trade.rr != null && (
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">R:R</p>
            <p className="mt-0.5 font-mono text-base font-bold text-foreground">1:{trade.rr}</p>
          </div>
        )}
      </div>
    </Link>
  );
}
