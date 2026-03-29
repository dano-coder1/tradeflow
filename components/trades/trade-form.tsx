"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { tradeFormSchema, TradeFormValues, parseNum } from "@/validators/trade";
import { ExtractTradeResponse } from "@/types/ai";
import {
  calculateRR,
  calculatePnL,
  calculateResult,
  calculateStatus,
} from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScreenshotUpload } from "./screenshot-upload";

export function TradeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TradeFormValues>({
    resolver: zodResolver(tradeFormSchema),
    defaultValues: {
      direction: "long",
      symbol: searchParams.get("symbol") ?? "",
      notes: searchParams.get("notes") ?? "",
      tag: searchParams.get("tag") ?? "",
    },
  });

  const screenshotUrl = watch("screenshotUrl");
  const direction = watch("direction") ?? "long";
  const entryRaw = watch("entry");
  const slRaw = watch("sl");
  const tpRaw = watch("tp");
  const exitRaw = watch("exit");

  const entry = parseNum(entryRaw);
  const sl = parseNum(slRaw);
  const tp = parseNum(tpRaw);
  const exit = parseNum(exitRaw);

  const previewRR = calculateRR(direction, entry, sl, tp);
  const previewPnL = calculatePnL(direction, entry, exit);

  function handleExtracted(data: ExtractTradeResponse) {
    if (data.symbol) setValue("symbol", data.symbol);
    if (data.direction) setValue("direction", data.direction);
    if (data.entry != null) setValue("entry", String(data.entry));
    if (data.sl != null) setValue("sl", String(data.sl));
    if (data.tp != null) setValue("tp", String(data.tp));
    if (data.exit != null) setValue("exit", String(data.exit));
    if (data.timeframe) setValue("timeframe", data.timeframe);
    if (data.notes_from_chart) setValue("notes", data.notes_from_chart);
  }

  async function onSubmit(values: TradeFormValues) {
    setSubmitting(true);
    setServerError(null);

    const dir = values.direction;
    const entryN = parseNum(values.entry);
    const slN = parseNum(values.sl);
    const tpN = parseNum(values.tp);
    const exitN = parseNum(values.exit);

    const rr = calculateRR(dir, entryN, slN, tpN);
    const pnl = calculatePnL(dir, entryN, exitN);
    const result = calculateResult(pnl);
    const status = calculateStatus(exitN);

    const payload = {
      symbol: values.symbol,
      direction: dir,
      entry: entryN,
      exit: exitN,
      sl: slN,
      tp: tpN,
      size: parseNum(values.size),
      risk_amount: parseNum(values.riskAmount),
      timeframe: values.timeframe || null,
      tag: values.tag || null,
      notes: values.notes || null,
      screenshot_url: values.screenshotUrl || null,
      ai_extracted: false,
      rr,
      pnl,
      result,
      status,
      trade_date: new Date().toISOString().split("T")[0],
    };

    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save trade");
      router.push(`/trades/${json.id}`);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Failed to save trade");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Screenshot</CardTitle>
        </CardHeader>
        <CardContent>
          <ScreenshotUpload
            value={screenshotUrl ?? null}
            onChange={(url) => setValue("screenshotUrl", url ?? "")}
            onExtracted={handleExtracted}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trade Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="symbol">Symbol *</Label>
              <Input
                id="symbol"
                placeholder="EURUSD, BTCUSD…"
                {...register("symbol")}
                error={errors.symbol?.message}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="direction">Direction *</Label>
              <Select id="direction" {...register("direction")}>
                <option value="long">Long (Buy)</option>
                <option value="short">Short (Sell)</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="entry">Entry</Label>
              <Input
                id="entry"
                type="number"
                step="any"
                placeholder="0.00000"
                {...register("entry")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sl">Stop Loss</Label>
              <Input
                id="sl"
                type="number"
                step="any"
                placeholder="0.00000"
                {...register("sl")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tp">Take Profit</Label>
              <Input
                id="tp"
                type="number"
                step="any"
                placeholder="0.00000"
                {...register("tp")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exit">Exit Price</Label>
              <Input
                id="exit"
                type="number"
                step="any"
                placeholder="0.00000"
                {...register("exit")}
              />
            </div>
          </div>

          {(previewRR != null || previewPnL != null) && (
            <div className="flex gap-4 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm">
              {previewRR != null && (
                <span className="text-muted-foreground">
                  R:R{" "}
                  <span className="font-semibold text-foreground">
                    1:{previewRR}
                  </span>
                </span>
              )}
              {previewPnL != null && (
                <span className="text-muted-foreground">
                  PnL{" "}
                  <span
                    className={`font-semibold ${previewPnL >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {previewPnL >= 0 ? "+" : ""}
                    {previewPnL}
                  </span>
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="size">Size / Lots</Label>
              <Input
                id="size"
                type="number"
                step="any"
                placeholder="0.01"
                {...register("size")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="riskAmount">Risk Amount ($)</Label>
              <Input
                id="riskAmount"
                type="number"
                step="any"
                placeholder="50"
                {...register("riskAmount")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="timeframe">Timeframe</Label>
              <Select id="timeframe" {...register("timeframe")}>
                <option value="">— Select —</option>
                <option value="M1">M1</option>
                <option value="M5">M5</option>
                <option value="M15">M15</option>
                <option value="M30">M30</option>
                <option value="H1">H1</option>
                <option value="H4">H4</option>
                <option value="D1">D1</option>
                <option value="W1">W1</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tag">Tag / Setup</Label>
              <Input
                id="tag"
                placeholder="OB retest, FVG…"
                {...register("tag")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Trade reasoning, market context…"
              rows={3}
              {...register("notes")}
            />
          </div>
        </CardContent>
      </Card>

      {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Save Trade
        </Button>
      </div>
    </form>
  );
}
