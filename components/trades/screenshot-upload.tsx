"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Wand2 } from "lucide-react";
import Image from "next/image";
import { ExtractTradeResponse } from "@/types/ai";

interface ScreenshotUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  onExtracted: (data: ExtractTradeResponse) => void;
}

export function ScreenshotUpload({
  value,
  onChange,
  onExtracted,
}: ScreenshotUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      onChange(json.imageUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleExtract() {
    if (!value) return;
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/extract-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Extraction failed");
      onExtracted(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {!value ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
        >
          <Upload className="h-6 w-6" />
          {uploading ? "Uploading…" : "Click to upload screenshot"}
        </button>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-border">
          <Image
            src={value}
            alt="Trade screenshot"
            width={800}
            height={400}
            className="w-full object-contain"
            unoptimized
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-foreground backdrop-blur-sm hover:bg-background"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {value && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExtract}
          loading={extracting}
          className="gap-1.5"
        >
          <Wand2 className="h-4 w-4" />
          Extract from Screenshot
        </Button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
