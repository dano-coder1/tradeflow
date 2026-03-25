"use client";

import { useEffect } from "react";
import { getAlerts } from "@/lib/alert-store";

const POLL_INTERVAL_MS = 30_000;
const FIRED_KEY = "tf_price_alerts_fired";

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
    if (!res.ok) {
      console.warn("[monitor] price fetch failed for", symbol, res.status);
      return null;
    }
    const json = await res.json();
    const price = typeof json.price === "number" ? json.price : null;
    console.log("[monitor]", symbol, "=", price);
    return price;
  } catch (e) {
    console.warn("[monitor] price fetch error for", symbol, e);
    return null;
  }
}

function fireNotification(symbol: string, price: number, level: number) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  console.log("[monitor] FIRING notification:", symbol, "price", price, "near level", level);
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
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    let active = true;
    let intervals: ReturnType<typeof setInterval>[] = [];

    function startPolling() {
      intervals.forEach(clearInterval);
      intervals = [];

      const alerts = getAlerts();
      console.log("[monitor] active alerts:", alerts.length);
      if (alerts.length === 0) return;

      const bySymbol = new Map<string, number[]>();
      for (const al of alerts) {
        const existing = bySymbol.get(al.symbol) ?? [];
        bySymbol.set(al.symbol, [...new Set([...existing, al.level])]);
      }

      for (const [symbol, levels] of bySymbol) {
        console.log("[monitor] polling", symbol, "for levels:", levels);

        const id = setInterval(async () => {
          if (!active) return;

          const price = await fetchPrice(symbol);
          if (price == null) return;

          const fired = getFired();
          for (const level of levels) {
            if (!isNearLevel(price, level)) continue;
            const key = `${symbol}_${level}`;
            if (fired.has(key)) continue;
            console.log("[monitor] NEAR LEVEL:", symbol, "price", price, "level", level);
            markFired(key);
            fireNotification(symbol, price, level);
          }
        }, POLL_INTERVAL_MS);

        intervals.push(id);
      }
    }

    startPolling();

    function handleAlertsChanged() {
      startPolling();
    }
    window.addEventListener("tf:alerts-changed", handleAlertsChanged);

    return () => {
      active = false;
      intervals.forEach(clearInterval);
      window.removeEventListener("tf:alerts-changed", handleAlertsChanged);
    };
  }, []);

  return null;
}
