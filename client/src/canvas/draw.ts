import type { Stroke } from "../types/game";

const getPoint = (value: number, size: number) => value * size;

const clampPixel = (value: number, max: number) =>
  Math.min(Math.max(value, 0), Math.max(0, max - 1));

const parseHexColor = (value: string): [number, number, number, number] | null => {
  if (!value.startsWith("#")) return null;
  const hex = value.slice(1).trim();
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return [r, g, b, 255];
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [r, g, b, 255];
  }
  return null;
};

const resolveFillColor = (
  fillColor: string
): [number, number, number, number] => {
  const parsed = parseHexColor(fillColor);
  if (parsed) return parsed;

  const swatch = document.createElement("canvas");
  swatch.width = 1;
  swatch.height = 1;
  const swatchCtx = swatch.getContext("2d");
  if (!swatchCtx) return [0, 0, 0, 255];
  swatchCtx.clearRect(0, 0, 1, 1);
  swatchCtx.fillStyle = fillColor;
  swatchCtx.fillRect(0, 0, 1, 1);
  const data = swatchCtx.getImageData(0, 0, 1, 1).data;
  return [data[0], data[1], data[2], data[3]];
};

const floodFill = (
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string
) => {
  const pixelWidth = ctx.canvas.width;
  const pixelHeight = ctx.canvas.height;
  if (!pixelWidth || !pixelHeight) return;

  const clampedX = clampPixel(startX, pixelWidth);
  const clampedY = clampPixel(startY, pixelHeight);

  const image = ctx.getImageData(0, 0, pixelWidth, pixelHeight);
  const data = image.data;
  const targetIndex = (clampedY * pixelWidth + clampedX) * 4;
  const targetColor: [number, number, number, number] = [
    data[targetIndex],
    data[targetIndex + 1],
    data[targetIndex + 2],
    data[targetIndex + 3]
  ];
  const replacement = resolveFillColor(fillColor);

  if (
    targetColor[0] === replacement[0] &&
    targetColor[1] === replacement[1] &&
    targetColor[2] === replacement[2] &&
    targetColor[3] === replacement[3]
  ) {
    return;
  }

  const stack: Array<{ x: number; y: number }> = [
    { x: clampedX, y: clampedY }
  ];
  const maxPixels = pixelWidth * pixelHeight;
  let processed = 0;

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    const { x, y } = current;
    const index = (y * pixelWidth + x) * 4;

    if (
      data[index] !== targetColor[0] ||
      data[index + 1] !== targetColor[1] ||
      data[index + 2] !== targetColor[2] ||
      data[index + 3] !== targetColor[3]
    ) {
      continue;
    }

    data[index] = replacement[0];
    data[index + 1] = replacement[1];
    data[index + 2] = replacement[2];
    data[index + 3] = replacement[3];

    if (x > 0) stack.push({ x: x - 1, y });
    if (x < pixelWidth - 1) stack.push({ x: x + 1, y });
    if (y > 0) stack.push({ x, y: y - 1 });
    if (y < pixelHeight - 1) stack.push({ x, y: y + 1 });

    processed += 1;
    if (processed >= maxPixels) break;
  }

  ctx.putImageData(image, 0, 0);
};

const applyStrokeStyle = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number
) => {
  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0, 0, 0, 1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
  }
  ctx.lineWidth = Math.max(1, stroke.size * width);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
};

export const drawStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number
) => {
  if (!stroke.points.length) return;
  if (stroke.tool === "fill") {
    const point = stroke.points[stroke.points.length - 1];
    if (!point) return;
    const pixelX = Math.floor(point.x * ctx.canvas.width);
    const pixelY = Math.floor(point.y * ctx.canvas.height);
    ctx.globalCompositeOperation = "source-over";
    floodFill(ctx, pixelX, pixelY, stroke.color);
    return;
  }
  applyStrokeStyle(ctx, stroke, width);

  const [first, ...rest] = stroke.points;
  const startX = getPoint(first.x, width);
  const startY = getPoint(first.y, height);

  ctx.beginPath();
  ctx.moveTo(startX, startY);

  if (rest.length === 0) {
    ctx.arc(startX, startY, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    return;
  }

  rest.forEach((point) => {
    ctx.lineTo(getPoint(point.x, width), getPoint(point.y, height));
  });

  ctx.stroke();
};

export const clearCanvas = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) => {
  ctx.clearRect(0, 0, width, height);
};

export const drawStrokes = (
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number
) => {
  clearCanvas(ctx, width, height);
  strokes.forEach((stroke) => drawStroke(ctx, stroke, width, height));
  ctx.globalCompositeOperation = "source-over";
};
