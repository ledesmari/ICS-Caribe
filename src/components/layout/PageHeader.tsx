import type { ReactNode } from 'react';

/** Page subtitle + H1 + optional actions (wraps under the title on small screens). */
export function PageHeader({ title, subtitle, actions, children }: {
  title: string; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {subtitle && <p className="text-sm font-semibold text-muted">{subtitle}</p>}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl">{title}</h1>
        {actions && <div className="flex w-full items-center gap-2 sm:w-auto">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
