import type { ReactNode } from 'react';
import { Skeleton } from './States';

export type KpiAccent = 'navy' | 'orange' | 'red' | 'green';

const KPI_ACCENTS: Record<KpiAccent, { edge: string; tile: string }> = {
  navy: { edge: 'from-navy-300 to-navy-700', tile: 'bg-navy-50 text-navy-700' },
  orange: { edge: 'from-orange-300 to-orange-500', tile: 'bg-orange-50 text-orange-700' },
  red: { edge: 'from-red-600/50 to-red-700', tile: 'bg-red-50 text-red-700' },
  green: { edge: 'from-green-300 to-green-600', tile: 'bg-green-50 text-green-700' },
};

/** Small circular percent indicator shown in the KPI card's top-right corner. */
export function KpiRing({ ratio, label }: { ratio: number; label: string }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const pct = Math.round(ratio * 100);
  return (
    <span role="img" aria-label={`${label}: ${pct}%`} className="relative flex size-11 shrink-0 items-center justify-center">
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-navy-50" />
        <circle
          cx="22" cy="22" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(Math.max(ratio, 0), 1))}
          className={ratio > 1 ? 'stroke-red-600' : 'stroke-orange-500'}
        />
      </svg>
      <span className="tabular text-[10px] font-bold text-secondary">{pct}%</span>
    </span>
  );
}

/** Elevated KPI card: icon tile, optional corner widget, label, big value, colored edge. */
export function Kpi({ label, value, icon, accent, valueClass = '', corner, footer }: {
  label: string; value: ReactNode; icon: ReactNode; accent: KpiAccent; valueClass?: string; corner?: ReactNode; footer?: ReactNode;
}) {
  const a = KPI_ACCENTS[accent];
  return (
    <div className="relative h-full">
      {/* Colored edge peeking out behind the card's right side */}
      <span aria-hidden className={`absolute inset-y-4 -right-2 w-6 rounded-r-2xl bg-gradient-to-b ${a.edge}`} />
      <div className="relative flex h-full flex-col rounded-2xl bg-white p-5 shadow-kpi ring-1 ring-navy-900/5 transition-shadow duration-200 hover:shadow-kpi-hover">
        <div className="flex items-start justify-between gap-2">
          <span aria-hidden className={`flex size-11 items-center justify-center rounded-xl ${a.tile}`}>{icon}</span>
          {corner}
        </div>
        <p className="mt-4 text-sm font-semibold text-secondary">{label}</p>
        <p className={`tabular mt-1 text-3xl font-extrabold ${valueClass}`}>{value}</p>
        {footer && <div className="mt-auto pt-2">{footer}</div>}
      </div>
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-kpi ring-1 ring-navy-900/5" aria-hidden>
      <Skeleton className="size-11 rounded-xl" />
      <Skeleton className="mt-4 h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-16" />
    </div>
  );
}
