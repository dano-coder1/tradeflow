"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { DrawingTool } from "./ChartToolbar";

// Drawings store actual price values, not pixel/percentage coordinates
export interface Drawing {
  type: "line" | "zone";
  price: number;
  price2?: number;   // for zones (second price boundary)
  color: string;
}

interface ChartDrawingOverlayProps {
  activeTool: DrawingTool;
  drawings: Drawing[];
  onAddDrawing: (d: Drawing) => void;
  /** Convert a pixel Y coordinate (relative to container) to a chart price */
  coordToPrice: (y: number) => number | null;
  /** Convert a chart price to a pixel Y coordinate (relative to container) */
  priceToCoord: (price: number) => number | null;
}

const LINE_COLOR = "#F5A623";
const ZONE_COLOR = "rgba(59, 130, 246, 0.15)";
const ZONE_BORDER = "#3B82F6";

export function ChartDrawingOverlay({
  activeTool,
  drawings,
  onAddDrawing,
  coordToPrice,
  priceToCoord,
}: ChartDrawingOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragCurrentY, setDragCurrentY] = useState<number | null>(null);
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

  const getLocalY = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return e.clientY - rect.top;
  }, []);

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (!activeTool) return;
    const localY = getLocalY(e);

    if (activeTool === "line") {
      const price = coordToPrice(localY);
      if (price !== null) {
        onAddDrawing({ type: "line", price, color: LINE_COLOR });
      }
      return;
    }

    if (activeTool === "zone") {
      setDragStartY(localY);
      setDragCurrentY(localY);
    }
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (activeTool !== "zone" || dragStartY === null) return;
    setDragCurrentY(getLocalY(e));
  }

  function handleMouseUp() {
    if (activeTool === "zone" && dragStartY !== null && dragCurrentY !== null) {
      if (Math.abs(dragCurrentY - dragStartY) > 4) {
        const p1 = coordToPrice(dragStartY);
        const p2 = coordToPrice(dragCurrentY);
        if (p1 !== null && p2 !== null) {
          const top = Math.max(p1, p2);
          const bottom = Math.min(p1, p2);
          onAddDrawing({ type: "zone", price: top, price2: bottom, color: ZONE_COLOR });
        }
      }
    }
    setDragStartY(null);
    setDragCurrentY(null);
  }

  const w = size.w;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full"
      style={{
        pointerEvents: activeTool ? "auto" : "none",
        cursor: activeTool ? "crosshair" : "default",
        zIndex: activeTool ? 20 : 5,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Rendered drawings */}
      {drawings.map((d, i) => {
        if (d.type === "line") {
          const py = priceToCoord(d.price);
          if (py === null) return null;
          return (
            <line
              key={i}
              x1={0} y1={py} x2={w} y2={py}
              stroke={d.color}
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
          );
        }
        if (d.type === "zone" && d.price2 !== undefined) {
          const topY = priceToCoord(d.price);
          const bottomY = priceToCoord(d.price2);
          if (topY === null || bottomY === null) return null;
          const minY = Math.min(topY, bottomY);
          const maxY = Math.max(topY, bottomY);
          return (
            <g key={i}>
              <rect x={0} y={minY} width={w} height={maxY - minY} fill={d.color} />
              <line x1={0} y1={minY} x2={w} y2={minY} stroke={ZONE_BORDER} strokeWidth={0.5} />
              <line x1={0} y1={maxY} x2={w} y2={maxY} stroke={ZONE_BORDER} strokeWidth={0.5} />
            </g>
          );
        }
        return null;
      })}

      {/* Active zone drag preview */}
      {activeTool === "zone" && dragStartY !== null && dragCurrentY !== null && (
        <rect
          x={0}
          y={Math.min(dragStartY, dragCurrentY)}
          width={w}
          height={Math.abs(dragCurrentY - dragStartY)}
          fill={ZONE_COLOR}
          stroke={ZONE_BORDER}
          strokeWidth={0.5}
        />
      )}
    </svg>
  );
}
