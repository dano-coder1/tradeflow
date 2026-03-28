"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { playSound } from "@/lib/sounds";
import { Brain, Send, CornerDownLeft, Zap, Paperclip, X, Play } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CoachMessage } from "@/app/api/ai/coach-chat/route";
import { getActiveStrategy, type SavedStrategy } from "@/lib/strategy-store";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Attachment {
  id: string;
  type: "image" | "youtube";
  /** URL sent to the AI (signed upload URL, image URL, or YouTube thumbnail URL) */
  url: string;
  /** URL shown in the UI preview */
  previewUrl: string;
  label: string;
  uploading: boolean;
}

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: Array<{
    type: "image" | "youtube";
    previewUrl: string;
    label: string;
  }>;
}

// ── URL detection helpers ──────────────────────────────────────────────────────

const IMAGE_EXT_RE = /\.(png|jpg|jpeg|webp|gif)(\?[^\s]*)?$/i;
const YT_RE =
  /(?:youtube\.com\/(?:watch\?(?:[^\s]*&)?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function getYouTubeId(url: string): string | null {
  return url.match(YT_RE)?.[1] ?? null;
}

function detectMediaInText(text: string): Attachment[] {
  const urlRe = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const urls = [...text.matchAll(urlRe)].map((m) => m[0]);
  const seen = new Set<string>();
  const result: Attachment[] = [];

  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);

    const ytId = getYouTubeId(url);
    if (ytId) {
      const thumb = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
      result.push({
        id: url,
        type: "youtube",
        url: thumb,
        previewUrl: thumb,
        label: url,
        uploading: false,
      });
    } else if (IMAGE_EXT_RE.test(url.split("?")[0])) {
      result.push({
        id: url,
        type: "image",
        url,
        previewUrl: url,
        label: url.split("/").pop()?.split("?")[0] ?? "image",
        uploading: false,
      });
    }
  }
  return result;
}

// ── Quick actions ──────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  "Is this a valid entry based on my rules?",
  "What am I most likely to miss?",
  "Walk me through my non-negotiables",
  "What setups should I avoid?",
  "How should I size this trade?",
];

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  hasProfile: boolean;
}

