import type { Rotation } from "./utils/ledLayout";

export type Layer = {
  id: string;
  active: boolean;
  effect: string;
  rate: number;
  cutoff: number;
  blending: string;
  palette: string[]; // hex strings: "#rrggbb"
};

export type Strip = {
  id: string;
  name: string;
  count: number;
  rotation: Rotation;
  layers: Layer[];
};
