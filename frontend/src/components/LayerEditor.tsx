import { useState } from "react";
import type { Layer, LedType } from "../types";
import { newLayer, hexToFloatColor, normalizeHex, blendedDisplayColor } from "../utils/layerConfig";
import { HelpModal } from "./HelpModal";

type Props = {
  layers: Layer[];
  ledType: LedType;
  availableEffects: string[];
  blendingModes: string[];
  onChange: (layers: Layer[]) => void;
};

// ------------------------------------------------------------------ //
// Palette row                                                          //
// ------------------------------------------------------------------ //

function PaletteEditor({
  palette,
  ledType,
  onChange,
}: {
  palette: string[];
  ledType: LedType;
  onChange: (p: string[]) => void;
}) {
  const updateRgb = (i: number, rgbHex: string) => {
    const next = [...palette];
    const current = normalizeHex(next[i] ?? "#000000");
    // Keep existing W byte, replace RGB
    next[i] = rgbHex + current.slice(7);
    onChange(next);
  };

  const updateW = (i: number, pct: number) => {
    const next = [...palette];
    const current = normalizeHex(next[i] ?? "#000000");
    const wByte = Math.round(Math.min(100, Math.max(0, pct)) * 2.55)
      .toString(16).padStart(2, "0");
    next[i] = current.slice(0, 7) + wByte;
    onChange(next);
  };

  const remove = (i: number) => onChange(palette.filter((_, idx) => idx !== i));
  const add    = () => onChange([...palette, "#ffffff00"]);
  const move   = (i: number, dir: -1 | 1) => {
    const next = [...palette];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
  };

  return (
    <div className="palette-editor">
      <div className="palette-swatches">
        {palette.map((hex, i) => {
          const h      = normalizeHex(hex);
          const rgbHex = h.slice(0, 7);
          const wPct   = Math.round(parseInt(h.slice(7, 9), 16) / 2.55);

          return (
            <div key={i} className="swatch-cell">
              <label
                className="color-swatch"
                style={{ background: blendedDisplayColor(h) }}
                title={hexToFloatColor(h)}
              >
                <input
                  type="color"
                  value={rgbHex}
                  onChange={(e) => updateRgb(i, e.target.value)}
                />
              </label>

              {ledType === "RGBW" && (
                <div className="swatch-w-row">
                  <span className="swatch-w-label">W</span>
                  <input
                    type="number"
                    className="swatch-w-input"
                    min={0}
                    max={100}
                    value={wPct}
                    onChange={(e) => updateW(i, parseInt(e.target.value) || 0)}
                  />
                  <span className="swatch-w-unit">%</span>
                </div>
              )}

              <div className="swatch-btns">
                <button disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button disabled={i === palette.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button
                  className="btn-danger"
                  disabled={palette.length <= 1}
                  onClick={() => remove(i)}
                >×</button>
              </div>
            </div>
          );
        })}
      </div>
      <button className="btn-add-color" onClick={add}>+ color</button>
    </div>
  );
}

// ------------------------------------------------------------------ //
// Mini palette preview (shown in the layer list row)                  //
// ------------------------------------------------------------------ //

function MiniPalette({ palette }: { palette: string[] }) {
  return (
    <span className="mini-palette">
      {palette.slice(0, 5).map((hex, i) => (
        <span
          key={i}
          className="mini-swatch"
          style={{ background: blendedDisplayColor(hex) }}
        />
      ))}
      {palette.length > 5 && (
        <span className="mini-more">+{palette.length - 5}</span>
      )}
    </span>
  );
}

// ------------------------------------------------------------------ //
// Main component                                                       //
// ------------------------------------------------------------------ //

export function LayerEditor({ layers, ledType, availableEffects, blendingModes, onChange }: Props) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(
    layers.length > 0 ? 0 : null
  );
  const [showHelp, setShowHelp] = useState(false);

  const selected = selectedIdx !== null ? layers[selectedIdx] ?? null : null;

  // Keep selectedIdx in bounds as layers change
  const safeIdx =
    selectedIdx !== null && selectedIdx < layers.length ? selectedIdx : null;

  // ---- Layer list mutations ----------------------------------------

  const updateLayer = (i: number, patch: Partial<Layer>) => {
    const next = layers.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    onChange(next);
  };

  const addLayer = () => {
    const next = [...layers, newLayer(availableEffects)];
    onChange(next);
    setSelectedIdx(next.length - 1);
  };

  const removeLayer = (i: number) => {
    const next = layers.filter((_, idx) => idx !== i);
    onChange(next);
    setSelectedIdx(next.length === 0 ? null : Math.min(i, next.length - 1));
  };

  const moveLayer = (i: number, dir: -1 | 1) => {
    const next = [...layers];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
    setSelectedIdx(i + dir);
  };

  const sel = safeIdx;

  return (
    <div className="layer-editor">
      {/* ---- Layer list ------------------------------------------ */}
      <div className="layer-list-header">
        <span>Layers</span>
        <button className="btn-icon" onClick={addLayer} title="Add layer">+</button>
      </div>

      <div className="layer-list">
        {layers.length === 0 && (
          <div className="layer-empty">No layers — click + to add one</div>
        )}
        {layers.map((layer, i) => (
          <div
            key={layer.id}
            className={`layer-row${i === sel ? " selected" : ""}${!layer.active ? " inactive" : ""}`}
            onClick={() => setSelectedIdx(i)}
          >
            <input
              type="checkbox"
              checked={layer.active}
              onChange={(e) => updateLayer(i, { active: e.target.checked })}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="layer-effect-name">{layer.effect}</span>
            <MiniPalette palette={layer.palette} />
            <div className="layer-row-actions" onClick={(e) => e.stopPropagation()}>
              <button disabled={i === 0} onClick={() => moveLayer(i, -1)}>↑</button>
              <button disabled={i === layers.length - 1} onClick={() => moveLayer(i, 1)}>↓</button>
              <button className="btn-danger" onClick={() => removeLayer(i)}>×</button>
            </div>
          </div>
        ))}
      </div>

      {/* ---- Selected layer detail ------------------------------- */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {sel !== null && selected && (
        <>
          <div className="layer-detail">
            <div className="effect-header">
              <h3>Effect</h3>
              <button className="help-btn" onClick={() => setShowHelp(true)} title="Effect reference">?</button>
            </div>

            <div className="ctrl-row">
              <label>Type</label>
              <select
                value={selected.effect}
                onChange={(e) => updateLayer(sel, { effect: e.target.value })}
              >
                {availableEffects.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </div>

            <div className="ctrl-row">
              <label>Rate</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={selected.rate}
                onChange={(e) =>
                  updateLayer(sel, { rate: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="ctrl-row">
              <label>Cutoff</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={selected.cutoff}
                onChange={(e) =>
                  updateLayer(sel, { cutoff: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="ctrl-row">
              <label>Blending</label>
              <select
                value={selected.blending}
                onChange={(e) => updateLayer(sel, { blending: e.target.value })}
              >
                {blendingModes.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="layer-detail">
            <h3>Palette</h3>
            <PaletteEditor
              palette={selected.palette}
              ledType={ledType}
              onChange={(p) => updateLayer(sel, { palette: p })}
            />
          </div>
        </>
      )}
    </div>
  );
}
