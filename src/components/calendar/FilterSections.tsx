/** Calendar filter controls, shared by the desktop rail and the mobile sheet. */
import { useId, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CHIP_TONES, EVENT_TONE } from '@/components/ui/chipStyles';
import { DEFAULT_STATUSES, NO_TEMPLATE, type CalendarFilterPatch, type CalendarParams } from '@/hooks/useCalendarParams';
import { EventStatus } from '@/types/schema';
import type { DateOnly, EventTemplate } from '@/types/entities';
import type { CalendarView, CustomRange } from '@/utils/calendarWindow';
import { addDaysDateOnly, todayDateOnly } from '@/utils/dates';
import { EVENT_STATUS_LABEL } from '@/utils/format';
import { colorForTemplate } from '@/utils/templateColors';

export interface FilterSectionsProps {
  params: CalendarParams;
  templates: EventTemplate[];
  /** Events per template id (and NO_TEMPLATE) in the current window, before the template filter. */
  templateCounts: Map<string, number>;
  hasNoTemplateEvents: boolean;
  locations: string[];
  setFilters: (patch: CalendarFilterPatch, options?: { replace?: boolean }) => void;
  navigate: (next: { view?: CalendarView; date?: DateOnly; custom?: CustomRange | null }) => void;
  clearFilters: () => void;
}

const STATUSES = Object.values(EventStatus) as EventStatus[];
const inputClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm';
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 id={id} className="text-xs font-bold tracking-wider text-secondary uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-semibold">
      {label}
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-navy-700 ${checked ? 'bg-navy-700' : 'bg-line'}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[1.125rem]' : 'left-0.5'}`} />
      </span>
    </label>
  );
}

export function FilterSections({ params, templates, templateCounts, hasNoTemplateEvents, locations, setFilters, navigate, clearFilters }: FilterSectionsProps) {
  const locId = useId();
  const listId = useId();
  const fromId = useId();
  const toId = useId();
  const [from, setFrom] = useState(params.custom?.from ?? '');
  const [to, setTo] = useState(params.custom?.to ?? '');
  const today = todayDateOnly();

  // Template selection: null = all. Toggling from "all" selects everything except the one clicked.
  const rows = [
    ...[...templates].sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ id: t.id, name: t.name, color: colorForTemplate(t) })),
    ...(hasNoTemplateEvents ? [{ id: NO_TEMPLATE, name: 'No template', color: colorForTemplate(null) }] : []),
  ];
  const allIds = rows.map((r) => r.id);
  const isOn = (id: string) => params.templates === null || params.templates.includes(id);
  const toggleTemplate = (id: string) => {
    const current = params.templates ?? allIds;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setFilters({ templates: allIds.every((x) => next.includes(x)) ? null : next });
  };

  const toggleStatus = (s: EventStatus) => {
    const next = params.statuses.includes(s) ? params.statuses.filter((x) => x !== s) : [...params.statuses, s];
    if (next.length > 0) setFilters({ statuses: next });
  };

  const customValid = isDate(from) && isDate(to) && from <= to;

  return (
    <div>
      <Section title="Event template" action={
        <span className="flex gap-1 text-xs font-semibold">
          <button type="button" className="min-h-11 rounded-full px-2 text-navy-700 hover:underline" onClick={() => setFilters({ templates: null })}>Select all</button>
          <button type="button" className="min-h-11 rounded-full px-2 text-navy-700 hover:underline" onClick={() => setFilters({ templates: [] })}>Clear</button>
        </span>
      }>
        {rows.length === 0 ? <p className="text-sm text-muted">No templates yet.</p> : (
          <ul className="space-y-0.5">
            {rows.map((r) => (
              <li key={r.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm hover:bg-navy-50">
                  <input type="checkbox" className="size-4 shrink-0 accent-navy-700" checked={isOn(r.id)} onChange={() => toggleTemplate(r.id)} />
                  <span className={`size-3 shrink-0 rounded-full ${r.color.solid}`} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                  <span className="tabular text-xs text-muted">
                    {templateCounts.get(r.id) ?? 0}<span className="sr-only"> events in view</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Date range">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'This month', go: () => navigate({ view: 'month', date: today }) },
            { label: 'This quarter', go: () => navigate({ view: 'quarter', date: today }) },
            { label: 'Next 90 days', go: () => navigate({ view: 'custom', date: today, custom: { from: today, to: addDaysDateOnly(today, 90) } }) },
            { label: 'This year', go: () => navigate({ view: 'year', date: today }) },
          ].map((p) => (
            <button key={p.label} type="button" onClick={p.go}
              className="min-h-11 rounded-full border border-line bg-white px-3 text-sm font-semibold text-secondary hover:bg-navy-50">
              {p.label}
            </button>
          ))}
        </div>
        <form className="mt-3 grid grid-cols-2 gap-2" onSubmit={(e) => { e.preventDefault(); if (customValid) navigate({ view: 'custom', date: from, custom: { from, to } }); }}>
          <div>
            <label htmlFor={fromId} className="mb-1 block text-xs font-semibold text-secondary">From</label>
            <input id={fromId} type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor={toId} className="mb-1 block text-xs font-semibold text-secondary">To</label>
            <input id={toId} type="date" className={inputClass} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" className="col-span-2 justify-center" disabled={!customValid}>Apply custom range</Button>
        </form>
      </Section>

      <Section title="Status">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Event status">
          {STATUSES.map((s) => {
            const on = params.statuses.includes(s);
            return (
              <button key={s} type="button" aria-pressed={on} onClick={() => toggleStatus(s)}
                disabled={on && params.statuses.length === 1} title={on && params.statuses.length === 1 ? 'Keep at least one status' : undefined}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold ${
                  on ? CHIP_TONES[EVENT_TONE[s]] : 'border border-dashed border-muted bg-white text-muted'
                }`}>
                {on && <Check className="size-3.5" aria-hidden />}
                {EVENT_STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
        {params.statuses.length === DEFAULT_STATUSES.length && !params.statuses.includes(EventStatus.Cancelled) && (
          <p className="mt-2 text-xs text-muted">Cancelled events are hidden by default.</p>
        )}
      </Section>

      <Section title="Location">
        <label htmlFor={locId} className="sr-only">Location</label>
        <input id={locId} className={inputClass} list={listId} placeholder="Any location" value={params.location}
          onChange={(e) => setFilters({ location: e.target.value }, { replace: true })} />
        <datalist id={listId}>{locations.map((l) => <option key={l} value={l} />)}</datalist>
      </Section>

      <Section title="Show only">
        <Toggle label="Events with overdue tasks" checked={params.overdueOnly} onChange={(v) => setFilters({ overdueOnly: v })} />
        <Toggle label="Events where I have tasks" checked={params.mineOnly} onChange={(v) => setFilters({ mineOnly: v })} />
      </Section>

      <div className="border-t border-line pt-4">
        <Button variant="ghost" className="w-full justify-center" onClick={() => { clearFilters(); setFrom(''); setTo(''); }}>Clear all</Button>
      </div>
    </div>
  );
}
