import { useEffect } from "react";

type Props = { onClose: () => void };

const EFFECTS: { name: string; desc: string; rate: string; cutoff: string }[] = [
  { name: "static",     desc: "All LEDs display a solid color from the palette.",                          rate: "Unused",                              cutoff: "Unused" },
  { name: "gradient",   desc: "Palette colors are spread across the strip and animate by cycling.",        rate: "Animation speed (cycles/sec)",         cutoff: "Blending sharpness" },
  { name: "breathing",  desc: "Strip fades in and out smoothly.",                                          rate: "Breaths per second",                   cutoff: "Unused" },
  { name: "blink",      desc: "Strip alternates between on and off.",                                      rate: "Blinks per second",                    cutoff: "Unused" },
  { name: "chase",      desc: "A band of color chases across the strip, looping continuously.",            rate: "Speed (LEDs/sec)",                     cutoff: "Band length (LEDs)" },
  { name: "comet",      desc: "A single dot with a fading tail flies across the strip.",                   rate: "Speed (LEDs/sec)",                     cutoff: "Tail length (LEDs)" },
  { name: "cylon",      desc: "Like chase, but the band bounces back and forth instead of looping.",       rate: "Speed (LEDs/sec)",                     cutoff: "Band length (LEDs)" },
  { name: "fire",       desc: "Simulates a fire flame rising up the strip.",                               rate: "Flame speed",                          cutoff: "Cooling rate" },
  { name: "heater",     desc: "Color reflects heater temperature — cold to hot through the palette.",      rate: "Min temperature (°C)",                cutoff: "Max temperature (°C)" },
  { name: "homing",     desc: "Flashes when the axis is homing; static otherwise.",                        rate: "Flash speed",                          cutoff: "Unused" },
  { name: "pattern",    desc: "Repeats the palette as a tiled pattern across the strip.",                  rate: "Animation speed",                      cutoff: "Pattern repeat length" },
  { name: "progress",   desc: "Indicates print progress as a marker that moves from start to end.",        rate: "Trailing LEDs (gradient behind head)", cutoff: "Leading LEDs (gradient ahead of head)" },
  { name: "stepper",    desc: "Shows stepper motor position as a dot on the strip.",                       rate: "Trailing LEDs (gradient behind head)", cutoff: "Leading LEDs (gradient ahead of head)" },
  { name: "strobe",     desc: "Rapidly flashes the strip on and off.",                                     rate: "Flashes per second",                   cutoff: "Unused" },
  { name: "twinkle",    desc: "Random LEDs twinkle on and off independently.",                             rate: "Twinkle frequency",                    cutoff: "Max LEDs lit at once" },
  { name: "analogpin",  desc: "Color reflects an analog pin voltage — low to high through the palette.",   rate: "Min voltage",                          cutoff: "Max voltage" },
];

const BLENDING: { name: string; desc: string }[] = [
  { name: "top",         desc: "This layer's non-black pixels replace the layer below." },
  { name: "bottom",      desc: "The layer below shows through — this layer is effectively behind." },
  { name: "add",         desc: "Adds RGB values together; bright colors accumulate." },
  { name: "subtract",    desc: "Subtracts this layer's values from the layer below." },
  { name: "subtract_b",  desc: "Subtracts the layer below from this layer's values." },
  { name: "difference",  desc: "Absolute difference between the two layers; creates contrast." },
  { name: "average",     desc: "Averages the two layers pixel-by-pixel." },
  { name: "multiply",    desc: "Multiplies values (0–1 × 0–1); always darkens." },
  { name: "divide",      desc: "Divides the layer below by this layer; can brighten significantly." },
  { name: "screen",      desc: "Inverse of multiply — always brightens, similar to two overlapping projectors." },
  { name: "lighten",     desc: "Keeps whichever pixel is brighter per channel." },
  { name: "darken",      desc: "Keeps whichever pixel is darker per channel." },
  { name: "overlay",     desc: "Combines multiply and screen — enhances contrast around mid-tones." },
];

export function HelpModal({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="help-backdrop" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-header">
          <span>Effect Reference</span>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>

        <div className="help-body">
          <section className="help-section">
            <h3>Effect Types</h3>
            <p className="help-note">
              Each layer runs one effect. <strong>Rate</strong> and <strong>Cutoff</strong>
              {" "}mean different things per effect type — see the table below.
              For a real-world example with multiple effects and blending,
              see the{" "}
              <a
                href="https://github.com/julianschill/klipper-led_effect/blob/master/examples/Voron_Stealthburner/stealthburner_led_effects_barf.cfg"
                target="_blank"
                rel="noreferrer"
              >Stealthburner barf example config</a>.
            </p>
            <table className="help-table">
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>Effect</th>
                  <th>Description</th>
                  <th>Rate</th>
                  <th>Cutoff</th>
                </tr>
              </thead>
              <tbody>
                {EFFECTS.map((e) => (
                  <tr key={e.name}>
                    <td className="help-preview-cell">
                      <img
                        src={`/effects/${e.name}.gif`}
                        alt={e.name}
                        className="effect-preview-img"
                        width={297}
                        height={12}
                      />
                    </td>
                    <td><code>{e.name}</code></td>
                    <td>{e.desc}</td>
                    <td className="help-dim">{e.rate}</td>
                    <td className="help-dim">{e.cutoff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="help-section">
            <h3>Blending Modes</h3>
            <p className="help-note">
              When multiple layers are stacked, blending controls how each layer
              composites on top of the one below it (bottom layer first, top layer last).
            </p>
            <table className="help-table help-table-2col">
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {BLENDING.map((b) => (
                  <tr key={b.name}>
                    <td><code>{b.name}</code></td>
                    <td>{b.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="help-section">
            <h3>About</h3>
            <p className="help-note">
              This simulator is built on top of{" "}
              <a
                href="https://github.com/julianschill/klipper-led_effect"
                target="_blank"
                rel="noreferrer"
              >klipper-led_effect</a>{" "}
              by Julian Schill. The LED effect engine runs server-side to produce
              the frames you see in the simulator.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