export function StrategyChat({ hasProfile }: Props) {
  const searchParams = useSearchParams();
  const [activeStrategy, setActiveStrategy] = useState<SavedStrategy | null>(null);

  // Load active strategy from shared store on mount
  useEffect(() => {
    setActiveStrategy(getActiveStrategy());
  }, []);

  const hasStrategy = hasProfile || activeStrategy !== null;

  // displayHistory drives rendering (includes attachment thumbnails)
  const [displayHistory, setDisplayHistory] = useState<DisplayMessage[]>([]);
  // apiHistory is the text-only list sent to the API as conversation context
  const [apiHistory, setApiHistory] = useState<CoachMessage[]>([]);
  // File attachments (user-uploaded images)
  const [fileAttachments, setFileAttachments] = useState<Attachment[]>([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSent, setAutoSent] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-send initial context from chart page
  useEffect(() => {
    if (autoSent || !hasStrategy) return;
    const sym = searchParams.get("symbol");
    if (!sym) return;
    setAutoSent(true);

    const price = searchParams.get("price");
    const context = searchParams.get("context");
    const chartMode = searchParams.get("chartMode");

    const parts = [`Analyze ${sym} for me.`];
    if (price) parts.push(`Current price: ${price}.`);
    if (chartMode) parts.push(`Chart mode: ${chartMode}.`);
    if (context) parts.push(context);
    parts.push("Based on my strategy, is this a good setup? What should I watch for?");

    const msg = parts.join(" ");
    // Use setTimeout to let the component fully mount before sending
    setTimeout(() => send(msg), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStrategy, autoSent]);

  // URLs auto-detected from the typed/pasted message text
  const detectedUrls = useMemo(() => detectMediaInText(input), [input]);

  // Combined preview strip: uploaded files + detected URLs (deduped)
  const pendingAttachments = useMemo(() => {
    const fileUrls = new Set(fileAttachments.map((a) => a.url));
    return [
      ...fileAttachments,
      ...detectedUrls.filter((d) => !fileUrls.has(d.url)),
    ];
  }, [fileAttachments, detectedUrls]);

  const canSend =
    !loading &&
    (input.trim().length > 0 ||
      pendingAttachments.some((a) => !a.uploading && a.url));

  // ── File upload ──────────────────────────────────────────────────────────────

  async function handleFileSelect(files: FileList) {
    const allowed = Array.from(files).filter((f) =>
      ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(f.type)
    );
    if (allowed.length === 0) return;

    // Add placeholders immediately so user sees feedback
    const placeholders: Attachment[] = allowed.map((f) => ({
      id: `file-${Date.now()}-${f.name}`,
      type: "image",
      url: "",
      previewUrl: URL.createObjectURL(f),
      label: f.name,
      uploading: true,
    }));
    setFileAttachments((prev) => [...prev, ...placeholders]);

    for (let i = 0; i < allowed.length; i++) {
      const file = allowed[i];
      const placeholder = placeholders[i];
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        setFileAttachments((prev) =>
          prev.map((a) =>
            a.id === placeholder.id
              ? { ...a, url: json.imageUrl, uploading: false }
              : a
          )
        );
      } catch {
        // Remove failed upload silently
        setFileAttachments((prev) => prev.filter((a) => a.id !== placeholder.id));
      }
    }
  }

  function removeFileAttachment(id: string) {
    setFileAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  // ── Send ─────────────────────────────────────────────────────────────────────

  async function send(messageText: string) {
    const trimmed = messageText.trim();
    const readyAttachments = pendingAttachments.filter(
      (a) => !a.uploading && a.url
    );
    const imageUrls = readyAttachments.map((a) => a.url);

    if (!trimmed && imageUrls.length === 0) return;
    if (loading) return;

    // Text sent to AI — fallback when user sends images with no text
    const apiText =
      trimmed || "Please analyze this chart based on my strategy.";

    const displayMsg: DisplayMessage = {
      role: "user",
      content: trimmed,
      attachments: readyAttachments.map((a) => ({
        type: a.type,
        previewUrl: a.previewUrl,
        label: a.label,
      })),
    };

    // Snapshot history before async call to avoid stale closures
    const nextDisplay = [...displayHistory, displayMsg];
    const nextApi: CoachMessage[] = [
      ...apiHistory,
      { role: "user", content: apiText },
    ];

    setDisplayHistory(nextDisplay);
    setApiHistory(nextApi);
    setInput("");
    setFileAttachments([]);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/strategy-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: apiText,
          history: apiHistory,
          imageUrls,
          activeStrategy: activeStrategy ? {
            name: activeStrategy.name,
            summary: activeStrategy.summary,
            rules: activeStrategy.rules,
            methodology: activeStrategy.methodologyTags.join(", "),
          } : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to get response");

      const replyMsg: DisplayMessage = { role: "assistant", content: json.reply };
      setDisplayHistory([...nextDisplay, replyMsg]);
      setApiHistory([...nextApi, { role: "assistant", content: json.reply }]);
      playSound("insight");
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get response");
      // Roll back optimistic history
      setDisplayHistory(displayHistory);
      setApiHistory(apiHistory);
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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Card className="flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              Strategy Coach
              {activeStrategy && <span className="text-muted-foreground font-normal"> · {activeStrategy.name}</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {hasStrategy
                ? "Ask anything · paste charts · drop links"
                : "Select a strategy to unlock"}
            </p>
          </div>
        </div>
        {hasStrategy && (
          <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            Active
          </div>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col p-0">
        {/* Empty state: no strategy */}
        {!hasStrategy && (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
              <Brain className="h-5 w-5 text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                No active strategy selected
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Select or create a strategy to unlock your personal coach.
              </p>
              <Link href="/dashboard/strategy" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors">
                Go to Strategy
              </Link>
            </div>
          </div>
        )}

        {hasStrategy && (
          <div className="flex flex-1 flex-col">
            {/* Quick actions — only when no messages yet */}
            {displayHistory.length === 0 && (
              <div className="border-b border-border/50 px-4 py-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  Quick questions
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map((label) => (
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

            {/* Conversation history */}
            {displayHistory.length > 0 && (
              <div className="max-h-[420px] overflow-y-auto px-4 py-4 space-y-4">
                {displayHistory.map((msg, i) => (
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
                        "max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "rounded-tr-sm bg-primary text-primary-foreground"
                          : "rounded-tl-sm border border-border bg-muted/40 text-foreground"
                      )}
                    >
                      {/* Text content */}
                      {msg.content && (
                        msg.role === "assistant" ? (
                          msg.content
                            .split("\n")
                            .filter(Boolean)
                            .map((line, j) => (
                              <p key={j} className={j > 0 ? "mt-2" : ""}>
                                {line}
                              </p>
                            ))
                        ) : (
                          <p>{msg.content}</p>
                        )
                      )}

                      {/* Attachment thumbnails in bubble */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div
                          className={cn(
                            "flex flex-wrap gap-1.5",
                            msg.content && "mt-2"
                          )}
                        >
                          {msg.attachments.map((att, j) => (
                            <div
                              key={j}
                              className="relative overflow-hidden rounded-lg border border-white/20"
                            >
                              <Image
                                src={att.previewUrl}
                                alt={att.label}
                                width={120}
                                height={80}
                                className="h-20 w-[120px] object-cover"
                                unoptimized
                              />
                              {att.type === "youtube" && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                  <Play className="h-5 w-5 text-white drop-shadow" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {loading && (
                  <div className="flex flex-col items-start gap-1">
                    <span className="px-1 text-xs font-medium text-muted-foreground/60">
                      Coach
                    </span>
                    <div className="rounded-2xl rounded-tl-sm border border-border bg-muted/40 px-4 py-3">
                      <span className="flex items-center gap-1">
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/40"
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

            {/* Input area */}
            <div
              className={cn(
                "mt-auto border-t border-border/50 px-4 py-3",
                displayHistory.length === 0 && "border-t-0 pt-3"
              )}
            >
              {/* Attachment preview strip */}
              {pendingAttachments.length > 0 && (
                <div className="mb-2.5 flex flex-wrap gap-2">
                  {pendingAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="group relative overflow-hidden rounded-lg border border-border bg-muted/30"
                    >
                      {att.uploading ? (
                        <div className="flex h-14 w-20 items-center justify-center">
                          <span className="flex items-center gap-1">
                            {[0, 100, 200].map((d) => (
                              <span
                                key={d}
                                className="h-1 w-1 animate-bounce rounded-full bg-muted-foreground/40"
                                style={{ animationDelay: `${d}ms` }}
                              />
                            ))}
                          </span>
                        </div>
                      ) : (
                        <>
                          <Image
                            src={att.previewUrl}
                            alt={att.label}
                            width={80}
                            height={56}
                            className="h-14 w-20 object-cover"
                            unoptimized
                          />
                          {att.type === "youtube" && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                              <Play className="h-4 w-4 text-white drop-shadow" />
                            </div>
                          )}
                          {/* Remove button — only for file uploads (not auto-detected URL previews) */}
                          {fileAttachments.some((f) => f.id === att.id) && (
                            <button
                              onClick={() => removeFileAttachment(att.id)}
                              className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Text input row */}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) =>
                    e.target.files && handleFileSelect(e.target.files)
                  }
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  title="Attach image"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/20 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  placeholder="Ask anything or paste a chart link…"
                  rows={1}
                  className="min-h-[38px] w-full resize-none rounded-xl border border-border bg-muted/20 px-3.5 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:cursor-not-allowed"
                />
                <Button
                  onClick={() => send(input)}
                  disabled={!canSend}
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-xl"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="mt-1.5 text-right text-xs text-muted-foreground/30">
                <CornerDownLeft className="inline h-3 w-3" /> Enter · Shift+Enter
                new line
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
