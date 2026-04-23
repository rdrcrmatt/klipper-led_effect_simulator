export type DotShape = "Circle" | "Square";
export type Rotation = 0 | 90 | 180 | 270;

export type LedCoord = {
  x: number;
  y: number;
  size: number;
};

/**
 * Lay out LEDs as a connected path of segments, each with its own direction.
 * Segments connect end-to-end; the overall path is centered at (0, 0).
 */
export function calcPathCoordinates(
  size: number,
  distance: number,
  segments: Array<{ count: number; rotation: Rotation }>
): LedCoord[] {
  const dirVectors: Record<Rotation, [number, number]> = {
    0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1],
  };
  const coords: LedCoord[] = [];
  let cx = 0, cy = 0;

  for (let s = 0; s < segments.length; s++) {
    const { count, rotation } = segments[s];
    const [dx, dy] = dirVectors[rotation];
    if (s > 0) { cx += distance * dx; cy += distance * dy; }
    for (let i = 0; i < count; i++) {
      coords.push({ x: cx + i * distance * dx, y: cy + i * distance * dy, size });
    }
    cx += count * distance * dx;
    cy += count * distance * dy;
  }

  if (coords.length === 0) return coords;

  const xs  = coords.map((c) => c.x);
  const ys  = coords.map((c) => c.y);
  const mcx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const mcy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return coords.map((c) => ({ ...c, x: c.x - mcx, y: c.y - mcy }));
}
