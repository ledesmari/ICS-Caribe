/** Desktop (≥ lg) filter rail: 280px card left of the calendar, collapsible to a 56px strip. */
import { useState } from 'react';
import { PanelLeftClose, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FilterSections, type FilterSectionsProps } from './FilterSections';

const STORAGE_KEY = 'epm.calendar.railCollapsed';

function readCollapsed(): boolean {
  try { return sessionStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

export function FilterRail({ activeFilters, ...props }: FilterSectionsProps & { activeFilters: number }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = (next: boolean) => {
    setCollapsed(next);
    try { sessionStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* storage unavailable: keep in memory only */ }
  };

  if (collapsed) {
    return (
      <aside aria-label="Calendar filters" className="hidden w-14 shrink-0 lg:block">
        <div className="sticky top-6 flex flex-col items-center rounded-3xl border border-line bg-white py-2">
          <Button variant="ghost" size="icon" aria-label={`Show filters${activeFilters ? ` (${activeFilters} active)` : ''}`} aria-expanded={false}
            onClick={() => toggle(false)} icon={<SlidersHorizontal className="size-5" aria-hidden />} />
          {activeFilters > 0 && <span className="tabular mt-1 rounded-full bg-navy-700 px-2 text-xs font-bold text-white" aria-hidden>{activeFilters}</span>}
        </div>
      </aside>
    );
  }

  return (
    <aside aria-label="Calendar filters" className="hidden w-[280px] shrink-0 lg:block">
      <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-3xl border border-line bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold">Filters</h2>
          <Button variant="ghost" size="icon" aria-label="Hide filters" aria-expanded onClick={() => toggle(true)}
            className="-mr-2" icon={<PanelLeftClose className="size-5" aria-hidden />} />
        </div>
        <FilterSections {...props} />
      </div>
    </aside>
  );
}
