import type { Layer } from "../types";

// ------------------------------------------------------------------ //
// Color conversion                                                     //
// ------------------------------------------------------------------ //

/** "1.0,0.0,0.5" → "#ff0080" */
export function floatColorToHex(floatStr: string): string {
  const parts = floatStr.replace(/[()]/g, "").split(",");
  const [r, g, b] = parts.map((v) =>
    Math.round(Math.min(1, Math.max(0, parseFloat(v.trim()) || 0)) * 255)
  );
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

/** "#ff0080" → "1.00,0.00,0.50" */
export function hexToFloatColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return `${r.toFixed(2)},${g.toFixed(2)},${b.toFixed(2)}`;
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
          : ["#ffffff"];

      return { id: generateLayerId(), active: true, effect, rate, cutoff, blending, palette };
    });
}

// ------------------------------------------------------------------ //
// Serialize                                                            //
// ------------------------------------------------------------------ //

/**
 * Serialize Layer objects back to the klipper-led_effect text format.
 * Inactive layers are excluded so the engine doesn't see them.
 */
export function serializeLayers(layers: Layer[]): string {
  return layers
    .filter((l) => l.active)
    .map((l) => {
      const pal = l.palette.map((hex) => `(${hexToFloatColor(hex)})`).join(",");
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
    palette: ["#ffffff"],
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
