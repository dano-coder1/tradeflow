"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { DrawingTool } from "./ChartToolbar";

export interface Drawing {
  type: "line" | "zone";
  y: number;          // percentage from top (0–1)
  y2?: number;        // for zones
  color: string;
}

interface ChartDrawingOverlayProps {
  activeTool: DrawingTool;
  drawings: Drawing[];
  onAddDrawing: (d: Drawing) => void;
}

const LINE_COLOR = "#F5A623";
const ZONE_COLOR = "rgba(59, 130, 246, 0.15)";
const ZONE_BORDER = "#3B82F6";

export function ChartDrawingOverlay({ activeTool, drawings, onAddDrawing }: ChartDrawingOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragCurrent, setDragCurrent] = useState<number | null>(null);
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

  const getY = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || rect.height === 0) return 0;
      return (e.clientY - rect.top) / rect.height;
    },
    []
  );

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (!activeTool) return;
    const y = getY(e);

    if (activeTool === "line") {
      onAddDrawing({ type: "line", y, color: LINE_COLOR });
      return;
    }

    if (activeTool === "zone") {
      setDragStart(y);
      setDragCurrent(y);
    }
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (activeTool !== "zone" || dragStart === null) return;
    setDragCurrent(getY(e));
  }

  function handleMouseUp() {
    if (activeTool === "zone" && dragStart !== null && dragCurrent !== null) {
      const top = Math.min(dragStart, dragCurrent);
      const bottom = Math.max(dragStart, dragCurrent);
      if (Math.abs(bottom - top) > 0.005) {
        onAddDrawing({ type: "zone", y: top, y2: bottom, color: ZONE_COLOR });
      }
    }
    setDragStart(null);
    setDragCurrent(null);
  }

  const h = size.h;
  const w = size.w;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full"
      style={{
        pointerEvents: activeTool ? "auto" : "none",
        cursor: activeTool === "line" ? "crosshair" : activeTool === "zone" ? "crosshair" : "default",
        zIndex: activeTool ? 20 : 5,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Saved drawings */}
      {drawings.map((d, i) => {
        if (d.type === "line") {
          const py = d.y * h;
          return (
            <line
              key={i}
              x1={0}
              y1={py}
              x2={w}
              y2={py}
              stroke={d.color}
              strokeWidth={1.5}
              strokeDasharray="6 3"
            />
          );
        }
        if (d.type === "zone" && d.y2 !== undefined) {
          const top = d.y * h;
          const bottom = d.y2 * h;
          return (
            <g key={i}>
              <rect x={0} y={top} width={w} height={bottom - top} fill={d.color} />
              <line x1={0} y1={top} x2={w} y2={top} stroke={ZONE_BORDER} strokeWidth={0.5} />
              <line x1={0} y1={bottom} x2={w} y2={bottom} stroke={ZONE_BORDER} strokeWidth={0.5} />
            </g>
          );
        }
        return null;
      })}

      {/* Active drag preview */}
      {activeTool === "zone" && dragStart !== null && dragCurrent !== null && (
        <rect
          x={0}
          y={Math.min(dragStart, dragCurrent) * h}
          width={w}
          height={Math.abs(dragCurrent - dragStart) * h}
          fill={ZONE_COLOR}
          stroke={ZONE_BORDER}
          strokeWidth={0.5}
        />
      )}
    </svg>
  );
}
