"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { SmcResult } from "@/lib/smc-engine";
import type { Time } from "lightweight-charts";
import type { SmcSettings } from "./ChartToolbar";

interface SmcOverlayProps {
  smcData: SmcResult | null;
  settings: SmcSettings;
  times: Time[];
  timeToCoord: (time: Time) => number | null;
  priceToCoord: (price: number) => number | null;
}

export function SmcOverlay({ smcData, settings, times, timeToCoord, priceToCoord }: SmcOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Use useLayoutEffect to set initial size BEFORE paint, then ResizeObserver
  // for dynamic updates. This prevents the first-frame w=0 rendering bug.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const el = svg?.parentElement;
    if (!el) return;
    // Synchronous initial measurement
    setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!smcData) return null;

  const anyVisible = settings.showBosChoch || settings.showOrderBlocks || settings.showFvg
    || settings.showPremiumDiscount || settings.showPdhl || settings.showPwhl || settings.showPmhl;
  if (!anyVisible) return null;

  const { structures, orderBlocks, fvgs, previousLevels, premiumDiscount } = smcData;
  // Fallback: read width from DOM if ResizeObserver hasn't fired yet
  const w = size.w || svgRef.current?.parentElement?.clientWidth || 0;

  function tx(index: number): number | null {
    if (index < 0 || index >= times.length) return null;
    return timeToCoord(times[index]);
  }

  function py(price: number): number | null {
    return priceToCoord(price);
  }

  // Limit counts
  const visibleObs = settings.showOrderBlocks ? orderBlocks.slice(-settings.maxOrderBlocks) : [];
  const visibleFvgs = settings.showFvg ? fvgs.slice(-settings.maxFvgs) : [];
  const visibleStructures = settings.showBosChoch ? structures : [];

  // Previous level definitions
  const levelLines: { price: number; label: string; color: string; dash: string }[] = [];
  if (settings.showPdhl) {
    if (previousLevels.pdh != null) levelLines.push({ price: previousLevels.pdh, label: "PDH", color: "#eab308", dash: "6 3" });
    if (previousLevels.pdl != null) levelLines.push({ price: previousLevels.pdl, label: "PDL", color: "#eab308", dash: "6 3" });
  }
  if (settings.showPwhl) {
    if (previousLevels.pwh != null) levelLines.push({ price: previousLevels.pwh, label: "PWH", color: "#06b6d4", dash: "8 4" });
    if (previousLevels.pwl != null) levelLines.push({ price: previousLevels.pwl, label: "PWL", color: "#06b6d4", dash: "8 4" });
  }
  if (settings.showPmhl) {
    if (previousLevels.pmh != null) levelLines.push({ price: previousLevels.pmh, label: "PMH", color: "#a855f7", dash: "10 4" });
    if (previousLevels.pml != null) levelLines.push({ price: previousLevels.pml, label: "PML", color: "#a855f7", dash: "10 4" });
  }

  // Debug: log level line rendering state
  if (settings.showPdhl || settings.showPwhl || settings.showPmhl) {
    console.log("[SMC Overlay] level lines →", {
      w,
      levelLines: levelLines.map((l) => ({
        label: l.label,
        price: l.price,
        y: py(l.price),
      })),
      previousLevels,
    });
  }

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none", zIndex: 4 }}
    >
      {/* ── Premium / Discount zones ─────────────────────────────────── */}
      {settings.showPremiumDiscount && premiumDiscount && (() => {
        const yHigh = py(premiumDiscount.high);
        const yEq = py(premiumDiscount.eq);
        const yLow = py(premiumDiscount.low);
        if (yHigh === null || yEq === null || yLow === null) return null;
        const topY = Math.min(yHigh, yEq);
        const midY = Math.min(yEq, yLow);
        const op = settings.zoneOpacity;
        return (
          <g>
            <rect x={0} y={topY} width={w} height={Math.abs(yEq - yHigh)} fill={`rgba(248, 113, 113, ${op})`} />
            <rect x={0} y={midY} width={w} height={Math.abs(yLow - yEq)} fill={`rgba(52, 211, 153, ${op})`} />
            <line x1={0} y1={yEq} x2={w} y2={yEq} stroke="rgba(255,255,255,0.25)" strokeWidth={1} strokeDasharray="4 4" />
            <text x={w - 60} y={topY + 12} fill="rgba(248, 113, 113, 0.6)" fontSize={8} fontFamily="monospace" fontWeight="bold">Premium</text>
            <text x={w - 70} y={yEq + 4} fill="rgba(255,255,255,0.35)" fontSize={8} fontFamily="monospace">Equilibrium</text>
            <text x={w - 60} y={Math.max(yEq, yLow) - 4} fill="rgba(52, 211, 153, 0.6)" fontSize={8} fontFamily="monospace" fontWeight="bold">Discount</text>
          </g>
        );
      })()}

      {/* ── Previous period levels ────────────────────────────────────── */}
      {levelLines.map((lv, i) => {
        const y = py(lv.price);
        if (y === null || w <= 0) return null;
        return (
          <g key={`level-${i}`}>
            <line x1={0} y1={y} x2={w} y2={y} stroke={lv.color} strokeWidth={1} strokeDasharray={lv.dash} opacity={0.5} />
            <rect x={w - 38} y={y - 7} width={36} height={14} rx={2} fill="rgba(0,0,0,0.5)" />
            <text x={w - 34} y={y + 3} fill={lv.color} fontSize={9} fontWeight="bold" fontFamily="monospace" opacity={0.8}>{lv.label}</text>
          </g>
        );
      })}

      {/* ── Fair Value Gaps ──────────────────────────────────────────── */}
      {visibleFvgs.map((fvg, i) => {
        const x1 = tx(fvg.index - 1);
        const x2 = tx(fvg.index + 1);
        const yTop = py(fvg.high);
        const yBot = py(fvg.low);
        if (x1 === null || x2 === null || yTop === null || yBot === null) return null;
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(yTop, yBot);
        const h = Math.abs(yBot - yTop);
        const op = settings.fvgOpacity;
        const fill = fvg.direction === "bullish"
          ? `rgba(52, 211, 153, ${op})`
          : `rgba(248, 113, 113, ${op})`;
        const stroke = fvg.direction === "bullish"
          ? `rgba(52, 211, 153, ${Math.min(op + 0.18, 1)})`
          : `rgba(248, 113, 113, ${Math.min(op + 0.18, 1)})`;
        return (
          <rect
            key={`fvg-${i}`}
            x={minX}
            y={minY}
            width={Math.max(maxX - minX, 4)}
            height={Math.max(h, 1)}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.5}
          />
        );
      })}

      {/* ── Order Blocks ────────────────────────────────────────────── */}
      {visibleObs.map((ob, i) => {
        const x1 = tx(ob.index);
        const x2 = tx(ob.endIndex);
        const yTop = py(ob.high);
        const yBot = py(ob.low);
        if (x1 === null || x2 === null || yTop === null || yBot === null) return null;
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(yTop, yBot);
        const h = Math.abs(yBot - yTop);
        const op = settings.obOpacity;
        const fill = ob.direction === "bullish"
          ? `rgba(59, 130, 246, ${op})`
          : `rgba(248, 113, 113, ${op})`;
        const stroke = ob.direction === "bullish"
          ? `rgba(59, 130, 246, ${Math.min(op + 0.25, 1)})`
          : `rgba(248, 113, 113, ${Math.min(op + 0.25, 1)})`;
        return (
          <g key={`ob-${i}`}>
            <rect
              x={minX}
              y={minY}
              width={Math.max(maxX - minX, 8)}
              height={Math.max(h, 2)}
              fill={fill}
              stroke={stroke}
              strokeWidth={0.5}
            />
            <text
              x={minX + 3}
              y={minY + 11}
              fill={ob.direction === "bullish" ? "#3b82f6" : "#f87171"}
              fontSize={9}
              fontWeight="bold"
              fontFamily="monospace"
              opacity={0.7}
            >
              OB
            </text>
          </g>
        );
      })}

      {/* ── BOS / CHoCH lines ───────────────────────────────────────── */}
      {visibleStructures.map((brk, i) => {
        const x1 = tx(brk.fromIndex);
        const x2 = tx(brk.toIndex);
        const y = py(brk.price);
        if (x1 === null || x2 === null || y === null) return null;
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const color = brk.direction === "bullish" ? "#34d399" : "#f87171";
        const dash = brk.type === "bos" ? "4 3" : "6 2";
        const labelX = minX + (maxX - minX) / 2;
        const label = brk.type === "bos" ? "BOS" : "CHoCH";
        return (
          <g key={`struct-${i}`}>
            <line
              x1={minX} y1={y} x2={maxX} y2={y}
              stroke={color} strokeWidth={1} strokeDasharray={dash} opacity={0.7}
            />
            <text
              x={labelX} y={y - 4}
              fill={color} fontSize={9} fontWeight="bold" fontFamily="monospace" textAnchor="middle" opacity={0.8}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
