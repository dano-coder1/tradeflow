"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TraderProfile, StrategyProfile, TradingStyle, ExperienceLevel } from "@/types/trader-profile";
import { STRATEGY_PRESETS } from "@/lib/strategy-presets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Sparkles,
  BookOpen,
  ChevronRight,
  RotateCcw,
  ArrowRight,
} from "lucide-react";

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; desc: string }[] = [
  { value: "beginner",     label: "Beginner",     desc: "< 1 year, still learning the basics" },
  { value: "intermediate", label: "Intermediate",  desc: "1-3 years, consistent but still developing" },
  { value: "advanced",     label: "Advanced",      desc: "3+ years, clear edge and solid rules" },
];

interface Props {
  initialProfile: TraderProfile | null;
  onSaved?: (profile: TraderProfile) => void;
}

export function StrategySetup({ initialProfile, onSaved }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"own" | "preset">(
    initialProfile ? "own" : "own"
  );
  const [text, setText] = useState(initialProfile?.strategy_text ?? "");
  const [experience, setExperience] = useState<ExperienceLevel>(
    initialProfile?.experience_level ?? "beginner"
  );
  const [selectedPreset, setSelectedPreset] = useState<Exclude<TradingStyle, "custom"> | null>(
    initialProfile && initialProfile.style !== "custom"
      ? (initialProfile.style as Exclude<TradingStyle, "custom">)
      : null
  );
  const [preview, setPreview] = useState<{
    style: TradingStyle;
    strategy: StrategyProfile;
  } | null>(
    initialProfile
      ? { style: initialProfile.style, strategy: initialProfile.strategy_json }
      : null
  );
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleParse() {
    if (!text.trim()) return;
    setParsing(true);
    setError(null);
    setPreview(null);

    try {
      const res = await fetch("/api/ai/parse-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Parse failed");
      setPreview({ style: json.style, strategy: json.strategy });
      playSound("insight");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse strategy");
      playSound("mistake");
    } finally {
      setParsing(false);
    }
  }

  function handleSelectPreset(key: Exclude<TradingStyle, "custom">) {
    const preset = STRATEGY_PRESETS[key];
    setSelectedPreset(key);
    setPreview({ style: preset.style, strategy: preset.strategy });
    playSound("insight");
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/trader-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style: preview.style,
          experience_level: experience,
          strategy_json: preview.strategy,
          strategy_text: mode === "own" ? text : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error("[strategy-setup] save failed:", json);
        throw new Error(json.error ?? "Save failed");
      }
      setSaved(true);
      playSound("success");
      router.refresh();
      onSaved?.(json as TraderProfile);
    } catch (e) {
      console.error("[strategy-setup] error:", e);
      setError(e instanceof Error ? e.message : "Failed to save profile");
      playSound("mistake");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setMode("own"); setPreview(null); setSaved(false); }}
          className={cn(
            "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
            mode === "own"
              ? "border-primary/50 bg-primary/8 text-foreground"
              : "border-border/50 bg-card hover:border-border text-muted-foreground"
          )}
        >
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-sm">I have my own strategy</p>
            <p className="mt-0.5 text-xs opacity-70">Describe it — AI will structure it for you</p>
          </div>
        </button>
        <button
          onClick={() => { setMode("preset"); setPreview(null); setSaved(false); }}
          className={cn(
            "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
            mode === "preset"
              ? "border-primary/50 bg-primary/8 text-foreground"
              : "border-border/50 bg-card hover:border-border text-muted-foreground"
          )}
        >
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-semibold text-sm">Teach me a strategy</p>
            <p className="mt-0.5 text-xs opacity-70">Pick a preset and start with proven rules</p>
          </div>
        </button>
      </div>

      {/* Option A: Own strategy */}
      {mode === "own" && (
        <div className="space-y-3">
          <Textarea
            placeholder={`Describe your trading strategy in plain language. For example:\n\n"I trade SMC on Gold 4H. I wait for a liquidity sweep on the daily, then look for a BOS on H1, and enter on H4 order blocks with SL below the order block and TP at the next swing high. I only trade 1% risk per trade and skip if I see conflicting structure..."`}
            value={text}
            onChange={(e) => { setText(e.target.value); setSaved(false); }}
            className="min-h-[180px] font-sans text-sm"
          />
          <Button
            onClick={handleParse}
            disabled={!text.trim()}
            loading={parsing}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {parsing ? "Parsing…" : "Parse with AI"}
          </Button>
        </div>
      )}

      {/* Option B: Presets */}
      {mode === "preset" && (
        <div className="grid gap-3">
          {(Object.entries(STRATEGY_PRESETS) as [Exclude<TradingStyle, "custom">, typeof STRATEGY_PRESETS[keyof typeof STRATEGY_PRESETS]][]).map(
            ([key, preset]) => (
              <button
                key={key}
                onClick={() => handleSelectPreset(key)}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                  selectedPreset === key
                    ? "border-primary/50 bg-primary/8"
                    : "border-border/50 bg-card hover:border-border"
                )}
              >
                <div>
                  <p className="font-semibold text-sm">{preset.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{preset.description}</p>
                </div>
                {selectedPreset === key ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                )}
              </button>
            )
          )}
        </div>
      )}

      {/* Experience level */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Experience Level
        </p>
        <div className="grid grid-cols-3 gap-2">
          {EXPERIENCE_OPTIONS.map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => setExperience(value)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                experience === value
                  ? "border-primary/50 bg-primary/8 text-foreground"
                  : "border-border/50 bg-card text-muted-foreground hover:border-border"
              )}
            >
              <p className="font-semibold">{label}</p>
              <p className="mt-0.5 text-muted-foreground/70">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <Card className="border-success/20">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              Strategy Preview
              <span className="ml-auto rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-success">
                {preview.style}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            {(
              [
                ["Entry Rules",           preview.strategy.entry_rules],
                ["Exit Rules",            preview.strategy.exit_rules],
                ["Confirmation",          preview.strategy.confirmation_rules],
                ["Risk Management",       preview.strategy.risk_management],
              ] as [string, string[]][]
            ).map(([title, items]) =>
              items.length ? (
                <div key={title}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {title}
                  </p>
                  <ul className="space-y-1">
                    {items.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}

            {(preview.strategy.non_negotiables ?? []).length > 0 && (
              <div className="rounded-lg border border-warning/25 bg-warning/5 px-4 py-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-warning">
                  Non-Negotiable Rules
                </p>
                <ul className="space-y-1">
                  {preview.strategy.non_negotiables.map((rule, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="shrink-0 font-bold text-warning/60">{i + 1}.</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Success banner */}
      {saved && (
        <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/8 px-4 py-3.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-success">Strategy saved successfully</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              The AI coach and trade reviews will now use your rules.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="mt-0.5 flex shrink-0 items-center gap-1 text-xs font-medium text-success hover:underline"
          >
            Dashboard
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Save */}
      {preview && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saved} loading={saving} className="gap-2">
            {saved ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Saved
              </>
            ) : (
              "Save Strategy"
            )}
          </Button>
          {!saved && (
            <button
              onClick={() => { setPreview(null); setSelectedPreset(null); }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
