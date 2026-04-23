"""
Minimal Klipper mock layer for the LED effect simulator.

Replaces the wxPython desktop simulator's klippermock.py with a clean version
that has no GUI dependencies and correctly implements the interface expected by
led_effect.py (including led_state/transmit on the LED helper, proper reactor
constants, and correct boolean parsing).
"""

import time as _time
from led_effect import ledEffect, ledFrameHandler

# Klipper uses this sentinel for "schedule never" in its reactor
REACTOR_NEVER = 9999999999999.9


class MockPrinter:
    """
    Stands in for Klipper's printer/reactor object.

    Acts as both the printer AND the reactor (get_reactor returns self) to
    match what the original klippermock did.  All timer/command registrations
    are no-ops; state updates are applied directly via the set_* helpers.
    """

    NOW   = 0
    NEVER = REACTOR_NEVER

    def __init__(self, config: "MockConfig"):
        self.config = config
        config.set_printer(self)

        # LED helper is stored here so lookup_object("anything") can return
        # self and callers that then access .led_helper still work.
        self.led_helper = MockLedHelper(config)

        self.objects: dict = {}
        self.temp = (0.0, 0.0)
        self.axes_max = [100, 100, 100]
        self.axes_min = [0, 0, 0]

        # ledEffect.__init__ calls load_object("led_effect") which creates the
        # handler and registers it in self.objects.  ledEffect itself is stored
        # as "myeffect" so _handle_ready iterates both.
        self.led_effect = ledEffect(config)
        self.objects["myeffect"] = self.led_effect

    def _handle_ready(self):
        # ledFrameHandler._handle_ready() must run first because it sets
        # handler.reactor (= self); ledEffect._handle_ready() reads that.
        handler = self.objects.get("led_effect")
        if handler:
            handler._handle_ready()
        for name, obj in self.objects.items():
            if name != "led_effect":
                obj._handle_ready()

    # ------------------------------------------------------------------ #
    # Printer / reactor interface expected by led_effect.py               #
    # ------------------------------------------------------------------ #

    def lookup_object(self, name):
        return self

    def load_object(self, config, name):
        if name in self.objects:
            return self.objects[name]
        if name == "led_effect":
            handler = ledFrameHandler(config)
            self.objects["led_effect"] = handler
            return handler
        # Everything else (gcode, heaters, buttons, query_adc, …) is mocked
        # by returning self; all methods the engine calls on those objects are
        # defined as no-ops below.
        return self

    def get_reactor(self):
        return self

    def monotonic(self):
        return _time.monotonic()

    def config_error(self, msg):
        return Exception(msg)

    def register_event_handler(self, event, callback): pass
    def register_mux_command(self, cmd, key, name, callback, desc): pass
    def register_command(self, cmd, callback, desc=None): pass
    def register_timer(self, callback, when): pass
    def register_buttons(self, pins, callback): pass

    # Heater mock
    def lookup_heater(self, name):
        return self

    def get_temp(self, eventtime):
        return self.temp

    # Kinematics mock (used by stepper polling – never actually invoked since
    # register_timer is a no-op, but needed if called directly)
    def get_kinematics(self):
        return self

    # ADC / pin mock
    def setup_pin(self, pin_type, pin_params):
        return self

    def setup_adc_sample(self, sample_time, sample_count): pass
    def setup_minmax(self, sample_time, sample_count): pass
    def setup_adc_callback(self, report_time, callback): pass
    def register_adc(self, name, mcu): pass

    # gcode_macro mock – used to evaluate the "layers" config as a template
    def load_template(self, config, name):
        self._template_value = config.get(name)
        return self

    def render(self, context=None):
        return self._template_value

    def create_template_context(self):
        return {"printer": self}

    # display_status mock
    def get_status(self, eventtime):
        return {"progress": None}

    # ------------------------------------------------------------------ #
    # State setters called from the WebSocket message handler             #
    # ------------------------------------------------------------------ #

    def set_stepper_pos(self, pos: float):
        self.led_effect.handler.stepperPositions = [pos, pos, pos]

    def set_heater(self, min_val: float, max_val: float, current: float):
        h = self.led_effect.handler
        h.heaterLast["heater_bed"]    = h.heaterCurrent.get("heater_bed", 0.0)
        h.heaterCurrent["heater_bed"] = current
        h.heaterTarget["heater_bed"]  = max_val

    def set_progress(self, progress: float):
        self.led_effect.handler.printProgress = int(progress)

    def set_analog(self, value: float):
        self.led_effect.analogValue = value


class MockConfig:
    """
    Minimal stand-in for Klipper's ConfigWrapper.

    Accepts an optional dict of overrides so the WebSocket handler can spin up
    per-connection sessions with different LED counts / layer configs.
    """

    _DEFAULTS = {
        "frame_rate":   "24.0",
        "autostart":    "false",
        "run_on_error": "false",
        "recalculate":  "false",
        "layers":       "gradient 1 1 top (1.0,0.0,0.0),(0.0,1.0,0.0),(0.0,0.0,1.0)",
        "leds":         "leds:leds",
        "ledcount":     "30",
        "heater":       "heater_bed",
    }

    def __init__(self, overrides: dict | None = None):
        self._data = dict(self._DEFAULTS)
        if overrides:
            self._data.update({k: str(v) for k, v in overrides.items()})

    def set_printer(self, printer):
        self._printer = printer

    def get_printer(self):
        return self._printer

    def get_name(self):
        return "led_effect simulator"

    def get_object(self, name):
        return self

    def get(self, key, default=None):
        return self._data.get(key, default)

    def set(self, key, value):
        self._data[key] = str(value)

    def getfloat(self, key, default=0.0, minval=None, maxval=None):
        val = float(self._data.get(key, default))
        if minval is not None:
            val = max(float(minval), val)
        if maxval is not None:
            val = min(float(maxval), val)
        return val

    def getint(self, key, default=0, minval=None, maxval=None):
        val = int(self._data.get(key, default))
        if minval is not None:
            val = max(int(minval), val)
        if maxval is not None:
            val = min(int(maxval), val)
        return val

    def getboolean(self, key, default=False):
        raw = self._data.get(key, str(default))
        return str(raw).lower() in ("true", "1", "yes")

    def getlist(self, key, default=None):
        val = self._data.get(key)
        if val is None:
            return default
        return [x.strip() for x in val.split(",") if x.strip()]


class MockLedHelper:
    """
    Stands in for Klipper's NeoPixel / DotStar LED helper.

    The engine's ledFrameHandler._getFrames() reads and writes led_state and
    calls _check_transmit(); we implement the minimum surface so those calls
    succeed without actually driving any hardware.
    """

    def __init__(self, config: MockConfig):
        self.led_count = config.getint("ledcount", 30, 1, 1024)
        self.led_state: list[tuple] = [(0.0, 0.0, 0.0, 0.0)] * self.led_count
        self.need_transmit = False

    def get_led_count(self) -> int:
        return self.led_count

    def set_color(self, index, color):
        if index is None:
            self.led_state = [color] * self.led_count
        else:
            self.led_state[index] = color

    def _check_transmit(self): pass
    def check_transmit(self, print_time): pass
