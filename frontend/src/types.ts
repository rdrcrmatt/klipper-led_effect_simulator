import type { Rotation } from "./utils/ledLayout";

export type LedType = "RGB" | "RGBW";

export type Layer = {
  id: string;
  active: boolean;
  effect: string;
  rate: number;
  cutoff: number;
  blending: string;
  palette: string[]; // hex strings: "#rrggbbww"
};

export type Strip = {
  id: string;
  name: string;
  count: number;
  rotation: Rotation;
  reversed: boolean;
  layers: Layer[];
};
