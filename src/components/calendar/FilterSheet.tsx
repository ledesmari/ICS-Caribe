/** Mobile (< lg) filters: "Filters · N" pill → bottom sheet (Dialog: focus trap, Esc, Done). */
import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { NO_TEMPLATE } from '@/hooks/useCalendarParams';
import { colorForTemplate } from '@/utils/templateColors';
import { FilterSections, type FilterSectionsProps } from './FilterSections';

export function FilterSheet({ activeFilters, ...props }: FilterSectionsProps & { activeFilters: number }) {
  const [open, setOpen] = useState(false);
  const { params, templates, setFilters } = props;
  const selected = params.templates ?? [];
  const chipFor = (id: string) => {
    const t = templates.find((x) => x.id === id);
    return id === NO_TEMPLATE ? { name: 'No template', color: colorForTemplate(null) } : t ? { name: t.name, color: colorForTemplate(t) } : null;
  };

  return (
    <div className="lg:hidden">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setOpen(true)}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-navy-700 px-4 text-sm font-semibold text-white">
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters{activeFilters > 0 && <span className="tabular"> · {activeFilters}</span>}
        </button>
        {selected.map((id) => {
          const chip = chipFor(id);
          if (!chip) return null;
          return (
            <span key={id} className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full pl-3 text-sm font-semibold ${chip.color.bg} ${chip.color.text}`}>
              <span className={`size-2.5 rounded-full ${chip.color.solid}`} aria-hidden />
              {chip.name}
              <button type="button" aria-label={`Remove ${chip.name} filter`} className="flex size-11 items-center justify-center rounded-full"
                onClick={() => { const next = selected.filter((x) => x !== id); setFilters({ templates: next.length ? next : null }); }}>
                <X className="size-4" aria-hidden />
              </button>
            </span>
          );
        })}
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title="Filters" variant="sheet"
        footer={<Button variant="secondary" className="w-full justify-center sm:w-auto" onClick={() => setOpen(false)}>Done</Button>}>
        <FilterSections {...props} />
      </Dialog>
    </div>
  );
}
