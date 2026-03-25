import { Trade } from "@/types/trade";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, BarChart2 } from "lucide-react";

function fmt(n: number | null, decimals = 2) {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

export function StatsCards({ trades }: { trades: Trade[] }) {
  const closed = trades.filter((t) => t.status === "closed");
  const wins = closed.filter((t) => t.result === "win").length;
  const losses = closed.filter((t) => t.result === "loss").length;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : null;
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const avgRR =
    closed.length > 0
      ? closed.reduce((sum, t) => sum + (t.rr ?? 0), 0) / closed.length
      : null;

  const stats = [
    {
      label: "Total Trades",
      value: trades.length.toString(),
      sub: `${closed.length} closed`,
      icon: BarChart2,
      color: "text-primary",
    },
    {
      label: "Win Rate",
      value: winRate != null ? `${winRate.toFixed(1)}%` : "—",
      sub: `${wins}W / ${losses}L`,
      icon: Target,
      color: winRate != null && winRate >= 50 ? "text-success" : "text-destructive",
    },
    {
      label: "Total PnL",
      value: `${totalPnl >= 0 ? "+" : ""}${fmt(totalPnl)}`,
      sub: "closed trades",
      icon: totalPnl >= 0 ? TrendingUp : TrendingDown,
      color: totalPnl >= 0 ? "text-success" : "text-destructive",
    },
    {
      label: "Avg R:R",
      value: avgRR != null ? `1:${fmt(avgRR)}` : "—",
      sub: "closed trades",
      icon: BarChart2,
      color: "text-warning",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 w-full">
      {stats.map((s) => (
        <Card key={s.label} className="w-full">
          <CardContent className="flex items-start justify-between p-5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <p className={`mt-1.5 text-3xl font-extrabold tracking-tight ${s.color}`}>{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
            </div>
            <s.icon className={`h-5 w-5 shrink-0 ${s.color} opacity-50`} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
