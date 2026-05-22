import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import type { Stroke, StrokePoint, ToolType } from "../types/game";
import { createId } from "../utils/ids";
import { drawStrokes } from "../canvas/draw";
import { useGame } from "../hooks/useGame";

interface CanvasBoardProps {
  tool: ToolType;
  color: string;
  size: number;
  canDraw: boolean;
}

interface CanvasSize {
  width: number;
  height: number;
}

export const CanvasBoard = ({ tool, color, size, canDraw }: CanvasBoardProps) => {
  const {
    strokes,
    activeStrokes,
    sendDrawStart,
    sendDrawMove,
    sendDrawEnd,
    sendFillArea
  } = useGame();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const strokeIdRef = useRef<string | null>(null);
  const lastFillRef = useRef<{
    x: number;
    y: number;
    color: string;
    time: number;
  } | null>(null);

  const [canvasSize, setCanvasSize] = useState<CanvasSize>({
    width: 0,
    height: 0
  });

  const allStrokes = useMemo(
    () => [...strokes, ...activeStrokes],
    [strokes, activeStrokes]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const element = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setCanvasSize({
        width: Math.floor(width),
        height: Math.floor(height)
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvasSize;
    if (!width || !height) return;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    console.log("[CANVAS_RENDER]", {
      strokes: allStrokes.length,
      width,
      height
    });
    drawStrokes(ctx, allStrokes, width, height);
  }, [canvasSize, allStrokes]);

  const clampPoint = (value: number) => Math.min(1, Math.max(0, value));

  const toStrokePoint = (
    event: globalThis.PointerEvent
  ): StrokePoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = clampPoint((event.clientX - rect.left) / rect.width);
    const y = clampPoint((event.clientY - rect.top) / rect.height);
    return { x, y, t: Date.now() };
  };

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (!canDraw) return;
    const point = toStrokePoint(event.nativeEvent);
    if (!point) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;

    if (tool === "fill") {
      const now = Date.now();
      const lastFill = lastFillRef.current;
      if (
        lastFill &&
        Math.abs(lastFill.x - point.x) < 0.002 &&
        Math.abs(lastFill.y - point.y) < 0.002 &&
        lastFill.color === color &&
        now - lastFill.time < 200
      ) {
        return;
      }
      lastFillRef.current = { x: point.x, y: point.y, color, time: now };
      sendFillArea({ x: point.x, y: point.y, fillColor: color });
      return;
    }

    isDrawingRef.current = true;
    const strokeId = createId("stroke");
    strokeIdRef.current = strokeId;

    const normalizedSize = size / rect.width;
    const stroke: Stroke = {
      id: strokeId,
      color,
      size: normalizedSize,
      tool,
      points: [point],
      createdAt: Date.now()
    };

    canvas.setPointerCapture(event.pointerId);
    sendDrawStart(stroke);
  };

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawingRef.current) return;
    const point = toStrokePoint(event.nativeEvent);
    const strokeId = strokeIdRef.current;
    if (!point || !strokeId) return;
    sendDrawMove(strokeId, point);
  };

  const finishStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const point = toStrokePoint(event.nativeEvent);
    const strokeId = strokeIdRef.current;
    if (!point || !strokeId) return;
    sendDrawEnd(strokeId, point);
    isDrawingRef.current = false;
    strokeIdRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full rounded-2xl border border-stone-200 bg-white shadow-sm"
    >
      <canvas
        ref={canvasRef}
        className={`h-full w-full touch-none rounded-2xl ${
          canDraw ? "cursor-crosshair" : "cursor-not-allowed"
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerLeave={finishStroke}
      />
    </div>
  );
};
