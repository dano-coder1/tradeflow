import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AIReviewPanel } from "@/components/trades/ai-review-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Trade } from "@/types/trade";
import { cn } from "@/lib/utils";

function Field({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-mono text-sm font-medium", className)}>
        {value ?? "—"}
      </p>
    </div>
  );
}

export default async function TradeDetailPage({
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

  const { data: trade } = await supabase
    .from("trades")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!trade) notFound();

  const t = trade as Trade;

  const resultVariant =
    t.result === "win"
      ? "success"
      : t.result === "loss"
      ? "destructive"
      : t.result === "breakeven"
      ? "warning"
      : "secondary";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{t.symbol}</h1>
            <span
              className={cn(
                "text-sm font-semibold uppercase",
                t.direction === "long" ? "text-success" : "text-destructive"
              )}
            >
              {t.direction}
            </span>
            {t.timeframe && (
              <span className="text-sm text-muted-foreground">{t.timeframe}</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(t.trade_date).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {t.tag && ` · ${t.tag}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {t.result ? (
            <Badge variant={resultVariant} className="text-sm px-3 py-1">
              {t.result.toUpperCase()}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-sm px-3 py-1">
              {t.status.toUpperCase()}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Price Levels</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Entry" value={t.entry?.toString()} />
            <Field
              label="Stop Loss"
              value={t.sl?.toString()}
              className="text-destructive"
            />
            <Field
              label="Take Profit"
              value={t.tp?.toString()}
              className="text-success"
            />
            <Field label="Exit" value={t.exit?.toString()} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Performance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field
              label="PnL"
              value={
                t.pnl != null
                  ? `${t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}`
                  : null
              }
              className={
                t.pnl != null
                  ? t.pnl >= 0
                    ? "text-success"
                    : "text-destructive"
                  : undefined
              }
            />
            <Field
              label="R:R"
              value={t.rr != null ? `1:${t.rr}` : null}
            />
            <Field
              label="Size"
              value={t.size?.toString()}
            />
            <Field
              label="Risk"
              value={t.risk_amount != null ? `$${t.risk_amount}` : null}
            />
          </CardContent>
        </Card>
      </div>

      {t.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{t.notes}</p>
          </CardContent>
        </Card>
      )}

      {t.screenshot_url && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-sm">Screenshot</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Image
              src={t.screenshot_url}
              alt={`${t.symbol} chart`}
              width={1200}
              height={600}
              className="w-full object-contain"
              unoptimized
            />
          </CardContent>
        </Card>
      )}

      <AIReviewPanel trade={t} />
    </div>
  );
}
