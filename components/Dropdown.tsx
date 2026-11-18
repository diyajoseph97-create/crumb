// Underlined dropdown filter ("All times ▾") with multi-select checkboxes.
import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui";

type Option = { value: string; label: string };

export function Dropdown({
  allLabel, options, selected, onChange,
}: { allLabel: string; options: Option[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const label =
    selected.length === 0
      ? allLabel
      : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? allLabel
      : `${options.find((o) => o.value === selected[0])?.label} +${selected.length - 1}`;

  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <div className={`dd ${open ? "open" : ""} ${selected.length ? "has" : ""}`} ref={ref}>
      <button type="button" className="dd-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox">
        <span className="dd-label">{label}</span>
        <Icon name="down" size={18} className="dd-chev" />
      </button>
      {open && (
        <div className="dd-pop" role="listbox" aria-multiselectable="true">
          {options.map((o) => (
            <label key={o.value} className="dd-opt">
              <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <button type="button" className="dd-clear" onClick={() => onChange([])}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
