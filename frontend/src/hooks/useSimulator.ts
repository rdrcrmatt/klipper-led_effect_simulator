import { useEffect, useRef, useState } from "react";
import SimulatorWorker from "../worker/simulator.worker?worker";

export type StripConfig = {
  led_count: number;
  layers: string | null;
};

export type InitData = {
  available_effects: string[];
  blending_modes: string[];
  strips: StripConfig[];
};

export type LedFrame = [number, number, number, number][]; // R, G, B, W

export type SimState = {
  stepper?: number;
  heater?: number;
  progress?: number;
  analog?: number;
};

type WorkerOut =
  | { type: 'ready'; availableEffects: string[]; blendingModes: string[]; strips: StripConfig[] }
  | { type: 'frame'; leds: LedFrame }
  | { type: 'error'; message: string };

export function useSimulator() {
  const workerRef = useRef<Worker | null>(null);

  const [connected,   setConnected]   = useState(false);
  const [initData,    setInitData]    = useState<InitData | null>(null);
  const [latestFrame, setLatestFrame] = useState<LedFrame | null>(null);
  const [frameCount,  setFrameCount]  = useState(0);

  useEffect(() => {
    const worker = new SimulatorWorker();
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const msg = e.data;
      if (msg.type === 'ready') {
        setConnected(true);
        setInitData({
          available_effects: msg.availableEffects,
          blending_modes:    msg.blendingModes,
          strips:            msg.strips,
        });
      } else if (msg.type === 'frame') {
        setLatestFrame(msg.leds);
        setFrameCount((n) => n + 1);
      } else if (msg.type === 'error') {
        console.error('[simulator]', msg.message);
      }
    };

    worker.onerror = (e) => console.error('[worker]', e);

    return () => { worker.terminate(); workerRef.current = null; };
  }, []);

  const sendConfig = (strips: StripConfig[]) => {
    workerRef.current?.postMessage({ type: 'config', strips });
  };

  const sendState = (state: SimState) => {
    workerRef.current?.postMessage({ type: 'state', ...state });
  };

  return { connected, initData, latestFrame, frameCount, sendConfig, sendState };
}
