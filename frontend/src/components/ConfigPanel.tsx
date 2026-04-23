import { useEffect, useRef, useState } from "react";

type Props = {
  layersText: string;
  onLoad: (layersText: string) => void;
  label?: string;
};

export function ConfigPanel({ layersText, onLoad, label = "Layers Config" }: Props) {
  const [localText, setLocalText] = useState(layersText);
  const [copied, setCopied]       = useState(false);
  const lastSynced                = useRef(layersText);

  useEffect(() => {
    if (localText === lastSynced.current) {
      setLocalText(layersText);
    }
    lastSynced.current = layersText;
  }, [layersText]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalText(e.target.value);
  };

  const handleLoad = () => {
    onLoad(localText);
    lastSynced.current = localText;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(localText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <section className="config-panel">
      <h3>{label}</h3>
      <textarea
        className="config-textarea"
        value={localText}
        onChange={handleChange}
        spellCheck={false}
        rows={8}
      />
      <div className="config-actions">
        <button onClick={handleCopy}>{copied ? "Copied!" : "Copy to Clipboard"}</button>
        <button onClick={handleLoad}>Load</button>
      </div>
    </section>
  );
}
