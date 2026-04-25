import { useEffect, useMemo, useState } from "react";
import type { Strip, LedType } from "../types";
import { serializeLayers } from "../utils/layerConfig";

type Props = {
  strips: Strip[];
  ledType: LedType;
  onClose: () => void;
};

export function MacroBuilderModal({ strips, ledType, onClose }: Props) {
  const [macroName,    setMacroName]    = useState("my_effect_macro");
  const [neopixelName, setNeopixelName] = useState("my_leds");
  const [frameRate,    setFrameRate]    = useState(24);
  const [autostart,    setAutostart]    = useState(false);
  const [copied,       setCopied]       = useState(false);

  // Effect groups: keyed by layer signature
  const groups = useMemo(() => {
    const seen = new Map<string, Strip[]>();
    for (const strip of strips) {
      const sig = serializeLayers(strip.layers, ledType);
      if (!seen.has(sig)) seen.set(sig, []);
      seen.get(sig)!.push(strip);
    }
    return Array.from(seen.entries()).map(([sig, groupStrips], i) => ({ sig, groupStrips, idx: i }));
  }, [strips]);

  // Editable effect names, one per group sig
  const [effectNames, setEffectNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.map((g, i) => [g.sig, `effect_${i + 1}`]))
  );

  useEffect(() => {
    setEffectNames((prev) => {
      const next = { ...prev };
      groups.forEach((g, i) => {
        if (!(g.sig in next)) next[g.sig] = `effect_${i + 1}`;
      });
      return next;
    });
  }, [groups]);

  // LED ranges: cumulative across all strips on the one neopixel chain
  const stripRanges = useMemo(() => {
    const result: Record<string, { start: number; end: number }> = {};
    let offset = 1;
    for (const strip of strips) {
      result[strip.id] = { start: offset, end: offset + strip.count - 1 };
      offset += strip.count;
    }
    return result;
  }, [strips]);

  // Generated klipper config
  const generatedConfig = useMemo(() => {
    const totalLeds = strips.reduce((a, s) => a + s.count, 0);
    const colorOrder = ledType === "RGBW" ? "GRBW" : "GRB";

    const lines: string[] = [
      `# ── Neopixel device ─────────────────────────────────────────────`,
      `# Configure this section to match your hardware, then include it`,
      `# in your printer.cfg (or paste directly into printer.cfg).`,
      `#`,
      `# [neopixel ${neopixelName}]`,
      `# pin:                    <your data pin>`,
      `# chain_count:            ${totalLeds}`,
      `# color_order:            ${colorOrder}   # set by your LED hardware, not by this simulator`,
      `# initial_RED:            0.0`,
      `# initial_GREEN:          0.0`,
      `# initial_BLUE:           0.0`,
      ...(ledType === "RGBW" ? [`# initial_WHITE:           0.0`] : []),
      ``,
      `# ── LED effects ─────────────────────────────────────────────────`,
      ``,
    ];
    const effectList: string[] = [];

    for (const { sig, groupStrips } of groups) {
      const effectName = effectNames[sig] ?? "unnamed_effect";
      effectList.push(effectName);

      lines.push(`[led_effect ${effectName}]`);
      lines.push(`autostart:              ${autostart ? "true" : "false"}`);
      lines.push(`frame_rate:             ${frameRate}`);
      lines.push("leds:");

      const ranges = groupStrips
        .map((s) => {
          const r = stripRanges[s.id];
          if (!r) return null;
          return s.reversed ? `${r.end}-${r.start}` : `${r.start}-${r.end}`;
        })
        .filter(Boolean)
        .join(",");
      lines.push(`    neopixel:${neopixelName} (${ranges})`);

      lines.push("layers:");
      for (const layerLine of sig.split("\n").filter(Boolean)) {
        lines.push(`    ${layerLine}`);
      }
      lines.push("");
    }

    lines.push(`[gcode_macro ${macroName}]`);
    lines.push("gcode:");
    lines.push("    STOP_LED_EFFECTS");
    for (const name of effectList) {
      lines.push(`    SET_LED_EFFECT EFFECT=${name}`);
    }

    return lines.join("\n");
  }, [groups, effectNames, stripRanges, strips, neopixelName, macroName, frameRate, autostart, ledType]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedConfig).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="help-backdrop" onClick={onClose}>
      <div className="macro-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-header">
          <span>Klipper Config Builder</span>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>

        <div className="macro-body">
          {/* Global settings */}
          <section className="macro-section">
            <h3>Settings</h3>
            <div className="macro-row">
              <label>Neopixel object</label>
              <input
                type="text"
                value={neopixelName}
                onChange={(e) => setNeopixelName(e.target.value)}
                className="macro-text-input"
                style={{ maxWidth: 160 }}
                spellCheck={false}
              />
              <label style={{ marginLeft: 12 }}>Macro name</label>
              <input
                type="text"
                value={macroName}
                onChange={(e) => setMacroName(e.target.value)}
                className="macro-text-input"
                style={{ maxWidth: 200 }}
                spellCheck={false}
              />
              <label style={{ marginLeft: 12 }}>FPS</label>
              <input
                type="number"
                value={frameRate}
                min={1} max={60}
                onChange={(e) => setFrameRate(parseInt(e.target.value) || 24)}
                className="macro-number-input"
              />
              <label style={{ marginLeft: 12 }}>
                <input
                  type="checkbox"
                  checked={autostart}
                  onChange={(e) => setAutostart(e.target.checked)}
                  style={{ marginRight: 4 }}
                />
                autostart
              </label>
            </div>
          </section>

          <div className="macro-columns">
            {/* Left: strip ranges + effect groups */}
            <div className="macro-left">
              <section className="macro-section">
                <h3>LED Ranges</h3>
                <p className="macro-note">
                  Ranges are computed cumulatively across strips in order.
                </p>
                <table className="macro-table">
                  <thead>
                    <tr><th>Strip</th><th>Range</th></tr>
                  </thead>
                  <tbody>
                    {strips.map((strip) => {
                      const range = stripRanges[strip.id];
                      return (
                        <tr key={strip.id}>
                          <td>{strip.name}</td>
                          <td className="macro-range">
                            {range ? `${range.start}–${range.end}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              <section className="macro-section">
                <h3>Effect Groups</h3>
                <p className="macro-note">
                  Strips with identical layers share one{" "}
                  <code>[led_effect]</code> block.
                </p>
                <table className="macro-table">
                  <thead>
                    <tr><th>Strips</th><th>Effect Name</th></tr>
                  </thead>
                  <tbody>
                    {groups.map(({ sig, groupStrips }) => (
                      <tr key={sig}>
                        <td>{groupStrips.map((s) => s.name).join(", ")}</td>
                        <td>
                          <input
                            type="text"
                            value={effectNames[sig] ?? ""}
                            onChange={(e) =>
                              setEffectNames((prev) => ({ ...prev, [sig]: e.target.value }))
                            }
                            className="macro-text-input"
                            spellCheck={false}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>

            {/* Right: generated config */}
            <div className="macro-right">
              <section className="macro-section macro-output-section">
                <h3>Generated Config</h3>
                <textarea
                  className="macro-output"
                  value={generatedConfig}
                  readOnly
                  spellCheck={false}
                />
                <button className="macro-copy-btn" onClick={handleCopy}>
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </button>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
