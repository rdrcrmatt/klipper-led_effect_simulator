import { useState } from "react";
import type { DotShape, Rotation } from "../utils/ledLayout";
import type { Layer, Strip, LedType } from "../types";
import type { SimState } from "../hooks/useSimulator";
import { StripPanel } from "./StripPanel";
import { MacroBuilderModal } from "./MacroBuilderModal";

type Props = {
  strips: Strip[];
  shape: DotShape;
  ledSize: number;
  distance: number;
  ledType: LedType;
  availableEffects: string[];
  blendingModes: string[];
  frameCount: number;
  printerState: SimState;
  onPrinterStateChange: (patch: Partial<SimState>) => void;
  onAddStrip: () => void;
  onRemoveStrip: (id: string) => void;
  onStripNameChange: (id: string, name: string) => void;
  onStripCountChange: (id: string, count: number) => void;
  onStripRotationChange: (id: string, r: Rotation) => void;
  onStripReversedChange: (id: string, reversed: boolean) => void;
  onStripLayersChange: (id: string, layers: Layer[]) => void;
  onStripLayersTextLoad: (id: string, text: string) => void;
  onShapeChange: (s: DotShape) => void;
  onLedSizeChange: (n: number) => void;
  onDistanceChange: (n: number) => void;
  onLedTypeChange: (t: LedType) => void;
};

const SHAPES: DotShape[] = ["Circle", "Square"];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ctrl-row">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function SimControls({
  strips, shape, ledSize, distance, ledType,
  availableEffects, blendingModes, frameCount,
  printerState, onPrinterStateChange,
  onAddStrip, onRemoveStrip, onStripNameChange,
  onStripCountChange, onStripRotationChange, onStripReversedChange,
  onStripLayersChange, onStripLayersTextLoad,
  onShapeChange, onLedSizeChange, onDistanceChange, onLedTypeChange,
}: Props) {
  const totalLeds = strips.reduce((a, s) => a + s.count, 0);
  const [showMacro, setShowMacro] = useState(false);
  const [showLedTypeHelp, setShowLedTypeHelp] = useState(false);

  return (
    <aside className="controls">

      {/* ---- Display ------------------------------------------- */}
      <section>
        <h3>Display</h3>

        <Row label="LED Shape">
          <select value={shape} onChange={(e) => onShapeChange(e.target.value as DotShape)}>
            {SHAPES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Row>

        <Row label="LED size">
          <input type="range" min={4} max={40} value={ledSize}
            onChange={(e) => onLedSizeChange(parseInt(e.target.value))} />
          <span className="val">{ledSize}px</span>
        </Row>

        <Row label="Distance">
          <input type="range" min={8} max={80} value={distance}
            onChange={(e) => onDistanceChange(parseInt(e.target.value))} />
          <span className="val">{distance}px</span>
        </Row>
      </section>

      {/* ---- LED Type ------------------------------------------ */}
      <section className="led-type-section">
        <div className="led-type-header">
          <h3>LED Type</h3>
          <button
            className="led-type-help-btn"
            onClick={() => setShowLedTypeHelp((v) => !v)}
            title="About LED type"
          >?</button>
        </div>
        {showLedTypeHelp && (
          <div className="led-type-help">
            <p>
              Select <strong>RGB</strong> for standard 3-channel LEDs (e.g. WS2812B),
              or <strong>RGBW</strong> for 4-channel LEDs with a dedicated white element
              (e.g. SK6812 RGBW).
            </p>
            <p>
              The actual color order (GRB, GRBW, RGB, etc.) is set in your Klipper
              neopixel device definition — <code>color_order:</code> — not here.
              All strips share the same device configuration.
            </p>
          </div>
        )}
        <div className="led-type-radios">
          {(["RGB", "RGBW"] as LedType[]).map((t) => (
            <label key={t} className={`led-type-radio${ledType === t ? " active" : ""}`}>
              <input
                type="radio"
                name="ledType"
                value={t}
                checked={ledType === t}
                onChange={() => onLedTypeChange(t)}
              />
              {t}
            </label>
          ))}
        </div>
      </section>

      {/* ---- Strips -------------------------------------------- */}
      <section className="strips-section">
        {showMacro && (
          <MacroBuilderModal
            strips={strips}
            ledType={ledType}
            onClose={() => setShowMacro(false)}
          />
        )}
        <div className="strips-header">
          <h3>Strips <span className="strips-total">({totalLeds} LEDs total)</span></h3>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setShowMacro(true)}>Build Config</button>
            <button onClick={onAddStrip}>+ Add Strip</button>
          </div>
        </div>

        <div className="strips-list">
          {strips.map((strip, i) => (
            <StripPanel
              key={strip.id}
              index={i}
              name={strip.name}
              count={strip.count}
              rotation={strip.rotation}
              layers={strip.layers}
              reversed={strip.reversed}
              ledType={ledType}
              availableEffects={availableEffects}
              blendingModes={blendingModes}
              canRemove={strips.length > 1}
              onNameChange={(name) => onStripNameChange(strip.id, name)}
              onCountChange={(count) => onStripCountChange(strip.id, count)}
              onRotationChange={(r) => onStripRotationChange(strip.id, r)}
              onReversedChange={(rev) => onStripReversedChange(strip.id, rev)}
              onLayersChange={(layers) => onStripLayersChange(strip.id, layers)}
              onLayersTextLoad={(text) => onStripLayersTextLoad(strip.id, text)}
              onRemove={() => onRemoveStrip(strip.id)}
            />
          ))}
        </div>
      </section>

      {/* ---- Printer state ------------------------------------- */}
      <section>
        <h3>Printer State</h3>

        <Row label="Stepper">
          <input type="range" min={0} max={100} value={printerState.stepper ?? 0}
            onChange={(e) => onPrinterStateChange({ stepper: parseInt(e.target.value) })} />
          <span className="val">{printerState.stepper ?? 0}</span>
        </Row>

        <Row label="Heater">
          <input type="range" min={0} max={300} value={printerState.heater ?? 0}
            onChange={(e) => onPrinterStateChange({ heater: parseInt(e.target.value) })} />
          <span className="val">{printerState.heater ?? 0}°</span>
        </Row>

        <Row label="Progress">
          <input type="range" min={0} max={100} value={printerState.progress ?? 0}
            onChange={(e) => onPrinterStateChange({ progress: parseInt(e.target.value) })} />
          <span className="val">{printerState.progress ?? 0}%</span>
        </Row>

        <Row label="Analog">
          <input type="range" min={0} max={100} value={printerState.analog ?? 0}
            onChange={(e) => onPrinterStateChange({ analog: parseInt(e.target.value) })} />
          <span className="val">{printerState.analog ?? 0}</span>
        </Row>
      </section>

      {/* ---- Stats ---------------------------------------------- */}
      <section className="stats">
        <span>frames: {frameCount}</span>
      </section>

    </aside>
  );
}
