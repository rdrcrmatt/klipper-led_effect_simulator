export type DotShape = "Circle" | "Square";
export type Rotation = 0 | 90 | 180 | 270;

export type LedCoord = {
  x: number;
  y: number;
  size: number;
};

/**
 * Lay out LEDs as independent rows, one per strip, stacked vertically.
 *
 * Each strip occupies its own row so strips never overlap regardless of
 * rotation. Rotation controls which direction the LEDs run within the row:
 *   0°  → left to right
 *   180°→ right to left
 *   90° → top to bottom (vertical strip)
 *   270°→ bottom to top (vertical strip)
 *
 * `reversed` inverts the LED-index-to-position mapping for a strip, matching
 * the reversed range syntax in klipper-led_effect (e.g. "30-1").
 *
 * Rows are separated by ROW_GAP = distance × 2.  The overall layout is
 * centered at (0, 0).
 */
export function calcPathCoordinates(
  size: number,
  distance: number,
  segments: Array<{ count: number; rotation: Rotation; reversed?: boolean }>
): LedCoord[] {
  if (segments.length === 0) return [];

  const ROW_GAP = distance * 2;

  // ---- Pass 1: accumulate row base y-positions ----
  const rowBases: number[] = [];
  let y = 0;
  for (const seg of segments) {
    rowBases.push(y);
    const isVertical = seg.rotation === 90 || seg.rotation === 270;
    const segHeight   = isVertical ? (seg.count - 1) * distance : 0;
    y += segHeight + ROW_GAP;
  }

  // Center vertically: total occupied height (last ROW_GAP is trailing space)
  const totalHeight = y - ROW_GAP;
  const yOffset     = -totalHeight / 2;

  // ---- Pass 2: generate coordinates ----
  const allCoords: LedCoord[] = [];

  for (let s = 0; s < segments.length; s++) {
    const { count, rotation, reversed } = segments[s];
    const baseY      = rowBases[s] + yOffset;
    const isVertical = rotation === 90 || rotation === 270;
    const stripCoords: LedCoord[] = [];

    if (isVertical) {
      // 90°: LED 0 at top, going down; 270°: LED 0 at bottom, going up
      const startY = rotation === 90
        ? baseY
        : baseY + (count - 1) * distance;
      const dy = rotation === 90 ? 1 : -1;
      for (let i = 0; i < count; i++) {
        stripCoords.push({ x: 0, y: startY + i * distance * dy, size });
      }
    } else {
      // 0°: LED 0 at left, going right; 180°: LED 0 at right, going left
      const half   = (count - 1) * distance / 2;
      const startX = rotation === 0 ? -half : half;
      const dx     = rotation === 0 ? 1 : -1;
      for (let i = 0; i < count; i++) {
        stripCoords.push({ x: startX + i * distance * dx, y: baseY, size });
      }
    }

    // Reversing swaps which physical position each effect-frame index maps to,
    // matching klipper-led_effect's reversed LED range (e.g. "30-1").
    if (reversed) stripCoords.reverse();

    allCoords.push(...stripCoords);
  }

  return allCoords;
}
