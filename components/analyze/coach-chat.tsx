"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { playSound } from "@/lib/sounds";
import {
  GraduationCap,
  Send,
  CornerDownLeft,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CoachMessage } from "@/app/api/ai/coach-chat/route";

const QUICK_ACTIONS: { label: string; icon?: string }[] = [
  { label: "What did I do wrong?" },
  { label: "Where was the best entry?" },
  { label: "Was this a valid setup?" },
  { label: "How to improve next time?" },
];

interface Props {
  analysisId: string | null;
}

export function CoachChat({ analysisId }: Props) {
  const [history, setHistory] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setHistory([]);
    setError(null);
    setInput("");
  }, [analysisId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || !analysisId || loading) return;

    const userMsg: CoachMessage = { role: "user", content: trimmed };
    const next = [...history, userMsg];
    setHistory(next);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/coach-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId, message: trimmed, history }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Coach failed");
      setHistory([...next, { role: "assistant", content: json.reply }]);
      playSound("insight");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get response");
      setHistory(history);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const disabled = !analysisId;

  return (
    <Card className="overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-start justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <GraduationCap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">SMC Coach</p>
            <p className="text-xs text-muted-foreground">
              {disabled
                ? "Run or select an analysis to start"
                : "Ask anything about this specific setup"}
            </p>
          </div>
        </div>
        {!disabled && (
          <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Active
          </div>
        )}
      </div>

      <CardContent className="p-0">
        {/* ── Empty state ── */}
        {disabled && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
              <GraduationCap className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">No analysis selected</p>
            <p className="max-w-[220px] text-xs text-muted-foreground/60">
              Run a chart analysis or pick one from history to unlock the coach.
            </p>
          </div>
        )}

        {!disabled && (
          <div className="flex flex-col">
            {/* ── Quick actions ── */}
            {history.length === 0 && (
              <div className="border-b border-border/50 px-4 py-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  Quick questions
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map(({ label }) => (
                    <button
                      key={label}
                      onClick={() => send(label)}
                      disabled={loading}
                      className="rounded-full border border-border bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Conversation ── */}
            {history.length > 0 && (
              <div className="max-h-96 overflow-y-auto px-4 py-4 space-y-4">
                {history.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex flex-col gap-1",
                      msg.role === "user" ? "items-end" : "items-start"
                    )}
                  >
                    <span className="px-1 text-xs font-medium text-muted-foreground/60">
                      {msg.role === "user" ? "You" : "Coach"}
                    </span>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "rounded-tr-sm bg-primary text-primary-foreground"
                          : "rounded-tl-sm border border-border bg-muted/40 text-foreground"
                      )}
                    >
                      {msg.role === "assistant"
                        ? msg.content.split("\n").filter(Boolean).map((line, j) => (
                            <p key={j} className={j > 0 ? "mt-2" : ""}>
                              {line}
                            </p>
                          ))
                        : msg.content}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {loading && (
                  <div className="flex flex-col items-start gap-1">
                    <span className="px-1 text-xs font-medium text-muted-foreground/60">Coach</span>
                    <div className="rounded-2xl rounded-tl-sm border border-border bg-muted/40 px-4 py-3">
                      <span className="flex items-center gap-1">
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}

            {error && (
              <p className="px-4 pb-2 text-xs text-destructive">{error}</p>
            )}

            {/* ── Input ── */}
            <div className={cn("border-t border-border/50 px-4 py-3", history.length === 0 && "border-t-0 pt-3")}>
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder="Ask about this setup…"
                  rows={1}
                  className="min-h-[38px] w-full resize-none rounded-xl border border-border bg-muted/20 px-3.5 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:cursor-not-allowed"
                />
                <Button
                  onClick={() => send(input)}
                  disabled={loading || !input.trim()}
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-xl"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="mt-1.5 text-right text-xs text-muted-foreground/30">
                <CornerDownLeft className="inline h-3 w-3" /> Enter · Shift+Enter new line
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
