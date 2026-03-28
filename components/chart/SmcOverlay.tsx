"use client";

import { useEffect, useRef, useState } from "react";
import type { SmcResult } from "@/lib/smc-engine";
import type { Time } from "lightweight-charts";

interface SmcOverlayProps {
  smcData: SmcResult | null;
  visible: boolean;
  /** Map candle index → Time value for X coordinate conversion */
  times: Time[];
  /** Convert a chart Time to a pixel X coordinate */
  timeToCoord: (time: Time) => number | null;
  /** Convert a price to a pixel Y coordinate */
  priceToCoord: (price: number) => number | null;
}

export function SmcOverlay({ smcData, visible, times, timeToCoord, priceToCoord }: SmcOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!visible || !smcData) return null;

  const { structures, orderBlocks, fvgs } = smcData;

  // Helpers
  function tx(index: number): number | null {
    if (index < 0 || index >= times.length) return null;
    return timeToCoord(times[index]);
  }

  function py(price: number): number | null {
    return priceToCoord(price);
  }

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none", zIndex: 4 }}
    >
      {/* ── Fair Value Gaps ──────────────────────────────────────────── */}
      {fvgs.map((fvg, i) => {
        const x1 = tx(fvg.index - 1);
        const x2 = tx(fvg.index + 1);
        const yTop = py(fvg.high);
        const yBot = py(fvg.low);
        if (x1 === null || x2 === null || yTop === null || yBot === null) return null;
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(yTop, yBot);
        const h = Math.abs(yBot - yTop);
        const fill = fvg.direction === "bullish"
          ? "rgba(52, 211, 153, 0.12)"
          : "rgba(248, 113, 113, 0.12)";
        const stroke = fvg.direction === "bullish"
          ? "rgba(52, 211, 153, 0.3)"
          : "rgba(248, 113, 113, 0.3)";
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
      {orderBlocks.map((ob, i) => {
        const x1 = tx(ob.index);
        const x2 = tx(ob.endIndex);
        const yTop = py(ob.high);
        const yBot = py(ob.low);
        if (x1 === null || x2 === null || yTop === null || yBot === null) return null;
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(yTop, yBot);
        const h = Math.abs(yBot - yTop);
        const fill = ob.direction === "bullish"
          ? "rgba(59, 130, 246, 0.10)"
          : "rgba(248, 113, 113, 0.10)";
        const stroke = ob.direction === "bullish"
          ? "rgba(59, 130, 246, 0.35)"
          : "rgba(248, 113, 113, 0.35)";
        const label = ob.direction === "bullish" ? "OB" : "OB";
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
              {label}
            </text>
          </g>
        );
      })}

      {/* ── BOS / CHoCH lines ───────────────────────────────────────── */}
      {structures.map((brk, i) => {
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
              x1={minX}
              y1={y}
              x2={maxX}
              y2={y}
              stroke={color}
              strokeWidth={1}
              strokeDasharray={dash}
              opacity={0.7}
            />
            <text
              x={labelX}
              y={y - 4}
              fill={color}
              fontSize={9}
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
              opacity={0.8}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
