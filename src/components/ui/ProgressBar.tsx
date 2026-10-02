const TONES = { navy: 'bg-navy-700', orange: 'bg-orange-500', green: 'bg-green-600', red: 'bg-red-600' } as const;
export type ProgressTone = keyof typeof TONES;

/** Accessible progress bar. `label` is read by screen readers. */
export function ProgressBar({ value, max, tone = 'navy', label, className = '' }: {
  value: number; max: number; tone?: ProgressTone; label: string; className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={`h-2 w-full overflow-hidden rounded-full bg-pending-bg ${className}`}
    >
      <div className={`h-full rounded-full ${TONES[tone]} transition-[width]`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export interface Segment {
  key: string;
  label: string;
  value: number;
  /** Tailwind bg-* class */
  colorClass: string;
}

/** Stacked bar (e.g. budget by category). Pair it with a visible legend. */
export function StackedBar({ segments, max, label }: { segments: Segment[]; max: number; label: string }) {
  const total = Math.max(max, segments.reduce((s, x) => s + x.value, 0));
  return (
    <div role="img" aria-label={label} className="flex h-3 w-full overflow-hidden rounded-full bg-pending-bg">
      {total > 0 &&
        segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.key} className={`h-full ${s.colorClass}`} style={{ width: `${(s.value / total) * 100}%` }} title={s.label} />
        ))}
    </div>
  );
}
