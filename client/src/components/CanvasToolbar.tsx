import { Brush, Eraser, PaintBucket, PenLine } from "lucide-react";
import type { ToolType } from "../types/game";

const COLORS = [
  "#0f172a",
  "#1f2937",
  "#1e40af",
  "#0f766e",
  "#b91c1c",
  "#a16207",
  "#6d28d9",
  "#c026d3",
  "#0f172a"
];

interface CanvasToolbarProps {
  tool: ToolType;
  color: string;
  size: number;
  canDraw: boolean;
  onToolChange: (tool: ToolType) => void;
  onColorChange: (color: string) => void;
  onSizeChange: (size: number) => void;
  onUndo: () => void;
  onClear: () => void;
}

export const CanvasToolbar = ({
  tool,
  color,
  size,
  canDraw,
  onToolChange,
  onColorChange,
  onSizeChange,
  onUndo,
  onClear
}: CanvasToolbarProps) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToolChange("pen")}
          className={`rounded-full border px-3 py-2 text-sm ${
            tool === "pen"
              ? "border-orange-400 bg-orange-50 text-orange-600"
              : "border-transparent text-slate-500 hover:border-stone-200"
          }`}
          disabled={!canDraw}
          aria-label="Pen tool"
        >
          <PenLine className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onToolChange("brush")}
          className={`rounded-full border px-3 py-2 text-sm ${
            tool === "brush"
              ? "border-orange-400 bg-orange-50 text-orange-600"
              : "border-transparent text-slate-500 hover:border-stone-200"
          }`}
          disabled={!canDraw}
          aria-label="Brush tool"
        >
          <Brush className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onToolChange("eraser")}
          className={`rounded-full border px-3 py-2 text-sm ${
            tool === "eraser"
              ? "border-orange-400 bg-orange-50 text-orange-600"
              : "border-transparent text-slate-500 hover:border-stone-200"
          }`}
          disabled={!canDraw}
          aria-label="Eraser tool"
        >
          <Eraser className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onToolChange("fill")}
          className={`rounded-full border px-3 py-2 text-sm ${
            tool === "fill"
              ? "border-orange-400 bg-orange-50 text-orange-600"
              : "border-transparent text-slate-500 hover:border-stone-200"
          }`}
          disabled={!canDraw}
          aria-label="Bucket tool"
        >
          <PaintBucket className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {COLORS.map((swatch, index) => (
            <button
              key={`${swatch}-${index}`}
              type="button"
              onClick={() => onColorChange(swatch)}
              className={`h-6 w-6 rounded-full border transition ${
                color === swatch
                  ? "border-orange-400"
                  : "border-stone-200"
              }`}
              style={{ backgroundColor: swatch }}
              aria-label={`Select color ${swatch}`}
              disabled={!canDraw || tool === "eraser"}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>Size</span>
          <input
            type="range"
            min={2}
            max={22}
            value={size}
            onChange={(event) => onSizeChange(Number(event.target.value))}
            disabled={!canDraw}
            className="accent-orange-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canDraw}
            className="rounded-lg border border-stone-200 px-3 py-1 text-sm text-slate-900 hover:border-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!canDraw}
            className="rounded-lg border border-stone-200 px-3 py-1 text-sm text-slate-900 hover:border-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};
