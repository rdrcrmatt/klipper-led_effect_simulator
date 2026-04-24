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
import {
  readShareParam,
  decodeState,
  buildShareUrl,
  makeShareableState,
  stripsFromShareable,
} from "./utils/shareState";
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

// Decode share param once at module load (before any React state)
const _sharedState = (() => {
  const param = readShareParam();
  return param ? decodeState(param) : null;
})();

export default function App() {
  const { connected, initData, latestFrame, frameCount, sendConfig, sendState } =
    useSimulator();

  // ---------------------------------------------------------------- //
  // Display controls — initialized from share state if present        //
  // ---------------------------------------------------------------- //

  const [shape,    setShape]    = useState<DotShape>(_sharedState?.shape    ?? "Circle");
  const [ledSize,  setLedSize]  = useState(          _sharedState?.ledSize  ?? 14);
  const [distance, setDistance] = useState(          _sharedState?.distance ?? 36);
  const [ledType,  setLedType]  = useState<LedType>( _sharedState?.ledType  ?? "RGB");

  // ---------------------------------------------------------------- //
  // Strips state — initialized from share state if present            //
  // ---------------------------------------------------------------- //

  const [strips, setStrips] = useState<Strip[]>(() =>
    _sharedState ? stripsFromShareable(_sharedState.strips) : [defaultStrip(0)]
  );

  // Skip the first initData sync if we loaded from a share link
  // (we'll push our own config once connected instead)
  const skipNextInit = useRef(_sharedState !== null);

  // On connect / reconnect, sync strips from backend (unless overridden)
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

  const pushConfig = (nextStrips: Strip[], type: LedType = ledType) => {
    skipNextInit.current = true;
    sendConfig(nextStrips.map((s) => ({
      led_count: s.count,
      layers: serializeLayers(s.layers, type),
    })));
    sendState(printerState);
  };

  // When Pyodide finishes loading, push share-state config to the engine
  useEffect(() => {
    if (!connected || !_sharedState) return;
    pushConfig(strips, _sharedState.ledType);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

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

  const handleLedTypeChange = (t: LedType) => {
    setLedType(t);
    pushConfig(strips, t);
  };

  // ---------------------------------------------------------------- //
  // Share                                                             //
  // ---------------------------------------------------------------- //

  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = () => {
    const url = buildShareUrl(
      makeShareableState(strips, ledType, shape, ledSize, distance)
    );
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

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
        <div className="header-spacer" />
        <button
          className={`share-btn${shareCopied ? " copied" : ""}`}
          onClick={handleShare}
          title="Copy shareable link to clipboard"
        >
          {shareCopied ? "✓ Copied!" : "⎘ Share"}
        </button>
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
            onLedTypeChange={handleLedTypeChange}
          />
        </div>
      </div>
    </div>
  );
}
