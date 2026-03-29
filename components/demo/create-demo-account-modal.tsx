"use client";

import { useState } from "react";
import { X, Wallet } from "lucide-react";
import { ModalOverlay } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DemoAccount } from "@/types/demo";

const BALANCE_OPTIONS = [
  { label: "$10,000", value: 10000 },
  { label: "$25,000", value: 25000 },
  { label: "$50,000", value: 50000 },
  { label: "$100,000", value: 100000 },
];

interface Props {
  onClose: () => void;
  onCreated: (account: DemoAccount) => void;
}

export function CreateDemoAccountModal({ onClose, onCreated }: Props) {
  const [selected, setSelected] = useState(10000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/demo/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ balance: selected, name: "Demo Account", currency: "USD" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create account");
      onCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="demo-account-title"
        className="glass-strong relative w-full max-w-sm rounded-2xl shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#8B5CF6]" />
            <h3 id="demo-account-title" className="text-sm font-bold text-foreground">Create Demo Account</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Starting Balance</p>
            <div className="grid grid-cols-2 gap-2">
              {BALANCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelected(opt.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all",
                    selected === opt.value
                      ? "border-[#8B5CF6]/50 bg-[#8B5CF6]/10 text-[#8B5CF6]"
                      : "border-white/[0.08] bg-white/[0.03] text-foreground hover:bg-white/[0.06]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-xs text-muted-foreground">
            Paper trading uses simulated funds. No real money is involved.
          </div>

          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3">
          <button onClick={onClose} className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/[0.06]">
            Cancel
          </button>
          <Button size="sm" loading={loading} onClick={handleCreate}>
            Create Account
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}
