import { useEffect, useMemo, useRef, useState } from "react";
import { useSimulator } from "./hooks/useSimulator";
import type { SimState } from "./hooks/useSimulator";
import { LedCanvas } from "./components/LedCanvas";
import { SimControls } from "./components/SimControls";
import { calcPathCoordinates } from "./utils/ledLayout";
import type { DotShape, Rotation } from "./utils/ledLayout";
import type { Layer, Strip, LedType } from "./types";
import {
  parseLayersText,
  serializeLayers,
  DEFAULT_LAYERS_TEXT,
  FALLBACK_EFFECTS,
  FALLBACK_BLENDING,
} from "./utils/layerConfig";
import "./App.css";

let _stripSeq = 0;
function newStripId() { return `strip_${Date.now()}_${_stripSeq++}`; }

function defaultStrip(index = 0): Strip {
  return {
    id: newStripId(),
    name: `Strip ${index + 1}`,
    count: 30,
    rotation: 0,
    layers: parseLayersText(DEFAULT_LAYERS_TEXT),
  };
}

export default function App() {
  const { connected, initData, latestFrame, frameCount, sendConfig, sendState } =
    useSimulator();

  // ---------------------------------------------------------------- //
  // Strips state                                                       //
  // ---------------------------------------------------------------- //

  const [strips, setStrips] = useState<Strip[]>([defaultStrip(0)]);

  const skipNextInit = useRef(false);

  // On connect / reconnect, sync strips from backend
  useEffect(() => {
    if (!initData) return;
    if (skipNextInit.current) { skipNextInit.current = false; return; }
    setStrips(
      initData.strips.map((s, i) => ({
        id: newStripId(),
        name: `Strip ${i + 1}`,
        count: s.led_count,
        rotation: 0 as Rotation,
        layers: parseLayersText(s.layers ?? DEFAULT_LAYERS_TEXT),
      }))
    );
  }, [initData]);

  const availableEffects = initData?.available_effects ?? FALLBACK_EFFECTS;
  const blendingModes    = initData?.blending_modes    ?? FALLBACK_BLENDING;

  // ---------------------------------------------------------------- //
  // Printer state                                                     //
  // ---------------------------------------------------------------- //

  const [printerState, setPrinterState] = useState<SimState>({
    stepper: 0, heater: 0, progress: 0, analog: 0,
  });

  // ---------------------------------------------------------------- //
  // Config push                                                       //
  // ---------------------------------------------------------------- //

  const pushConfig = (nextStrips: Strip[]) => {
    skipNextInit.current = true;
    sendConfig(nextStrips.map((s) => ({
      led_count: s.count,
      layers: serializeLayers(s.layers),
    })));
    sendState(printerState);
  };

  // ---------------------------------------------------------------- //
  // Strip handlers                                                    //
  // ---------------------------------------------------------------- //

  const handleAddStrip = () => {
    const next = [...strips, defaultStrip(strips.length)];
    setStrips(next);
    pushConfig(next);
  };

  const handleRemoveStrip = (id: string) => {
    if (strips.length <= 1) return;
    const next = strips.filter((s) => s.id !== id);
    setStrips(next);
    pushConfig(next);
  };

  const handleStripCountChange = (id: string, count: number) => {
    const next = strips.map((s) => (s.id === id ? { ...s, count } : s));
    setStrips(next);
    pushConfig(next);
  };

  const handleStripNameChange = (id: string, name: string) => {
    setStrips((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const handleStripRotationChange = (id: string, rotation: Rotation) => {
    // Rotation is visual-only — no backend push needed
    setStrips((prev) => prev.map((s) => (s.id === id ? { ...s, rotation } : s)));
  };

  const handleStripLayersChange = (id: string, layers: Layer[]) => {
    const next = strips.map((s) => (s.id === id ? { ...s, layers } : s));
    setStrips(next);
    pushConfig(next);
  };

  const handleStripLayersTextLoad = (id: string, text: string) => {
    const newLayers = parseLayersText(text);
    const next = strips.map((s) => (s.id === id ? { ...s, layers: newLayers } : s));
    setStrips(next);
    pushConfig(next);
  };

  const handlePrinterStateChange = (patch: Partial<SimState>) => {
    const next = { ...printerState, ...patch };
    setPrinterState(next);
    sendState(patch);
  };

  // ---------------------------------------------------------------- //
  // Display controls (local — canvas only)                           //
  // ---------------------------------------------------------------- //

  const [shape, setShape]       = useState<DotShape>("Circle");
  const [ledSize, setLedSize]   = useState(14);
  const [distance, setDistance] = useState(36);
  const [ledType, setLedType]   = useState<LedType>("RGB");

  // ---------------------------------------------------------------- //
  // Sidebar resize                                                    //
  // ---------------------------------------------------------------- //

  const [sidebarWidth, setSidebarWidth] = useState(300);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) =>
      setSidebarWidth(Math.max(240, Math.min(560, startW - (ev.clientX - startX))));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ---------------------------------------------------------------- //
  // Coordinates                                                       //
  // ---------------------------------------------------------------- //

  const coordinates = useMemo(
    () => calcPathCoordinates(ledSize, distance, strips.map((s) => ({ count: s.count, rotation: s.rotation }))),
    [strips, ledSize, distance]
  );

  // ---------------------------------------------------------------- //
  // Render                                                            //
  // ---------------------------------------------------------------- //

  return (
    <div className="app">
      <header className="app-header">
        <h1>LED Effect Simulator</h1>
        <span className={`status-pill ${connected ? "on" : "off"}`}>
          {connected ? "● ready" : "○ loading…"}
        </span>
      </header>

      <div className="app-body">
        <main className="canvas-pane">
          <LedCanvas
            coordinates={coordinates}
            frame={latestFrame}
            shape={shape}
            ledType={ledType}
            frameCount={frameCount}
          />
        </main>

        <div className="controls-wrapper" style={{ width: sidebarWidth }}>
          <div className="resize-handle" onMouseDown={startResize} />
          <SimControls
            strips={strips}
            shape={shape}
            ledSize={ledSize}
            distance={distance}
            ledType={ledType}
            availableEffects={availableEffects}
            blendingModes={blendingModes}
            frameCount={frameCount}
            printerState={printerState}
            onPrinterStateChange={handlePrinterStateChange}
            onAddStrip={handleAddStrip}
            onRemoveStrip={handleRemoveStrip}
            onStripNameChange={handleStripNameChange}
            onStripCountChange={handleStripCountChange}
            onStripRotationChange={handleStripRotationChange}
            onStripLayersChange={handleStripLayersChange}
            onStripLayersTextLoad={handleStripLayersTextLoad}
            onShapeChange={setShape}
            onLedSizeChange={setLedSize}
            onDistanceChange={setDistance}
            onLedTypeChange={setLedType}
          />
        </div>
      </div>
    </div>
  );
}
