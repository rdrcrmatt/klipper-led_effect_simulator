import { useEffect, useRef } from "react";

const WS_URL = `ws://${window.location.host}/ws`;

const LED_N   = 20;
const DOT     = 8;
const GAP     = 2;
const STEP    = DOT + GAP;
const W       = LED_N * STEP - GAP;
const H       = DOT;

type StateMsg = { stepper?: number; heater?: number; progress?: number; analog?: number };

export type PreviewDef = {
  layers: string;
  state?: StateMsg;
  /** When set, cycles the named state value from min→max→min at the given step-per-frame rate. */
  cycle?: { key: keyof StateMsg; min: number; max: number; step: number };
};

function draw(canvas: HTMLCanvasElement, leds: [number, number, number][]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#0d0d0f";
  ctx.fillRect(0, 0, W, H);
  leds.forEach(([r, g, b], i) => {
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.roundRect(i * STEP, 0, DOT, H, 2);
    ctx.fill();
  });
}

export function EffectPreview({ layers, state, cycle }: PreviewDef) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef   = useRef<HTMLDivElement>(null);
  const wsRef     = useRef<WebSocket | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let cycleVal  = cycle?.min ?? 0;
    let direction = 1;
    let timer: ReturnType<typeof setInterval> | null = null;

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "update_config", led_count: LED_N, layers }));
        if (state) ws.send(JSON.stringify({ type: "set_state", ...state }));

        if (cycle) {
          timer = setInterval(() => {
            if (ws.readyState !== WebSocket.OPEN) return;
            ws.send(JSON.stringify({ type: "set_state", [cycle.key]: Math.round(cycleVal) }));
            cycleVal += direction * cycle.step;
            if (cycleVal >= cycle.max) { cycleVal = cycle.max; direction = -1; }
            if (cycleVal <= cycle.min) { cycleVal = cycle.min; direction =  1; }
          }, 50);
        }
      };

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data as string);
        if (msg.type === "frame" && canvasRef.current) {
          draw(canvasRef.current, msg.leds as [number, number, number][]);
        }
      };
    }

    function disconnect() {
      if (timer) { clearInterval(timer); timer = null; }
      wsRef.current?.close();
      wsRef.current = null;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !wsRef.current) connect();
      if (!entry.isIntersecting) disconnect();
    }, { threshold: 0 });

    observer.observe(root);
    return () => { observer.disconnect(); disconnect(); };
  }, [layers, state, cycle]);

  return (
    <div ref={rootRef} className="effect-preview-wrap">
      <canvas ref={canvasRef} width={W} height={H} className="effect-preview-canvas" />
    </div>
  );
}
