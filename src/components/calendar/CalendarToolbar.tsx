/** Toolbar card: prev/next, window title, Today, view switcher, result count and active-filter chips. */
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DEFAULT_STATUSES, NO_TEMPLATE, type CalendarFilterPatch, type CalendarParams } from '@/hooks/useCalendarParams';
import type { DateOnly, EventTemplate } from '@/types/entities';
import { shiftWindow, type CalendarView, type CalendarWindow, type CustomRange } from '@/utils/calendarWindow';
import { todayDateOnly } from '@/utils/dates';
import { EVENT_STATUS_LABEL, pluralize } from '@/utils/format';

type PickableView = Exclude<CalendarView, 'custom'>;
const VIEW_OPTIONS: { value: PickableView; label: string }[] = [
  { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'quarter', label: 'Quarter' }, { value: 'year', label: 'Year' },
];
const STEP_NOUN: Record<CalendarView, string> = { week: 'week', month: 'month', quarter: 'quarter', year: 'year', custom: 'period' };

interface ActiveChip {
  key: string;
  label: string;
  clear: CalendarFilterPatch;
}

/** One removable chip per non-default filter (one per selected template). */
function activeChips(params: CalendarParams, templates: EventTemplate[]): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (params.templates !== null) {
    if (params.templates.length === 0) chips.push({ key: 'tpl-none-selected', label: 'No templates selected', clear: { templates: null } });
    for (const id of params.templates) {
      const name = id === NO_TEMPLATE ? 'No template' : templates.find((t) => t.id === id)?.name;
      if (!name) continue;
      const rest = params.templates.filter((x) => x !== id);
      chips.push({ key: `tpl-${id}`, label: `Template: ${name}`, clear: { templates: rest.length ? rest : null } });
    }
  }
  const statusChanged = params.statuses.length !== DEFAULT_STATUSES.length || params.statuses.some((s) => !DEFAULT_STATUSES.includes(s));
  if (statusChanged) chips.push({ key: 'status', label: `Status: ${params.statuses.map((s) => EVENT_STATUS_LABEL[s]).join(', ')}`, clear: { statuses: DEFAULT_STATUSES } });
  if (params.location.trim()) chips.push({ key: 'loc', label: `Location: ${params.location.trim()}`, clear: { location: '' } });
  if (params.overdueOnly) chips.push({ key: 'overdue', label: 'With overdue tasks', clear: { overdueOnly: false } });
  if (params.mineOnly) chips.push({ key: 'mine', label: 'Where I have tasks', clear: { mineOnly: false } });
  if (params.query.trim()) chips.push({ key: 'q', label: `Search: “${params.query.trim()}”`, clear: { query: '' } });
  return chips;
}

export function CalendarToolbar({ params, window, count, isPending, templates, navigate, setFilters }: {
  params: CalendarParams;
  window: CalendarWindow;
  count: number;
  isPending: boolean;
  templates: EventTemplate[];
  navigate: (next: { view?: CalendarView; date?: DateOnly; custom?: CustomRange | null }) => void;
  setFilters: (patch: CalendarFilterPatch) => void;
}) {
  const noun = STEP_NOUN[params.view];
  const shift = (step: 1 | -1) => {
    const next = shiftWindow(params.view, params.date, step, params.custom);
    navigate({ date: next.anchor, custom: next.custom });
  };
  const today = todayDateOnly();
  const chips = activeChips(params, templates);

  return (
    <div className="rounded-3xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label={`Previous ${noun}`} onClick={() => shift(-1)} icon={<ChevronLeft className="size-5" aria-hidden />} />
          <Button variant="outline" size="icon" aria-label={`Next ${noun}`} onClick={() => shift(1)} icon={<ChevronRight className="size-5" aria-hidden />} />
        </div>
        <h2 className="min-w-0 flex-1 truncate text-xl font-extrabold" aria-live="polite">{window.title}</h2>
        <Button variant="outline" onClick={() => navigate(params.view === 'custom' ? { view: 'month', date: today } : { date: today })}>Today</Button>
        <SegmentedControl<CalendarView> label="Calendar view" options={VIEW_OPTIONS} value={params.view} className="w-full sm:w-auto"
          onChange={(view) => navigate({ view, date: params.view === 'custom' && params.custom ? params.custom.from : params.date })} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="tabular mr-1 text-sm font-semibold text-secondary" aria-live="polite">{isPending ? 'Loading events…' : pluralize(count, 'event')}</p>
        {chips.map((c) => (
          <span key={c.key} className="inline-flex min-h-8 items-center gap-1 rounded-full bg-navy-50 pl-3 text-xs font-semibold text-navy-700">
            {c.label}
            <button type="button" aria-label={`Remove filter ${c.label}`} onClick={() => setFilters(c.clear)}
              className="-my-1.5 flex size-11 items-center justify-center rounded-full hover:bg-navy-100">
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
