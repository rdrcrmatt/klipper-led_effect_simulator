import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  style?: React.CSSProperties;
  onChange: (n: number) => void;
};

/**
 * A number input that buffers keystrokes locally and only propagates to the
 * parent on blur or Enter. This prevents intermediate/empty states (e.g.
 * backspacing a field clear before typing a new value) from triggering updates.
 *
 * On blur with an empty or invalid value, the field resets to the last
 * successfully committed value.
 */
export function DeferredNumberInput({
  value, min, max, step, className, style, onChange,
}: Props) {
  const [draft, setDraft] = useState(String(value));
  const lastValid = useRef(value);

  // Keep the draft in sync when the value changes externally
  // (e.g. clicking +/- buttons while the field is not focused)
  useEffect(() => {
    setDraft(String(value));
    lastValid.current = value;
  }, [value]);

  const commit = (raw: string) => {
    const n = parseFloat(raw);
    if (!isNaN(n)) {
      const lo = min ?? -Infinity;
      const hi = max ??  Infinity;
      const clamped = Math.min(hi, Math.max(lo, n));
      lastValid.current = clamped;
      setDraft(String(clamped));
      onChange(clamped);
    } else {
      // Empty / garbage — restore last valid value without notifying parent
      setDraft(String(lastValid.current));
    }
  };

  return (
    <input
      type="number"
      className={className}
      style={style}
      value={draft}
      min={min}
      max={max}
      step={step}
      // Only update the local draft while typing — never call parent onChange
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e)    => commit(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") commit((e.target as HTMLInputElement).value); }}
    />
  );
}
