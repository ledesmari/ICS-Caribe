/**
 * Calendar state lives in the URL (works with the hash router), so reload, Back and shared
 * links restore the same view. Invalid values fall back to defaults; defaults are left out of the URL.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EventStatus } from '@/types/schema';
import type { DateOnly } from '@/types/entities';
import { CALENDAR_VIEWS, type CalendarView, type CustomRange } from '@/utils/calendarWindow';
import { parseDateOnly, todayDateOnly } from '@/utils/dates';

/** `tpl` value for events without a template. */
export const NO_TEMPLATE = 'none';

const ALL_STATUSES = Object.values(EventStatus) as EventStatus[];
/** Default: everything except Cancelled. */
export const DEFAULT_STATUSES: EventStatus[] = ALL_STATUSES.filter((s) => s !== EventStatus.Cancelled);

export interface CalendarParams {
  view: CalendarView;
  /** Anchor date for week/month/quarter/year. */
  date: DateOnly;
  /** Only for view = custom (null otherwise or when invalid). */
  custom: CustomRange | null;
  /** Selected template ids (and/or NO_TEMPLATE); null = all templates. */
  templates: string[] | null;
  statuses: EventStatus[];
  location: string;
  overdueOnly: boolean;
  mineOnly: boolean;
  query: string;
}

export type CalendarFilterPatch = Partial<Omit<CalendarParams, 'view' | 'date' | 'custom'>>;

function isDateOnly(v: string | null): v is DateOnly {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  try { parseDateOnly(v); return true; } catch { return false; }
}
const sameSet = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((x) => b.includes(x));

/** Pure: URLSearchParams → CalendarParams (exported for testing). */
export function parseCalendarParams(sp: URLSearchParams, today: DateOnly = todayDateOnly()): CalendarParams {
  const rawView = sp.get('view');
  let view: CalendarView = (CALENDAR_VIEWS as readonly string[]).includes(rawView ?? '') ? (rawView as CalendarView) : 'month';
  const from = sp.get('from');
  const to = sp.get('to');
  const custom = view === 'custom' && isDateOnly(from) && isDateOnly(to) && from <= to ? { from, to } : null;
  if (view === 'custom' && !custom) view = 'month';

  const rawDate = sp.get('date');
  const date = isDateOnly(rawDate) ? rawDate : custom?.from ?? today;

  const tpl = sp.get('tpl');
  const templates = tpl === null ? null : tpl.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

  const rawStatus = sp.get('status');
  const parsedStatuses = rawStatus === null ? null
    : rawStatus.split(',').map(Number).filter((n): n is EventStatus => (ALL_STATUSES as number[]).includes(n));
  const statuses = parsedStatuses && parsedStatuses.length > 0 ? parsedStatuses : DEFAULT_STATUSES;

  return {
    view, date, custom, templates, statuses,
    // Kept as typed (spaces included) so the inputs stay controlled by the URL; filtering trims.
    location: sp.get('loc') ?? '',
    overdueOnly: sp.get('overdue') === '1',
    mineOnly: sp.get('mine') === '1',
    query: sp.get('q') ?? '',
  };
}

/** Pure: CalendarParams → URLSearchParams, defaults omitted (exported for testing). */
export function serializeCalendarParams(p: CalendarParams, today: DateOnly = todayDateOnly()): URLSearchParams {
  const sp = new URLSearchParams();
  if (p.view !== 'month') sp.set('view', p.view);
  if (p.view === 'custom' && p.custom) {
    sp.set('from', p.custom.from);
    sp.set('to', p.custom.to);
  } else if (p.date !== today) {
    sp.set('date', p.date);
  }
  if (p.templates !== null) sp.set('tpl', p.templates.join(','));
  if (!sameSet(p.statuses, DEFAULT_STATUSES)) sp.set('status', p.statuses.join(','));
  if (p.location) sp.set('loc', p.location);
  if (p.overdueOnly) sp.set('overdue', '1');
  if (p.mineOnly) sp.set('mine', '1');
  if (p.query) sp.set('q', p.query);
  return sp;
}

/** Number of filters that differ from the defaults (for the "Filters · N" pill). */
export function activeFilterCount(p: CalendarParams): number {
  return [
    p.templates !== null,
    !sameSet(p.statuses, DEFAULT_STATUSES),
    p.location.trim() !== '',
    p.overdueOnly,
    p.mineOnly,
    p.query.trim() !== '',
  ].filter(Boolean).length;
}

export function useCalendarParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => parseCalendarParams(searchParams), [searchParams]);

  const write = useCallback(
    (next: CalendarParams, replace = false) => setSearchParams(serializeCalendarParams(next), { replace }),
    [setSearchParams],
  );

  /** Change view and/or position (adds a history entry so Back returns to the previous view). */
  const navigate = useCallback(
    (next: { view?: CalendarView; date?: DateOnly; custom?: CustomRange | null }) => {
      const view = next.view ?? params.view;
      write({ ...params, view, date: next.date ?? params.date, custom: view === 'custom' ? next.custom ?? params.custom : null });
    },
    [params, write],
  );

  /** Change filters. Use `replace` while typing so each keystroke isn't a history entry. */
  const setFilters = useCallback(
    (patch: CalendarFilterPatch, options?: { replace?: boolean }) => write({ ...params, ...patch }, options?.replace),
    [params, write],
  );

  /** "Clear all": filters back to defaults; view and date are kept. */
  const clearFilters = useCallback(
    () => write({ ...params, templates: null, statuses: DEFAULT_STATUSES, location: '', overdueOnly: false, mineOnly: false, query: '' }),
    [params, write],
  );

  return { params, navigate, setFilters, clearFilters, activeFilters: activeFilterCount(params) };
}
