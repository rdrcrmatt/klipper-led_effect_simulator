export type DotShape = "Circle" | "Square";
export type Rotation = 0 | 90 | 180 | 270;

export type LedCoord = {
  x: number;
  y: number;
  size: number;
};

/**
 * Lay out LEDs as a connected path of segments, each with its own direction.
 * Strips connect end-to-end, one LED-spacing apart, so consecutive segments
 * with different rotations form corners (e.g. a square or L-shape).
 *
 * The overall path is centered at (0, 0).
 *
 * `reversed` inverts the LED-index-to-position mapping for a segment, which
 * makes the effect animation run in the opposite direction on that strip and
 * matches the reversed range syntax in klipper-led_effect (e.g. "30-1").
 */
export function calcPathCoordinates(
  size: number,
  distance: number,
  segments: Array<{ count: number; rotation: Rotation; reversed?: boolean }>
): LedCoord[] {
  const dirVectors: Record<Rotation, [number, number]> = {
    0: [1, 0], 90: [0, 1], 180: [-1, 0], 270: [0, -1],
  };

  const coords: LedCoord[] = [];
  let cx = 0, cy = 0;

  for (let s = 0; s < segments.length; s++) {
    const { count, rotation, reversed } = segments[s];
    const [dx, dy] = dirVectors[rotation];

    // Advance one step between segments so corners connect cleanly
    if (s > 0) { cx += distance * dx; cy += distance * dy; }

    const stripCoords: LedCoord[] = [];
    for (let i = 0; i < count; i++) {
      stripCoords.push({
        x: cx + i * distance * dx,
        y: cy + i * distance * dy,
        size,
      });
    }

    if (reversed) stripCoords.reverse();
    coords.push(...stripCoords);

    cx += count * distance * dx;
    cy += count * distance * dy;
  }

  if (coords.length === 0) return coords;

  // Center the layout
  const xs  = coords.map((c) => c.x);
  const ys  = coords.map((c) => c.y);
  const mcx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const mcy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return coords.map((c) => ({ ...c, x: c.x - mcx, y: c.y - mcy }));
}
