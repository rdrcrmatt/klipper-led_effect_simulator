"""
LED Effect Simulator — FastAPI WebSocket backend.

Each WebSocket connection gets its own isolated simulation session.
Multiple strips are supported — each strip has its own MockPrinter instance.

Protocol
--------
Server → client:
  {"type": "init",  "available_effects": [...], "blending_modes": [...],
                    "strips": [{"led_count": N, "layers": "..."}, ...]}
  {"type": "frame", "leds": [[r,g,b], ...]}   (strips concatenated; only when updated)

Client → server:
  {"type": "update_config", "strips": [{"led_count": N, "layers": "..."}, ...]}
  {"type": "set_state",     "stepper": 0-100, "heater": 0-300,
                             "progress": 0-100, "analog": 0-100}
"""

import asyncio
import json
import time
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from klippermock import MockConfig, MockPrinter

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

COLORS      = 4   # RGBA per LED in the engine's flat frame buffer
DEFAULT_FPS = 24

DEFAULT_STRIPS = [{"led_count": 30, "layers": None}]


# --------------------------------------------------------------------------- #
# Per-strip helpers                                                            #
# --------------------------------------------------------------------------- #

def create_printer(led_count: int = 30, layers: str | None = None) -> MockPrinter:
    overrides: dict = {"ledcount": led_count}
    if layers is not None:
        overrides["layers"] = layers
    config  = MockConfig(overrides)
    printer = MockPrinter(config)
    printer._handle_ready()
    printer.led_effect.set_enabled(True)
    return printer


def create_printers(strips: list[dict]) -> list[MockPrinter]:
    return [create_printer(s.get("led_count", 30), s.get("layers")) for s in strips]


def extract_frame(printer: MockPrinter) -> list[list[int]] | None:
    led_count        = printer.led_helper.led_count
    ledframe, update = printer.led_effect.getFrame(time.monotonic())
    if not update:
        return None
    return [
        [
            min(255, int(255.0 * ledframe[i * COLORS])),
            min(255, int(255.0 * ledframe[i * COLORS + 1])),
            min(255, int(255.0 * ledframe[i * COLORS + 2])),
        ]
        for i in range(led_count)
    ]


# --------------------------------------------------------------------------- #
# Session state                                                                #
# --------------------------------------------------------------------------- #

class SessionState:
    def __init__(self, printers: list[MockPrinter]):
        self.printers = printers
        self._reset_frames()

    def _reset_frames(self):
        self.last_frames: list[list[list[int]]] = [
            [[0, 0, 0]] * p.led_helper.led_count for p in self.printers
        ]

    def rebuild(self, strips: list[dict]):
        self.printers = create_printers(strips)
        self._reset_frames()

    def apply_state(self, msg: dict):
        for p in self.printers:
            if "stepper"  in msg: p.set_stepper_pos(float(msg["stepper"]))
            if "heater"   in msg: p.set_heater(0, 300, float(msg["heater"]))
            if "progress" in msg: p.set_progress(float(msg["progress"]))
            if "analog"   in msg: p.set_analog(float(msg["analog"]))


# --------------------------------------------------------------------------- #
# App                                                                          #
# --------------------------------------------------------------------------- #

app = FastAPI(title="LED Effect Simulator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    logger.info("Client connected")

    state = SessionState(create_printers(DEFAULT_STRIPS))

    async def _send_init():
        first  = state.printers[0]
        effect = first.led_effect
        await ws.send_json({
            "type":              "init",
            "available_effects": sorted(effect.availableLayers.keys()),
            "blending_modes":    list(effect.blendingModes.keys()),
            "strips": [
                {"led_count": p.led_helper.led_count, "layers": p.config.get("layers")}
                for p in state.printers
            ],
        })

    await _send_init()

    async def frame_loop():
        interval = 1.0 / DEFAULT_FPS
        while True:
            try:
                any_updated = False
                for i, printer in enumerate(state.printers):
                    if i >= len(state.last_frames):
                        continue
                    leds = extract_frame(printer)
                    if leds is not None:
                        state.last_frames[i] = leds
                        any_updated = True
                if any_updated:
                    combined = [led for frame in state.last_frames for led in frame]
                    await ws.send_json({"type": "frame", "leds": combined})
            except Exception:
                logger.exception("Error in frame_loop")
            await asyncio.sleep(interval)

    loop_task = asyncio.create_task(frame_loop())

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("Received non-JSON message, ignoring")
                continue

            msg_type = msg.get("type")

            if msg_type == "update_config":
                strips = msg.get("strips", DEFAULT_STRIPS)
                try:
                    state.rebuild(strips)
                except Exception as exc:
                    await ws.send_json({"type": "error", "message": str(exc)})
                    continue
                await _send_init()

            elif msg_type == "set_state":
                state.apply_state(msg)

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception:
        logger.exception("WebSocket error")
    finally:
        loop_task.cancel()
