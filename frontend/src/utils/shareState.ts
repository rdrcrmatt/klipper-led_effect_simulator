import LZString from "lz-string";
import type { Strip, LedType } from "../types";
import type { DotShape, Rotation } from "./ledLayout";
import { generateLayerId } from "./layerConfig";

// ------------------------------------------------------------------ //
// Shareable state schema                                               //
// ------------------------------------------------------------------ //

/** v1 — increment if the shape changes in a breaking way */
const SCHEMA_VERSION = 1;

export type ShareableState = {
  v: number;
  ledType: LedType;
  shape: DotShape;
  ledSize: number;
  distance: number;
  strips: Array<{
    name: string;
    count: number;
    rotation: Rotation;
    reversed: boolean;
    layers: Array<{
      active: boolean;
      effect: string;
      rate: number;
      cutoff: number;
      blending: string;
      palette: string[]; // #rrggbbww
    }>;
  }>;
};

// ------------------------------------------------------------------ //
// Encode / decode                                                      //
// ------------------------------------------------------------------ //

export function encodeState(state: ShareableState): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(state));
}

export function decodeState(encoded: string): ShareableState | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const parsed = JSON.parse(json) as ShareableState;
    if (parsed.v !== SCHEMA_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ //
// URL helpers                                                          //
// ------------------------------------------------------------------ //

export function buildShareUrl(state: ShareableState): string {
  const url = new URL(window.location.href);
  url.searchParams.set("c", encodeState(state));
  return url.toString();
}

export function readShareParam(): string | null {
  return new URLSearchParams(window.location.search).get("c");
}

// ------------------------------------------------------------------ //
// Convert app state → ShareableState                                  //
// ------------------------------------------------------------------ //

export function stripToShareable(s: Strip): ShareableState["strips"][number] {
  return {
    name: s.name,
    count: s.count,
    rotation: s.rotation,
    reversed: s.reversed,
    layers: s.layers.map(({ active, effect, rate, cutoff, blending, palette }) => ({
      active, effect, rate, cutoff, blending, palette,
    })),
  };
}

export function makeShareableState(
  strips: Strip[],
  ledType: LedType,
  shape: DotShape,
  ledSize: number,
  distance: number,
): ShareableState {
  return {
    v: SCHEMA_VERSION,
    ledType,
    shape,
    ledSize,
    distance,
    strips: strips.map(stripToShareable),
  };
}

// ------------------------------------------------------------------ //
// Reconstruct strips from decoded state                               //
// ------------------------------------------------------------------ //

let _shareStripSeq = 0;
function shareStripId() { return `strip_share_${Date.now()}_${_shareStripSeq++}`; }

export function stripsFromShareable(
  shareStrips: ShareableState["strips"]
): Strip[] {
  return shareStrips.map((s) => ({
    id: shareStripId(),
    name: s.name,
    count: s.count,
    rotation: s.rotation,
    reversed: s.reversed ?? false,
    layers: s.layers.map((l) => ({ ...l, id: generateLayerId() })),
  }));
}
