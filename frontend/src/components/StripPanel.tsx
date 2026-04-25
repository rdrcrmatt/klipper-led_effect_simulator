import { useState } from "react";
import type { Layer, LedType } from "../types";
import type { Rotation } from "../utils/ledLayout";
import { serializeLayers } from "../utils/layerConfig";
import { LayerEditor } from "./LayerEditor";
import { ConfigPanel } from "./ConfigPanel";
import { DeferredNumberInput } from "./DeferredNumberInput";

const ROTATIONS: Rotation[] = [0, 90, 180, 270];
const WARN_THRESHOLD = { RGB: 166, RGBW: 125 };

type Props = {
  index: number;
  name: string;
  count: number;
  rotation: Rotation;
  reversed: boolean;
  layers: Layer[];
  ledType: LedType;
  availableEffects: string[];
  blendingModes: string[];
  canRemove: boolean;
  onNameChange: (name: string) => void;
  onCountChange: (count: number) => void;
  onRotationChange: (r: Rotation) => void;
  onReversedChange: (reversed: boolean) => void;
  onLayersChange: (layers: Layer[]) => void;
  onLayersTextLoad: (text: string) => void;
  onRemove: () => void;
};

export function StripPanel({
  index, name, count, rotation, reversed, layers, ledType,
  availableEffects, blendingModes,
  canRemove, onNameChange, onCountChange, onRotationChange, onReversedChange,
  onLayersChange, onLayersTextLoad, onRemove,
}: Props) {
  const [expanded, setExpanded] = useState(index === 0);
  const warn = count > WARN_THRESHOLD[ledType];

  return (
    <div className={`strip-panel${expanded ? " expanded" : ""}`}>
      <div className="strip-header" onClick={() => setExpanded((e) => !e)}>
        <span className="strip-chevron">{expanded ? "▾" : "▸"}</span>
        <input
          className="strip-name-input"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          spellCheck={false}
        />
        {warn && (
          <span className="strip-warn-icon" title="Exceeds max LEDs per data pin">⚠</span>
        )}
        <div className="strip-header-controls" onClick={(e) => e.stopPropagation()}>
          <div className="stepper">
            <button onClick={() => onCountChange(Math.max(1, count - 1))} disabled={count <= 1}>−</button>
            <DeferredNumberInput
              className="stepper-val"
              value={count}
              min={1}
              max={500}
              onChange={(v) => onCountChange(Math.round(v))}
            />
            <button onClick={() => onCountChange(Math.min(500, count + 1))}>+</button>
          </div>
          {canRemove && (
            <button className="btn-icon btn-danger" onClick={onRemove} title="Remove strip">×</button>
          )}
        </div>
      </div>

      {warn && (
        <div className="strip-warn-banner">
          ⚠ klipper-led_effect supports max {WARN_THRESHOLD[ledType]} {ledType} LEDs per data pin
        </div>
      )}

      {expanded && (
        <div className="strip-body">
          <div className="strip-rotation-row">
            <span className="strip-rotation-label">Direction</span>
            <div className="rotation-btns">
              {ROTATIONS.map((r) => (
                <button
                  key={r}
                  className={rotation === r ? "active" : ""}
                  onClick={() => onRotationChange(r)}
                >{r}°</button>
              ))}
            </div>
            <label className="reverse-label" title="Reverses the LED index order — matches the reversed range syntax in klipper-led_effect (e.g. 30-1)">
              <input
                type="checkbox"
                checked={reversed}
                onChange={(e) => onReversedChange(e.target.checked)}
              />
              Reverse
            </label>
          </div>
          <LayerEditor
            layers={layers}
            ledType={ledType}
            availableEffects={availableEffects}
            blendingModes={blendingModes}
            onChange={onLayersChange}
          />
          <ConfigPanel
            layersText={serializeLayers(layers, ledType)}
            onLoad={onLayersTextLoad}
            label={`Strip ${index + 1} Layers Config`}
          />
        </div>
      )}
    </div>
  );
}
