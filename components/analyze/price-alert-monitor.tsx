"use client";

import { useEffect } from "react";
import type { AlertLevel } from "@/app/api/analyses/alert-levels/route";

const FIRED_KEY = "tf_price_alerts_fired";
const POLL_INTERVAL_MS = 30_000;

function getFired(): Set<string> {
  try {
    const raw = sessionStorage.getItem(FIRED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markFired(key: string) {
  const set = getFired();
  set.add(key);
  try {
    sessionStorage.setItem(FIRED_KEY, JSON.stringify([...set]));
  } catch {}
}

function isNearLevel(price: number, level: number): boolean {
  return Math.abs(price - level) / level <= 0.005;
}

async function fetchPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/prices/${symbol}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json.price === "number" ? json.price : null;
  } catch {
    return null;
  }
}

function fireNotification(symbol: string, price: number, level: number) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(`${symbol} approaching your analysis level: ${level.toFixed(2)}`, {
      body: `Live price ${price.toFixed(2)} is within 0.5% of a saved key level.`,
      icon: "/favicon.ico",
      tag: `${symbol}_${level}`,
    });
  } catch {}
}

export function PriceAlertMonitor() {
  useEffect(() => {
    // Request notification permission on first use
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    let active = true;
    const intervals: ReturnType<typeof setInterval>[] = [];

    async function init() {
      try {
        const res = await fetch("/api/analyses/alert-levels", { cache: "no-store" });
        if (!res.ok || !active) return;
        const alertLevels: AlertLevel[] = await res.json();
        if (!Array.isArray(alertLevels) || alertLevels.length === 0) return;

        // Deduplicate: symbol → unique levels across all analyses
        const bySymbol = new Map<string, number[]>();
        for (const al of alertLevels) {
          const existing = bySymbol.get(al.symbol) ?? [];
          const merged = [...new Set([...existing, ...al.levels])];
          bySymbol.set(al.symbol, merged);
        }

        for (const [symbol, levels] of bySymbol) {
          const id = setInterval(async () => {
            if (!active) return;
            if (typeof window === "undefined") return;
            if (!("Notification" in window)) return;
            if (Notification.permission !== "granted") return;

            const price = await fetchPrice(symbol);
            if (price == null) return;

            const fired = getFired();
            for (const level of levels) {
              if (!isNearLevel(price, level)) continue;
              const key = `${symbol}_${level}`;
              if (fired.has(key)) continue;
              markFired(key);
              fireNotification(symbol, price, level);
            }
          }, POLL_INTERVAL_MS);

          intervals.push(id);
        }
      } catch {
        // Best-effort — never crash the layout
      }
    }

    init();

    return () => {
      active = false;
      intervals.forEach(clearInterval);
    };
  }, []);

  return null;
}
