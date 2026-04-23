import { useEffect, useRef, useState } from "react";
import type { LedCoord, DotShape } from "../utils/ledLayout";
import type { LedFrame } from "../hooks/useSimulator";

type Props = {
  coordinates: LedCoord[];
  frame: LedFrame | null;
  shape: DotShape;
  frameCount: number;
};

const PADDING   = 32;
const OFF_COLOR = "#1a1a1a";

function fitTransform(
  coords: LedCoord[],
  canvasW: number,
  canvasH: number,
  padding: number
): { scale: number; tx: number; ty: number } {
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  if (coords.length === 0) return { scale: 1, tx: cx, ty: cy };

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const c of coords) {
    const r = c.size / 2;
    minX = Math.min(minX, c.x - r);
    maxX = Math.max(maxX, c.x + r);
    minY = Math.min(minY, c.y - r);
    maxY = Math.max(maxY, c.y + r);
  }

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const availW   = canvasW - 2 * padding;
  const availH   = canvasH - 2 * padding;
  // Only scale DOWN to prevent clipping; never zoom in past 1:1 so that
  // size and distance remain independent controls with literal pixel meaning.
  const scale    = contentW > 0 && contentH > 0
    ? Math.min(availW / contentW, availH / contentH, 1)
    : 1;

  return {
    scale,
    tx: cx - ((minX + maxX) / 2) * scale,
    ty: cy - ((minY + maxY) / 2) * scale,
  };
}

function draw(
  canvas: HTMLCanvasElement,
  coordinates: LedCoord[],
  frame: LedFrame | null,
  shape: DotShape
) {
  const ctx = canvas.getContext("2d")!;
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  if (coordinates.length === 0) return;

  const { scale, tx, ty } = fitTransform(coordinates, W, H, PADDING);

  for (let i = 0; i < coordinates.length; i++) {
    const coord = coordinates[i];
    const x = coord.x * scale + tx;
    const y = coord.y * scale + ty;
    const r = (coord.size / 2) * scale;

    const led = frame?.[i];
    if (led) {
      ctx.fillStyle = `rgb(${led[0]},${led[1]},${led[2]})`;
      ctx.shadowColor = `rgba(${led[0]},${led[1]},${led[2]},0.7)`;
      ctx.shadowBlur = r * 2.5;
    } else {
      ctx.fillStyle = OFF_COLOR;
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    if (shape === "Circle") {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    } else {
      ctx.rect(x - r, y - r, r * 2, r * 2);
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

export function LedCanvas({ coordinates, frame, shape, frameCount }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 300, h: 300 });

  // Track the rendered size of the canvas element itself
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setSize({ w: Math.round(width), h: Math.round(height) });
      }
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Resize the drawing buffer and redraw whenever size, frame, layout, or shape changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = size.w;
    canvas.height = size.h;
    draw(canvas, coordinates, frame, shape);
  // size changes require a full redraw; frameCount is the per-frame trigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameCount, coordinates, shape, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
