"use client";

import { useState, useRef, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Loader2, ChevronDown, ChevronRight, Plus, Check,
  Upload, Link2, FileText, Sparkles, X, Pencil, Trash2, Eye,
  BookOpen, Globe, Wrench, FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type SavedStrategy, type CuratedStrategy, CURATED_STRATEGIES,
  loadStrategies, saveStrategies, loadActiveStrategyId, saveActiveStrategyId, syncActiveStrategyToProfile,
} from "@/lib/strategy-store";
import { StrategyVisuals } from "./strategy-visuals";
import { PlaybookTab } from "./playbook-tab";

// ── Filter chips ─────────────────────────────────────────────────────────────

const FILTER_CHIPS = [
  "beginner", "intermediate", "advanced",
  "forex", "gold", "indices", "futures",
  "breakout", "swing", "trend", "scalping", "smc",
];

// ── Difficulty badge ─────────────────────────────────────────────────────────

function DiffBadge({ d }: { d: string }) {
  const cls = d === "beginner" ? "bg-emerald-500/15 text-emerald-400"
    : d === "advanced" ? "bg-red-500/15 text-red-400"
    : "bg-amber-500/15 text-amber-400";
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", cls)}>{d}</span>;
}

// ── Tab type ─────────────────────────────────────────────────────────────────

type Tab = "curated" | "search" | "custom" | "saved" | "playbooks";

// ── Main component ───────────────────────────────────────────────────────────

