#!/usr/bin/env python3
"""
Generate animated GIF previews for each LED effect.

Drives the engine directly (no WebSocket) with a fake monotonic clock so it
runs instantly — no real-time sleep needed.

Output: ../frontend/public/effects/<name>.gif
"""
import sys, pathlib, time as _time

sys.path.insert(0, str(pathlib.Path(__file__).parent))

from klippermock import MockConfig, MockPrinter
from led_effect import COLORS
from PIL import Image, ImageDraw

# ── canvas geometry ───────────────────────────────────────────────────────── #
LED_N   = 20
DOT     = 12          # px per LED (square)
GAP     = 3           # px between LEDs
STEP    = DOT + GAP   # 15 px
IMG_W   = LED_N * STEP - GAP   # 297 px
IMG_H   = DOT                  # 12 px
BG      = (13, 13, 15)         # #0d0d0f

# ── capture settings ─────────────────────────────────────────────────────── #
SIM_FPS  = 24          # rate we drive the engine
GIF_FPS  = 12          # rate we record (every other sim frame)
DURATION = 3.0         # seconds of animation to capture

# ── effect definitions ────────────────────────────────────────────────────── #
def cycle(key, lo, hi, period=2.5):
    """Return a state_fn that linearly triangles `key` between lo and hi."""
    def fn(printer, t):
        phase = (t % period) / period
        val = lo + (hi - lo) * (1 - abs(2 * phase - 1))
        if   key == "stepper":  printer.set_stepper_pos(val)
        elif key == "progress": printer.set_progress(val)
        elif key == "analog":   printer.set_analog(val)
        elif key == "heater":   printer.set_heater(0, 300, val)
    return fn

EFFECTS = [
    dict(name="static",    layers="static 1 0 top (0.8,0.2,1.0)"),
    dict(name="gradient",  layers="gradient 1 1 top (1.0,0.0,0.0),(0.0,1.0,0.0),(0.0,0.0,1.0)"),
    dict(name="breathing", layers="breathing 1 0 top (0.0,0.5,1.0)"),
    dict(name="blink",     layers="blink 2 0 top (1.0,0.5,0.0)"),
    dict(name="chase",     layers="chase 1 3 top (1.0,0.0,0.5),(0.0,0.5,1.0)"),
    dict(name="comet",     layers="comet 1 5 top (1.0,1.0,1.0)"),
    dict(name="fire",      layers="fire 45 40 top (0.0,0.0,0.0),(1.0,0.0,0.0),(1.0,0.5,0.0),(1.0,1.0,0.0)"),
    dict(name="heater",    layers="heater 0 200 top (0.0,0.0,1.0),(0.0,1.0,0.0),(1.0,0.0,0.0)",
         state_fn=cycle("heater", 0, 200)),
    dict(name="homing",    layers="homing 2 0 top (1.0,1.0,1.0)"),
    dict(name="pattern",   layers="pattern 1 0 top (1.0,0.0,0.0),(0.0,1.0,0.0),(0.0,0.0,1.0)"),
    dict(name="progress",  layers="progress 3 1 top (1.0,1.0,1.0),(1.0,0.5,0.0)",
         state_fn=cycle("progress", 0, 100)),
    dict(name="cylon",     layers="cylon 1 3 top (1.0,0.0,0.0)"),
    dict(name="strobe",    layers="strobe 4 0 top (1.0,1.0,1.0)"),
    dict(name="stepper",   layers="stepper 3 1 top (1.0,1.0,1.0),(0.0,0.5,1.0)",
         state_fn=cycle("stepper", 0, 100)),
    dict(name="twinkle",   layers="twinkle 2 5 top (1.0,1.0,1.0)"),
    dict(name="analogpin", layers="analogpin 0 100 top (0.0,0.0,1.0),(0.0,1.0,0.0),(1.0,0.0,0.0)",
         state_fn=cycle("analog", 0, 100)),
]

# ── helpers ───────────────────────────────────────────────────────────────── #

def make_printer(layers: str) -> MockPrinter:
    cfg = MockConfig({"ledcount": str(LED_N), "layers": layers})
    p = MockPrinter(cfg)
    p._handle_ready()
    p.led_effect.set_enabled(True)
    return p


def leds_from_frame(ledframe) -> list[tuple[int, int, int]]:
    return [
        (
            min(255, int(255.0 * ledframe[i * COLORS])),
            min(255, int(255.0 * ledframe[i * COLORS + 1])),
            min(255, int(255.0 * ledframe[i * COLORS + 2])),
        )
        for i in range(LED_N)
    ]


def render_pil(leds: list[tuple[int, int, int]]) -> Image.Image:
    img = Image.new("RGB", (IMG_W, IMG_H), BG)
    draw = ImageDraw.Draw(img)
    for i, (r, g, b) in enumerate(leds):
        x = i * STEP
        draw.rectangle([x, 0, x + DOT - 1, IMG_H - 1], fill=(r, g, b))
    return img


def capture(name: str, layers: str, state_fn=None) -> list[Image.Image]:
    printer = make_printer(layers)
    effect  = printer.led_effect

    n_sim   = int(DURATION * SIM_FPS)
    keep_every = SIM_FPS // GIF_FPS      # every 2nd frame
    gif_frames: list[Image.Image] = []

    for i in range(n_sim):
        t = i / SIM_FPS
        if state_fn:
            state_fn(printer, t)
        ledframe, _ = effect.getFrame(t)
        if i % keep_every == 0:
            gif_frames.append(render_pil(leds_from_frame(ledframe)))

    print(f"  {name}: {len(gif_frames)} frames")
    return gif_frames


def save_gif(frames: list[Image.Image], path: pathlib.Path):
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        loop=0,
        duration=int(1000 / GIF_FPS),   # ms per frame
        optimize=False,
    )


# ── main ──────────────────────────────────────────────────────────────────── #

if __name__ == "__main__":
    out_dir = pathlib.Path(__file__).parent.parent / "frontend" / "public" / "effects"
    out_dir.mkdir(parents=True, exist_ok=True)

    for spec in EFFECTS:
        name     = spec["name"]
        layers   = spec["layers"]
        state_fn = spec.get("state_fn")
        print(f"Generating {name}…")
        frames = capture(name, layers, state_fn)
        save_gif(frames, out_dir / f"{name}.gif")
        print(f"  → {out_dir / (name + '.gif')}")

    print(f"\nDone. {len(EFFECTS)} GIFs written to {out_dir}")
