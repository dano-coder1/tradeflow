"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Paperclip, GraduationCap, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LearnMessage } from "@/app/api/learn/chat/route";

const QUICK_CHIPS = [
  "What is BOS?",
  "Explain liquidity sweep",
  "What is an Order Block?",
  "How to control FOMO?",
  "What is risk management?",
];

interface DisplayMessage extends LearnMessage {
  imagePreview?: string;
}

export function LearnChat() {
  const [history, setHistory] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachment, setAttachment] = useState<{
    base64: string;
    name: string;
    preview?: string;
    isPdf: boolean;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, loading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed && !attachment) return;
      if (loading) return;

      // Handle PDF — tell user it's not supported yet
      if (attachment?.isPdf) {
        const userMsg: DisplayMessage = { role: "user", content: trimmed || `[Uploaded: ${attachment.name}]` };
        const assistantMsg: DisplayMessage = {
          role: "assistant",
          content:
            "PDF analysis is not yet supported. For now, please take a screenshot of the relevant page and upload it as an image. I'll be happy to explain what's on the chart or document!",
        };
        setHistory((prev) => [...prev, userMsg, assistantMsg]);
        setAttachment(null);
        setInput("");
        return;
      }

      const userMsg: DisplayMessage = {
        role: "user",
        content: trimmed || (attachment ? "Please explain this chart." : ""),
        imagePreview: attachment?.preview,
      };

      setHistory((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      // Build API history (text only, no previews)
      const apiHistory: LearnMessage[] = history.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const res = await fetch("/api/learn/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userMsg.content,
            history: apiHistory,
            imageBase64: attachment?.base64 ?? undefined,
          }),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Request failed");

        setHistory((prev) => [...prev, { role: "assistant", content: json.reply }]);
      } catch (err) {
        setHistory((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, something went wrong. Please try again." },
        ]);
      } finally {
        setLoading(false);
        setAttachment(null);
      }
    },
    [history, attachment, loading]
  );

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const isPdf = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAttachment({
        base64,
        name: file.name,
        preview: isImage ? base64 : undefined,
        isPdf,
      });
    };
    reader.readAsDataURL(file);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const isEmpty = history.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
        {isEmpty && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0EA5E9]/20 to-[#8B5CF6]/20 border border-white/[0.06]">
              <GraduationCap className="h-7 w-7 text-[#0EA5E9]" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">Start learning</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Ask any question about trading, SMC concepts, psychology, or upload a chart screenshot to get it explained.
              </p>
            </div>
          </div>
        )}

        {history.map((msg, i) => (
          <div
            key={i}
            className={cn("flex gap-3 px-2", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            {msg.role === "assistant" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0EA5E9]/20 to-[#8B5CF6]/20 mt-0.5">
                <GraduationCap className="h-3.5 w-3.5 text-[#0EA5E9]" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-[#0EA5E9]/15 text-foreground"
                  : "glass text-foreground"
              )}
            >
              {msg.imagePreview && (
                <img
                  src={msg.imagePreview}
                  alt="Uploaded"
                  className="max-h-48 rounded-lg mb-2 border border-white/[0.06]"
                />
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 px-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0EA5E9]/20 to-[#8B5CF6]/20 mt-0.5">
              <GraduationCap className="h-3.5 w-3.5 text-[#0EA5E9]" />
            </div>
            <div className="glass rounded-xl px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5E9] animate-pulse" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5E9] animate-pulse [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5E9] animate-pulse [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick chips */}
      {isEmpty && !loading && (
        <div className="flex flex-wrap gap-2 pb-3">
          {QUICK_CHIPS.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-[#0EA5E9]/30 hover:bg-[#0EA5E9]/5 hover:text-foreground"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Attachment preview */}
      {attachment && (
        <div className="flex items-center gap-2 pb-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-muted-foreground">
            {attachment.preview && (
              <img src={attachment.preview} alt="" className="h-8 w-8 rounded object-cover" />
            )}
            <span className="max-w-[200px] truncate">{attachment.name}</span>
            <button onClick={() => setAttachment(null)} className="text-muted-foreground/60 hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="glass rounded-xl p-2 flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleFile}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          title="Upload image or PDF"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about trading..."
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none py-2 max-h-32"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || (!input.trim() && !attachment)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0EA5E9] text-white transition-all hover:bg-[#0EA5E9]/80 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