export function StrategyLibrary() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("curated");
  const [strategies, setStrats] = useState<SavedStrategy[]>(() => loadStrategies());
  const [activeId, setActiveId] = useState<string | null>(() => loadActiveStrategyId());
  const [expandedCurated, setExpandedCurated] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ title: string; summary: string; methodology: string; marketFit: string[]; difficulty: string; rules: string[]; sourceDescription?: string }[]>([]);

  // Custom ingestion state
  const [customText, setCustomText] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; data: string }[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<{ summary: string; rules: string[]; methodologyTags: string[]; marketTags: string[]; difficulty: string } | null>(null);
  const [newName, setNewName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Management state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function setActive(id: string) {
    setActiveId(id);
    saveActiveStrategyId(id);
    // Sync to Supabase so dashboard server component can display it
    const strat = strategies.find((s) => s.id === id);
    if (strat) syncActiveStrategyToProfile(strat);
  }

  function addStrat(s: SavedStrategy) {
    const next = [...strategies, s];
    setStrats(next);
    saveStrategies(next);
    setActiveId(s.id);
    saveActiveStrategyId(s.id);
    syncActiveStrategyToProfile(s);
  }

  function removeStrat(id: string) {
    const next = strategies.filter((s) => s.id !== id);
    setStrats(next);
    saveStrategies(next);
    if (activeId === id) { setActiveId(null); saveActiveStrategyId(null); }
    setDeleteConfirm(null);
  }

  function renameStrat(id: string, name: string) {
    const next = strategies.map((s) => s.id === id ? { ...s, name } : s);
    setStrats(next);
    saveStrategies(next);
    setEditingId(null);
  }

  function useCurated(c: CuratedStrategy) {
    const s: SavedStrategy = {
      id: crypto.randomUUID(),
      name: c.name,
      source: "preset",
      summary: c.summary,
      rules: c.rules,
      methodologyTags: c.methodologyTags,
      marketTags: c.marketFit,
      difficulty: c.difficulty,
      created_at: new Date().toISOString(),
    };
    addStrat(s);
    setTab("saved");
  }

  function useSearchResult(r: typeof searchResults[0]) {
    const s: SavedStrategy = {
      id: crypto.randomUUID(),
      name: r.title,
      source: "search",
      summary: r.summary,
      rules: r.rules,
      methodologyTags: [r.methodology.toLowerCase()],
      marketTags: r.marketFit,
      difficulty: r.difficulty as SavedStrategy["difficulty"],
      created_at: new Date().toISOString(),
    };
    addStrat(s);
    setTab("saved");
  }

  // ── Search ─────────────────────────────────────────────────────────────────

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch("/api/strategy/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, filters: searchFilters }),
      });
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch { setSearchResults([]); }
    setSearching(false);
  }

  // ── Custom extraction ──────────────────────────────────────────────────────

  function handleFiles(fl: FileList) {
    Array.from(fl).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => { if (typeof reader.result === "string") setUploadedFiles((p) => [...p, { name: f.name, data: reader.result as string }]); };
      reader.readAsDataURL(f);
    });
  }

  function handleDrop(e: DragEvent) { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files); }

  async function handleExtract() {
    setExtracting(true);
    setExtracted(null);
    try {
      const payload: Record<string, unknown> = {};
      if (customText.trim()) payload.text = customText;
      if (customUrl.trim()) payload.url = customUrl;
      if (uploadedFiles.length > 0) payload.files = uploadedFiles;
      const res = await fetch("/api/strategy/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.summary) {
        setExtracted(data);
        setNewName("My Strategy");
      }
    } catch {}
    setExtracting(false);
  }

  function confirmExtracted() {
    if (!extracted) return;
    const source: SavedStrategy["source"] = customUrl ? "url" : uploadedFiles.length > 0 ? "file" : "text";
    const s: SavedStrategy = {
      id: crypto.randomUUID(),
      name: newName.trim() || "My Strategy",
      source,
      summary: extracted.summary,
      rules: extracted.rules,
      methodologyTags: extracted.methodologyTags ?? [],
      marketTags: extracted.marketTags ?? [],
      difficulty: (extracted.difficulty as SavedStrategy["difficulty"]) ?? "intermediate",
      created_at: new Date().toISOString(),
    };
    addStrat(s);
    setExtracted(null);
    setCustomText("");
    setCustomUrl("");
    setUploadedFiles([]);
    setTab("saved");
  }

  // ── Tab buttons ────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string; icon: typeof BookOpen }[] = [
    { key: "curated", label: "Top Strategies", icon: Sparkles },
    { key: "search", label: "Search", icon: Globe },
    { key: "custom", label: "My Own", icon: Wrench },
    { key: "saved", label: `Saved (${strategies.length})`, icon: BookOpen },
    { key: "playbooks", label: "Playbooks", icon: BookOpen },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg glass px-1.5 py-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors", tab === key ? "bg-[#0EA5E9]/15 text-[#0EA5E9]" : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground")}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Active strategy banner */}
      {activeId && (() => {
        const a = strategies.find((s) => s.id === activeId);
        if (!a) return null;
        return (
          <div className="flex items-center gap-2 rounded-lg bg-[#0EA5E9]/5 border border-[#0EA5E9]/15 px-3 py-2">
            <Check className="h-3.5 w-3.5 text-[#0EA5E9] shrink-0" />
            <span className="text-xs text-foreground"><span className="font-semibold">Active:</span> {a.name}</span>
          </div>
        );
      })()}

      {/* ═══════════ CURATED TAB ═══════════ */}
      {tab === "curated" && (
        <div className="space-y-2">
          {CURATED_STRATEGIES.map((c) => {
            const isExpanded = expandedCurated === c.name;
            return (
              <div key={c.name} className="glass rounded-xl overflow-hidden">
                <button onClick={() => setExpandedCurated(isExpanded ? null : c.name)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">{c.name}</span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground">{c.category}</span>
                      <DiffBadge d={c.difficulty} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{c.summary}</p>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", isExpanded && "rotate-180")} />
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 space-y-2 border-t border-white/[0.04] pt-2">
                    <p className="text-xs text-foreground leading-relaxed">{c.summary}</p>
                    <div className="flex flex-wrap gap-1">
                      {c.marketFit.map((m) => <span key={m} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground capitalize">{m}</span>)}
                    </div>
                    <ul className="space-y-1">
                      {c.rules.map((r, i) => <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5"><span className="text-foreground shrink-0">{i + 1}.</span>{r}</li>)}
                    </ul>
                    <div className="flex items-center gap-2">
                      <button onClick={() => useCurated(c)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0EA5E9]/15 px-3 py-1.5 text-xs font-semibold text-[#0EA5E9] hover:bg-[#0EA5E9]/25">
                        <Plus className="h-3.5 w-3.5" /> Use this strategy
                      </button>
                      {c.backtest_dsl ? (
                        <button
                          onClick={() => {
                            sessionStorage.setItem("tf:backtest-prefill", JSON.stringify(c.backtest_dsl));
                            router.push("/backtesting");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B5CF6]/15 px-3 py-1.5 text-xs font-semibold text-[#8B5CF6] hover:bg-[#8B5CF6]/25"
                        >
                          <FlaskConical className="h-3.5 w-3.5" /> Backtest
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const text = `${c.name} on ${c.marketFit[0] ?? "forex"}. ${c.rules.join(". ")}`;
                            sessionStorage.setItem("tf:backtest-ai-parse", text);
                            router.push("/backtesting");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B5CF6]/10 px-3 py-1.5 text-xs font-semibold text-[#8B5CF6]/70 hover:bg-[#8B5CF6]/20 hover:text-[#8B5CF6]"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Backtest with AI
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════ SEARCH TAB ═══════════ */}
      {tab === "search" && (
        <div className="space-y-3">
          <div className="flex gap-1.5">
            <div className="flex-1 flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Search strategies on the internet..." className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
            </div>
            <button onClick={handleSearch} disabled={searching || !searchQuery.trim()} className="rounded-lg bg-[#0EA5E9]/15 px-4 py-2 text-xs font-semibold text-[#0EA5E9] hover:bg-[#0EA5E9]/25 disabled:opacity-40">
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
            </button>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-1">
            {FILTER_CHIPS.map((f) => (
              <button key={f} onClick={() => setSearchFilters((p) => p.includes(f) ? p.filter((x) => x !== f) : [...p, f])} className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize transition-colors", searchFilters.includes(f) ? "bg-[#8B5CF6]/15 text-[#8B5CF6]" : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]")}>
                {f}
              </button>
            ))}
          </div>

          {/* Results */}
          {searching && (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="h-5 w-5 text-[#0EA5E9] animate-spin" />
              <span className="text-xs text-muted-foreground">Searching strategies...</span>
            </div>
          )}
          {!searching && searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((r, i) => (
                <div key={i} className="glass rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">{r.title}</span>
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground">{r.methodology}</span>
                    <DiffBadge d={r.difficulty} />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{r.summary}</p>
                  {r.rules.length > 0 && (
                    <ul className="space-y-0.5">
                      {r.rules.slice(0, 4).map((rule, j) => <li key={j} className="text-[10px] text-muted-foreground">· {rule}</li>)}
                      {r.rules.length > 4 && <li className="text-[10px] text-muted-foreground/50">+{r.rules.length - 4} more rules</li>}
                    </ul>
                  )}
                  <button onClick={() => useSearchResult(r)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0EA5E9]/15 px-3 py-1.5 text-xs font-semibold text-[#0EA5E9] hover:bg-[#0EA5E9]/25">
                    <Plus className="h-3.5 w-3.5" /> Save & Use
                  </button>
                </div>
              ))}
            </div>
          )}
          {!searching && searchResults.length === 0 && searchQuery && (
            <p className="text-xs text-muted-foreground text-center py-6">No results yet. Try searching above.</p>
          )}
        </div>
      )}

      {/* ═══════════ CUSTOM TAB ═══════════ */}
      {tab === "custom" && !extracted && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-foreground">Import Your Own Strategy</p>
          <p className="text-[11px] text-muted-foreground">Upload files, paste a URL, or type your strategy. AI will extract and structure it.</p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn("rounded-lg border-2 border-dashed px-4 py-4 text-center cursor-pointer transition-colors", dragOver ? "border-[#0EA5E9]/50 bg-[#0EA5E9]/5" : "border-white/[0.08] hover:border-white/[0.15]")}
          >
            <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1.5" />
            <p className="text-xs text-muted-foreground">Drop files here or click to upload</p>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">PDF, JPEG, PNG — multiple files allowed</p>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
          </div>
          {uploadedFiles.length > 0 && (
            <div className="space-y-1">
              {uploadedFiles.map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded bg-white/[0.04] px-2 py-1 text-[10px] text-foreground">
                  <div className="flex items-center gap-1.5 truncate"><FileText className="h-3 w-3 text-muted-foreground shrink-0" />{f.name}</div>
                  <button onClick={() => setUploadedFiles((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}

          {/* URL */}
          <div className="flex gap-1.5">
            <div className="flex-1 flex items-center gap-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] px-2 py-1.5">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="Paste URL..." className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none" />
            </div>
          </div>

          {/* Text */}
          <textarea value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="e.g. I trade SMC concepts, I look for BOS and CHoCH, I enter on order blocks..." rows={4} className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#0EA5E9]/40 resize-none" />

          <button onClick={handleExtract} disabled={extracting || (!customText.trim() && !customUrl.trim() && uploadedFiles.length === 0)} className="w-full rounded-lg bg-[#8B5CF6]/15 px-4 py-2.5 text-xs font-semibold text-[#8B5CF6] hover:bg-[#8B5CF6]/25 disabled:opacity-40 flex items-center justify-center gap-2">
            {extracting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Extracting...</> : <><Sparkles className="h-3.5 w-3.5" /> Extract Strategy</>}
          </button>
        </div>
      )}

      {/* ═══════════ EXTRACTION CONFIRMATION ═══════════ */}
      {tab === "custom" && extracted && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-foreground">Strategy Extracted</p>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Name</p>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full rounded bg-white/[0.06] border border-white/[0.08] px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-[#0EA5E9]/40" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Summary</p>
            <p className="text-xs text-foreground leading-relaxed bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.06]">{extracted.summary}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Rules ({extracted.rules.length})</p>
            <ul className="space-y-1">
              {extracted.rules.map((r, i) => <li key={i} className="flex gap-2 text-[11px] text-foreground"><span className="text-muted-foreground shrink-0">{i + 1}.</span>{r}</li>)}
            </ul>
          </div>
          <div className="flex flex-wrap gap-1">
            {extracted.methodologyTags?.map((t) => <span key={t} className="rounded bg-[#8B5CF6]/15 px-2 py-0.5 text-[10px] text-[#8B5CF6]">{t}</span>)}
            {extracted.marketTags?.map((t) => <span key={t} className="rounded bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted-foreground capitalize">{t}</span>)}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setExtracted(null)} className="flex-1 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-muted-foreground hover:bg-white/[0.06]">Back</button>
            <button onClick={confirmExtracted} className="flex-1 rounded-lg bg-[#0EA5E9]/15 px-3 py-2 text-xs font-semibold text-[#0EA5E9] hover:bg-[#0EA5E9]/25 flex items-center justify-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Save & Activate
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ SAVED TAB ═══════════ */}
      {tab === "saved" && (
        <div className="space-y-2">
          {strategies.length === 0 && (
            <div className="text-center py-8">
              <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No strategies saved yet</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Browse curated strategies or import your own</p>
            </div>
          )}
          {strategies.map((s) => (
            <div key={s.id} className={cn("glass rounded-xl px-4 py-3 space-y-2", s.id === activeId && "ring-1 ring-[#0EA5E9]/30")}>
              <div className="flex items-center gap-2">
                <SourceIcon source={s.source} />
                {editingId === s.id ? (
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") renameStrat(s.id, editName); }} onBlur={() => renameStrat(s.id, editName)} autoFocus className="flex-1 bg-transparent text-xs text-foreground border-b border-[#0EA5E9]/40 focus:outline-none" />
                ) : (
                  <span className="flex-1 text-xs font-bold text-foreground truncate">{s.name}</span>
                )}
                <span className="text-[10px] text-muted-foreground shrink-0">{new Date(s.created_at).toLocaleDateString()}</span>
              </div>

              {viewingId === s.id && (
                <div className="space-y-1.5 pt-1 border-t border-white/[0.04]">
                  <p className="text-[11px] text-foreground leading-relaxed">{s.summary}</p>
                  <ul className="space-y-0.5">
                    {s.rules.map((r, i) => <li key={i} className="text-[10px] text-muted-foreground">· {r}</li>)}
                  </ul>
                  <div className="flex flex-wrap gap-1">
                    {s.methodologyTags.map((t) => <span key={t} className="rounded bg-[#8B5CF6]/15 px-1.5 py-0.5 text-[9px] text-[#8B5CF6]">{t}</span>)}
                    {s.marketTags.map((t) => <span key={t} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-muted-foreground capitalize">{t}</span>)}
                  </div>
                  <StrategyVisuals strategyId={s.id} />
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <button onClick={() => { setActive(s.id); }} className={cn("rounded px-2 py-0.5 text-[10px] font-medium", s.id === activeId ? "bg-[#0EA5E9]/15 text-[#0EA5E9]" : "bg-white/[0.06] text-muted-foreground hover:text-foreground")}>
                  {s.id === activeId ? "Active" : "Select"}
                </button>
                <button onClick={() => setViewingId(viewingId === s.id ? null : s.id)} className="rounded px-2 py-0.5 text-[10px] text-muted-foreground bg-white/[0.04] hover:bg-white/[0.08]">
                  <Eye className="h-3 w-3 inline mr-0.5" />{viewingId === s.id ? "Hide" : "View"}
                </button>
                <button onClick={() => { setEditingId(s.id); setEditName(s.name); }} className="rounded p-0.5 text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                {deleteConfirm === s.id ? (
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-[10px] text-red-400">Delete?</span>
                    <button onClick={() => removeStrat(s.id)} className="text-[10px] text-red-400 font-bold hover:underline">Yes</button>
                    <button onClick={() => setDeleteConfirm(null)} className="text-[10px] text-muted-foreground hover:underline">No</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(s.id)} className="rounded p-0.5 text-muted-foreground hover:text-red-400 ml-auto"><Trash2 className="h-3 w-3" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "playbooks" && <PlaybookTab />}
    </div>
  );
}

// ── Source icon ───────────────────────────────────────────────────────────────

function SourceIcon({ source }: { source: SavedStrategy["source"] }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  switch (source) {
    case "preset": return <Sparkles className={cn(cls, "text-[#0EA5E9]")} />;
    case "search": return <Globe className={cn(cls, "text-[#8B5CF6]")} />;
    case "url": return <Link2 className={cn(cls, "text-muted-foreground")} />;
    default: return <FileText className={cn(cls, "text-muted-foreground")} />;
  }
}
