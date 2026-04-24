import type { Layer, LedType } from "../types";

// ------------------------------------------------------------------ //
// Color conversion                                                     //
// ------------------------------------------------------------------ //

/**
 * Ensure a hex color is always 8 chars (#rrggbbww).
 * 6-char hex strings have "00" appended for the W channel.
 */
export function normalizeHex(hex: string): string {
  return hex.length === 7 ? hex + "00" : hex;
}

/**
 * Parse a float color string into an 8-char hex string.
 * Handles both "(r,g,b)" and "(r,g,b,w)" input.
 * "1.0,0.0,0.5" → "#ff008000"
 * "1.0,0.0,0.5,0.3" → "#ff00804d"
 */
export function floatColorToHex(floatStr: string): string {
  const parts = floatStr.replace(/[()]/g, "").split(",");
  const [r, g, b, w] = parts.map((v) =>
    Math.round(Math.min(1, Math.max(0, parseFloat(v.trim()) || 0)) * 255)
  );
  return "#" + [r, g, b, w ?? 0].map((n) => n.toString(16).padStart(2, "0")).join("");
}

/**
 * Convert an 8-char hex color to a float string for tooltip display.
 * "#ff008000" → "1.00,0.00,0.50,0.00"
 * Also accepts 6-char hex (W defaults to 0.00).
 */
export function hexToFloatColor(hex: string): string {
  const h = normalizeHex(hex);
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  const w = parseInt(h.slice(7, 9), 16) / 255;
  return `${r.toFixed(2)},${g.toFixed(2)},${b.toFixed(2)},${w.toFixed(2)}`;
}

/**
 * Compute the blended display color (W additively mixed into RGB) for
 * rendering swatches and canvas. Returns a CSS rgb() string.
 */
export function blendedDisplayColor(hex: string): string {
  const h = normalizeHex(hex);
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  const w = parseInt(h.slice(7, 9), 16);
  return `rgb(${Math.min(255, r + w)},${Math.min(255, g + w)},${Math.min(255, b + w)})`;
}

// ------------------------------------------------------------------ //
// Parse                                                                //
// ------------------------------------------------------------------ //

let _seq = 0;
export function generateLayerId(): string {
  return `l_${Date.now()}_${_seq++}`;
}

/**
 * Parse the klipper-led_effect layers text format into Layer objects.
 *
 * Each non-blank line:
 *   <effect> <rate> <cutoff> <blending> (r,g,b),(r,g,b),...
 *   or (r,g,b,w),(r,g,b,w),... for RGBW
 *
 * Palette entries are stored as 8-char hex strings (#rrggbbww).
 */
export function parseLayersText(text: string): Layer[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      const effect   = parts[0] ?? "static";
      const rateRaw  = parseFloat(parts[1] ?? "");
      const rate     = isNaN(rateRaw) ? 1 : rateRaw;
      const cutoffRaw = parseFloat(parts[2] ?? "");
      const cutoff   = isNaN(cutoffRaw) ? 0 : cutoffRaw;
      const blending = parts[3] ?? "top";

      // Everything after the 4th token is the palette string
      const palRaw = parts.slice(4).join("").replace(/\s/g, "");
      const palette =
        palRaw.length > 0
          ? palRaw
              .split("),(")
              .map((s) => floatColorToHex(s))
          : ["#ffffff00"];

      return { id: generateLayerId(), active: true, effect, rate, cutoff, blending, palette };
    });
}

// ------------------------------------------------------------------ //
// Serialize                                                            //
// ------------------------------------------------------------------ //

/**
 * Serialize Layer objects back to the klipper-led_effect text format.
 * Inactive layers are excluded so the engine doesn't see them.
 *
 * ledType controls whether palette entries are emitted as (r,g,b) or (r,g,b,w).
 */
export function serializeLayers(layers: Layer[], ledType: LedType = "RGB"): string {
  return layers
    .filter((l) => l.active)
    .map((l) => {
      const pal = l.palette.map((hex) => {
        const h = normalizeHex(hex);
        const r = (parseInt(h.slice(1, 3), 16) / 255).toFixed(2);
        const g = (parseInt(h.slice(3, 5), 16) / 255).toFixed(2);
        const b = (parseInt(h.slice(5, 7), 16) / 255).toFixed(2);
        const w = (parseInt(h.slice(7, 9), 16) / 255).toFixed(2);
        return ledType === "RGBW"
          ? `(${r},${g},${b},${w})`
          : `(${r},${g},${b})`;
      }).join(",");
      return `${l.effect} ${l.rate} ${l.cutoff} ${l.blending} ${pal}`;
    })
    .join("\n");
}

// ------------------------------------------------------------------ //
// Default / factory                                                    //
// ------------------------------------------------------------------ //

export function newLayer(availableEffects: string[]): Layer {
  return {
    id: generateLayerId(),
    active: true,
    effect: availableEffects[0] ?? "static",
    rate: 1,
    cutoff: 0,
    blending: "top",
    palette: ["#ffffff00"],
  };
}

export const DEFAULT_LAYERS_TEXT =
  "gradient 1 1 top (1.0,0.0,0.0),(0.0,1.0,0.0),(0.0,0.0,1.0)";

// Fallback list when backend hasn't sent available effects yet
export const FALLBACK_EFFECTS = [
  "analogpin", "blink", "breathing", "chase", "comet", "cylon",
  "fire", "gradient", "heater", "heaterfire", "heatergauge", "homing",
  "linearfade", "pattern", "progress", "static", "stepper", "steppercolor",
  "strobe", "temperature", "temperaturegauge", "twinkle",
];

export const FALLBACK_BLENDING = [
  "top", "bottom", "add", "subtract", "subtract_b", "difference",
  "average", "multiply", "divide", "screen", "lighten", "darken", "overlay",
];
