import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Optional count shown after the label (filter pills). */
  count?: number;
  disabled?: boolean;
}

/**
 * Single-choice pills (radiogroup). Arrow keys move the selection, as in a native radio group.
 * Selected = navy pill with white text.
 */
export function SegmentedControl<T extends string | number>({
  options, value, onChange, label, size = 'md', className = '',
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const name = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
  // With no option selected (e.g. a value outside the options), keep the first one tabbable.
  const tabbable = options.some((o) => o.value === value) ? -1 : (enabled[0] ?? -1);

  const move = (event: KeyboardEvent, index: number) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const step = keys[event.key];
    if (!step || enabled.length === 0) return;
    event.preventDefault();
    const pos = enabled.indexOf(index);
    const next = enabled[(pos + step + enabled.length) % enabled.length];
    if (next === undefined) return;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={`${name}-${String(o.value)}`}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={o.disabled}
            tabIndex={selected || i === tabbable ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => move(e, i)}
            className={`inline-flex items-center gap-2 rounded-full border font-semibold transition-colors disabled:opacity-50 ${
              size === 'lg' ? 'min-h-12 px-5' : 'min-h-11 px-4 text-sm'
            } ${selected ? 'border-navy-700 bg-navy-700 text-white' : 'border-line bg-white text-secondary hover:bg-navy-50'}`}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={`tabular rounded-full px-2 text-xs ${selected ? 'bg-white/20' : 'bg-pending-bg text-pending'}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
