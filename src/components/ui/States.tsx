/** Loading skeletons, empty states and error states (with retry) for every data view. */
import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { errorMessage } from '@/utils/format';

export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-xl bg-line ${className}`} />;
}

/** Wraps skeleton content so screen readers hear "Loading…" once. */
export function LoadingRegion({ label = 'Loading', children }: { label?: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

export function EmptyState({ title, description, icon, action }: {
  title: string; description?: ReactNode; icon?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-navy-50 text-navy-700" aria-hidden>
        {icon ?? <Inbox className="size-6" />}
      </span>
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-1 max-w-md text-secondary">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Couldn't load this" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-3xl border border-red-50 bg-white px-6 py-10 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-red-50 text-red-700" aria-hidden>
        <AlertTriangle className="size-6" />
      </span>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-1 max-w-md break-words text-sm text-red-700">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry} icon={<RefreshCw className="size-4" aria-hidden />}>
          Try again
        </Button>
      )}
    </div>
  );
}
