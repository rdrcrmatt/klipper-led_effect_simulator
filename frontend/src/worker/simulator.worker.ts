import klippermockCode from '../py/klippermock.py?raw';

// led_effect.py is fetched directly from Julian Schill's klipper-led_effect repo.
// Pinned to a specific commit for stability. To update, change the commit hash
// below and verify the simulator still works with the new engine version.
const LED_EFFECT_URL =
  'https://raw.githubusercontent.com/julianschill/klipper-led_effect/' +
  '0f118bd9c2292f6c00fb52dd416d06910908f524/src/led_effect.py';

type InMessage =
  | { type: 'config'; strips: Array<{ led_count: number; layers: string | null }> }
  | { type: 'state'; stepper?: number; heater?: number; progress?: number; analog?: number };

type OutMessage =
  | { type: 'ready'; availableEffects: string[]; blendingModes: string[]; strips: Array<{ led_count: number; layers: string | null }> }
  | { type: 'frame'; leds: Array<[number, number, number]> }
  | { type: 'error'; message: string };

declare function postMessage(msg: OutMessage): void;

const SESSION_PY = `
import sys, types, json
import time as _time

_m = types.ModuleType('led_effect')
exec(compile(_LED_EFFECT_CODE, 'led_effect.py', 'exec'), _m.__dict__)
sys.modules['led_effect'] = _m

exec(compile(_KLIPPERMOCK_CODE, 'klippermock.py', 'exec'))

_COLORS = 4

class SessionManager:
    def __init__(self):
        self.printers = []
        self.last_frames = []

    def _create_printer(self, led_count, layers=None):
        overrides = {"ledcount": led_count}
        if layers is not None:
            overrides["layers"] = layers
        config = MockConfig(overrides)
        printer = MockPrinter(config)
        printer._handle_ready()
        printer.led_effect.set_enabled(True)
        return printer

    def rebuild(self, strips_json):
        strips = json.loads(strips_json)
        self.printers = [
            self._create_printer(s.get("led_count", 30), s.get("layers"))
            for s in strips
        ]
        self.last_frames = [
            [[0, 0, 0]] * p.led_helper.led_count for p in self.printers
        ]

    def tick(self):
        if not self.printers:
            return None
        t = _time.monotonic()
        any_updated = False
        for i, printer in enumerate(self.printers):
            led_count = printer.led_helper.led_count
            ledframe, update = printer.led_effect.getFrame(t)
            if update:
                self.last_frames[i] = [
                    [
                        min(255, int(255.0 * ledframe[j * _COLORS])),
                        min(255, int(255.0 * ledframe[j * _COLORS + 1])),
                        min(255, int(255.0 * ledframe[j * _COLORS + 2])),
                        min(255, int(255.0 * ledframe[j * _COLORS + 3])),
                    ]
                    for j in range(led_count)
                ]
                any_updated = True
        if not any_updated:
            return None
        return json.dumps([led for frame in self.last_frames for led in frame])

    def set_state(self, state_json):
        state = json.loads(state_json)
        for p in self.printers:
            if "stepper"  in state: p.set_stepper_pos(float(state["stepper"]))
            if "heater"   in state: p.set_heater(0, 300, float(state["heater"]))
            if "progress" in state: p.set_progress(float(state["progress"]))
            if "analog"   in state: p.set_analog(float(state["analog"]))

    def available_effects(self):
        from led_effect import ledEffect
        effects = sorted([
            str(c).rpartition('.layer')[2].replace("'>", "").lower()
            for c in ledEffect._layerBase.__subclasses__()
            if str(c).startswith("<class")
        ])
        return json.dumps(effects)

    def blending_modes(self):
        return json.dumps([
            'top', 'bottom', 'add', 'subtract', 'subtract_b', 'difference',
            'average', 'multiply', 'divide', 'divide_inv', 'screen',
            'lighten', 'darken', 'overlay',
        ])

    def strip_configs(self):
        return json.dumps([
            {"led_count": p.led_helper.led_count, "layers": p.config.get("layers")}
            for p in self.printers
        ])

_session = SessionManager()
`;

async function init() {
  try {
    // Fetch led_effect.py directly from Julian Schill's repo
    const ledEffectCode = await fetch(LED_EFFECT_URL).then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch led_effect.py: ${r.status}`);
      return r.text();
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – Pyodide loaded from CDN; no type declarations available
    const { loadPyodide } = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.mjs');
    const pyodide = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/',
    });

    pyodide.globals.set('_LED_EFFECT_CODE', ledEffectCode);
    pyodide.globals.set('_KLIPPERMOCK_CODE', klippermockCode);
    await pyodide.runPythonAsync(SESSION_PY);

    // Default single strip to bootstrap initData
    pyodide.globals.set('_arg', JSON.stringify([{ led_count: 30, layers: null }]));
    pyodide.runPython('_session.rebuild(_arg)');

    const availableEffects: string[] = JSON.parse(pyodide.runPython('_session.available_effects()') as string);
    const blendingModes: string[]    = JSON.parse(pyodide.runPython('_session.blending_modes()')    as string);
    const strips                     = JSON.parse(pyodide.runPython('_session.strip_configs()')     as string);

    postMessage({ type: 'ready', availableEffects, blendingModes, strips });

    self.addEventListener('message', (e: MessageEvent<InMessage>) => {
      const msg = e.data;
      try {
        if (msg.type === 'config') {
          pyodide.globals.set('_arg', JSON.stringify(msg.strips));
          pyodide.runPython('_session.rebuild(_arg)');
        } else if (msg.type === 'state') {
          pyodide.globals.set('_arg', JSON.stringify(msg));
          pyodide.runPython('_session.set_state(_arg)');
        }
      } catch (err) {
        postMessage({ type: 'error', message: String(err) });
      }
    });

    setInterval(() => {
      try {
        const result = pyodide.runPython('_session.tick()') as string | null;
        if (result !== null && result !== undefined) {
          postMessage({ type: 'frame', leds: JSON.parse(result) });
        }
      } catch (err) {
        console.error('[worker] tick error', err);
      }
    }, 16);

  } catch (err) {
    postMessage({ type: 'error', message: String(err) });
  }
}

init();
