import { Trade } from "@/types/trade";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

type StatusConfig = {
  label: string;
  variant: "success" | "destructive" | "warning" | "default" | "secondary" | "outline";
  borderClass: string;
  bgClass: string;
};

function getStatusConfig(
  result: Trade["result"],
  status: Trade["status"]
): StatusConfig {
  if (result === "win")
    return {
      label: "WIN",
      variant: "success",
      borderClass: "border-success/30",
      bgClass: "bg-success/5",
    };
  if (result === "loss")
    return {
      label: "LOSS",
      variant: "destructive",
      borderClass: "border-destructive/30",
      bgClass: "bg-destructive/5",
    };
  if (result === "breakeven")
    return {
      label: "BE",
      variant: "warning",
      borderClass: "border-warning/30",
      bgClass: "bg-warning/5",
    };
  if (status === "open")
    return {
      label: "OPEN",
      variant: "default",
      borderClass: "border-primary/30",
      bgClass: "bg-primary/5",
    };
  if (status === "cancelled")
    return {
      label: "CANCELLED",
      variant: "secondary",
      borderClass: "border-border/40",
      bgClass: "",
    };
  return {
    label: "CLOSED",
    variant: "secondary",
    borderClass: "border-border/40",
    bgClass: "",
  };
}

function LevelCell({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number | null;
  colorClass?: string;
}) {
  return (
    <div className="flex flex-col items-center py-3 px-3">
      <span className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-sm font-bold",
          value == null ? "text-muted-foreground/30" : colorClass
        )}
      >
        {value != null ? value.toLocaleString() : "—"}
      </span>
    </div>
  );
}

export function ExecutionCard({ trade }: { trade: Trade }) {
  const { label, variant, borderClass, bgClass } = getStatusConfig(
    trade.result,
    trade.status
  );
  const isLong = trade.direction === "long";
  const DirIcon = isLong ? TrendingUp : TrendingDown;
  const dirColor = isLong ? "text-success" : "text-destructive";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card px-5 py-4 space-y-4",
        borderClass,
        bgClass
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-lg font-bold tracking-tight">
              {trade.symbol}
            </span>
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-bold uppercase tracking-wide",
                dirColor
              )}
            >
              <DirIcon className="h-3.5 w-3.5" />
              {trade.direction}
            </div>
            {trade.timeframe && (
              <span className="rounded bg-muted/60 px-1.5 py-0.5 text-xs text-muted-foreground">
                {trade.timeframe}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(trade.trade_date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {trade.tag && (
              <span className="ml-2 text-muted-foreground/60">
                · {trade.tag}
              </span>
            )}
          </p>
        </div>
        <Badge
          variant={variant}
          className="shrink-0 px-3 py-1 text-xs font-bold uppercase tracking-widest"
        >
          {label}
        </Badge>
      </div>

      {/* ── Price levels ── */}
      <div className="grid grid-cols-3 divide-x divide-border/40 rounded-lg border border-border/40 bg-muted/20">
        <LevelCell label="Entry" value={trade.entry} colorClass="text-foreground" />
        <LevelCell
          label="Stop Loss"
          value={trade.sl}
          colorClass="text-destructive"
        />
        <LevelCell
          label="Take Profit"
          value={trade.tp}
          colorClass="text-success"
        />
      </div>

      {/* ── PnL / Exit / RR ── */}
      {(trade.exit != null || trade.pnl != null || trade.rr != null) && (
        <div className="flex flex-wrap items-center gap-5 rounded-lg border border-border/30 bg-muted/10 px-4 py-2.5">
          {trade.exit != null && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Exit
              </p>
              <p className="font-mono text-sm font-medium">
                {trade.exit.toLocaleString()}
              </p>
            </div>
          )}
          {trade.pnl != null && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                PnL
              </p>
              <p
                className={cn(
                  "font-mono text-sm font-bold",
                  trade.pnl >= 0 ? "text-success" : "text-destructive"
                )}
              >
                {trade.pnl >= 0 ? "+" : ""}
                {trade.pnl.toFixed(2)}
              </p>
            </div>
          )}
          {trade.rr != null && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                R:R
              </p>
              <p className="font-mono text-sm font-medium">1:{trade.rr}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Notes ── */}
      {trade.notes && (
        <p className="border-t border-border/30 pt-3 text-xs leading-relaxed text-muted-foreground">
          {trade.notes}
        </p>
      )}
    </div>
  );
}
