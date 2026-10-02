/**
 * Calendar data: joins the queries the app already caches (events, tasks, expenses, templates,
 * template summary, meetings) — no new requests. Filtering, search and windowing are client-side,
 * so toggling a filter never hits Dataverse. Pure helpers are exported for testing.
 */
import { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { computeEventStats, type EventStats } from '@/hooks/useEventsOverview';
import { useCurrentUser, useEvents, useExpenses, useMeetings, useTasks, useTemplateTaskSummary, useTemplates } from '@/hooks/queries';
import { NO_TEMPLATE, type CalendarParams } from '@/hooks/useCalendarParams';
import type { TemplateTaskSummary } from '@/services/templatesService';
import { MeetingStatus } from '@/types/schema';
import type { DateOnly, EpmEvent, EventTask, EventTemplate, Meeting } from '@/types/entities';
import { overlaps, type CalendarWindow } from '@/utils/calendarWindow';
import { addDaysDateOnly, toDateOnly, todayDateOnly } from '@/utils/dates';
import { colorForTemplate, type PaletteEntry } from '@/utils/templateColors';

export interface CalendarEvent {
  /** Event id (also used by the layout helpers). */
  id: string;
  event: EpmEvent;
  /** Full template (with color) when found; a stub when the event points at a template that's gone. */
  template: EventTemplate | null;
  color: PaletteEntry;
  start: DateOnly;
  end: DateOnly;
  /** Earliest task due date → start − template max days before → start. */
  prepStart: DateOnly;
  stats: EventStats;
  /** The current user owns at least one of the event's tasks. */
  isMine: boolean;
}

export interface CalendarMeeting {
  meeting: Meeting;
  /** Local calendar day of the meeting start. */
  day: DateOnly;
  item: CalendarEvent;
}

/** Where the prep window starts (never after the event start). */
export function prepStartFor(start: DateOnly, tasks: EventTask[], maxDaysBefore: number | undefined): DateOnly {
  const dues = tasks.map((t) => t.dueDate).filter(Boolean).sort();
  const earliest = dues[0];
  if (earliest) return earliest < start ? earliest : start;
  return maxDaysBefore ? addDaysDateOnly(start, -maxDaysBefore) : start;
}

/** Events → calendar items (no filtering). Events without a start date can't be placed and are skipped. */
export function buildCalendarEvents(
  stats: EventStats[],
  tasks: EventTask[],
  templates: EventTemplate[],
  summary: Map<string, TemplateTaskSummary> | undefined,
  userId: string | undefined,
): CalendarEvent[] {
  const templateById = new Map(templates.map((t) => [t.id, t]));
  const tasksByEvent = new Map<string, EventTask[]>();
  for (const t of tasks) tasksByEvent.set(t.eventId, [...(tasksByEvent.get(t.eventId) ?? []), t]);

  return stats
    .filter((s) => s.event.eventDate)
    .map((s) => {
      const { event } = s;
      const ref = event.template;
      const template = ref ? templateById.get(ref.id) ?? { id: ref.id, name: ref.name, color: null } : null;
      const start = event.eventDate;
      const end = event.endDate && event.endDate >= start ? event.endDate : start;
      const list = tasksByEvent.get(event.id) ?? [];
      return {
        id: event.id, event, template, color: colorForTemplate(template), start, end,
        prepStart: prepStartFor(start, list, ref ? summary?.get(ref.id)?.maxDaysBefore : undefined),
        stats: s,
        isMine: !!userId && list.some((t) => t.assignee.id === userId),
      };
    });
}

export type CalendarFilters = Pick<CalendarParams, 'templates' | 'statuses' | 'location' | 'overdueOnly' | 'mineOnly' | 'query'>;

export interface FilteredCalendar {
  /** Items that pass every filter, sorted by start then name. */
  items: CalendarEvent[];
  /** Per template id (and NO_TEMPLATE): items in the window that pass all filters EXCEPT the template filter. */
  templateCounts: Map<string, number>;
}

/**
 * Window + filters. `usePrep` (timeline with prep windows on) counts an event as in the window
 * when its prep window overlaps, not only the event days.
 */
export function filterCalendarEvents(
  all: CalendarEvent[], filters: CalendarFilters, window: Pick<CalendarWindow, 'start' | 'end'>, usePrep = false,
): FilteredCalendar {
  const q = filters.query.trim().toLowerCase();
  const loc = filters.location.trim().toLowerCase();

  // Window filter happens here, in memory — fine at Caribbean Area scale. If data grows, move it
  // server-side as a date filter on the event start column (eventsService.list) and keep this as is.
  const base = all.filter((c) =>
    overlaps(usePrep ? c.prepStart : c.start, c.end, window.start, window.end)
    && filters.statuses.includes(c.event.status)
    && (!loc || c.event.location.toLowerCase().includes(loc))
    && (!filters.overdueOnly || c.stats.overdueTasks > 0)
    && (!filters.mineOnly || c.isMine)
    && (!q || c.event.name.toLowerCase().includes(q) || c.event.location.toLowerCase().includes(q)));

  const templateCounts = new Map<string, number>();
  for (const c of base) {
    const key = c.template?.id ?? NO_TEMPLATE;
    templateCounts.set(key, (templateCounts.get(key) ?? 0) + 1);
  }

  const selected = filters.templates ? new Set(filters.templates) : null;
  const items = (selected ? base.filter((c) => selected.has(c.template?.id ?? NO_TEMPLATE)) : base)
    .sort((a, b) => a.start.localeCompare(b.start) || a.event.name.localeCompare(b.event.name));
  return { items, templateCounts };
}

/** Meetings of the visible events inside the window, by their LOCAL start day. */
export function meetingsInWindow(meetings: Meeting[], items: CalendarEvent[], window: CalendarWindow): CalendarMeeting[] {
  const byEvent = new Map(items.map((c) => [c.event.id, c]));
  const out: CalendarMeeting[] = [];
  for (const m of meetings) {
    const item = m.eventId ? byEvent.get(m.eventId) : undefined;
    if (!item || !m.start) continue;
    const day = toDateOnly(parseISO(m.start));
    if (day >= window.start && day <= window.end) out.push({ meeting: m, day, item });
  }
  return out.sort((a, b) => a.meeting.start.localeCompare(b.meeting.start));
}

/** Per event: the next scheduled meeting that hasn't ended yet. */
export function nextMeetingByEvent(meetings: Meeting[], nowIso: string = new Date().toISOString()): Map<string, Meeting> {
  const next = new Map<string, Meeting>();
  for (const m of meetings) {
    if (!m.eventId || m.status !== MeetingStatus.Scheduled || !m.end || m.end < nowIso) continue;
    const current = next.get(m.eventId);
    if (!current || m.start < current.start) next.set(m.eventId, m);
  }
  return next;
}

/** Distinct locations of all loaded events (location filter suggestions). */
export function locationSuggestions(events: EpmEvent[]): string[] {
  const seen = new Map<string, string>();
  for (const e of events) {
    const loc = e.location.trim();
    if (loc && !seen.has(loc.toLowerCase())) seen.set(loc.toLowerCase(), loc);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** `window` should be memoized by the caller (it's a memo dependency). */
export function useCalendarData(params: CalendarParams, window: CalendarWindow, options: { usePrep?: boolean } = {}) {
  const events = useEvents();
  const tasks = useTasks();
  const expenses = useExpenses();
  const templates = useTemplates();
  const summary = useTemplateTaskSummary();
  const meetings = useMeetings();
  const user = useCurrentUser();
  // Required to draw anything; template summary and meetings degrade gracefully.
  const core = [events, tasks, expenses, templates];

  const all = useMemo(() => {
    if (!events.data || !tasks.data || !expenses.data || !templates.data) return null;
    const { stats } = computeEventStats(events.data, tasks.data, expenses.data);
    return buildCalendarEvents(stats, tasks.data, templates.data, summary.data, user.data?.id);
  }, [events.data, tasks.data, expenses.data, templates.data, summary.data, user.data?.id]);

  const { templates: tpl, statuses, location, overdueOnly, mineOnly, query } = params;
  const usePrep = options.usePrep ?? false;
  const filtered = useMemo(
    () => (all ? filterCalendarEvents(all, { templates: tpl, statuses, location, overdueOnly, mineOnly, query }, window, usePrep) : null),
    [all, tpl, statuses, location, overdueOnly, mineOnly, query, window, usePrep],
  );

  // "Next up" (mobile month): same filters, but from today on regardless of the period shown.
  const upcoming = useMemo(
    () => (all
      ? filterCalendarEvents(all, { templates: tpl, statuses, location, overdueOnly, mineOnly, query }, { start: todayDateOnly(), end: '9999-12-31' }).items.slice(0, 3)
      : []),
    [all, tpl, statuses, location, overdueOnly, mineOnly, query],
  );

  const visibleMeetings = useMemo(
    () => (filtered && meetings.data ? meetingsInWindow(meetings.data, filtered.items, window) : []),
    [filtered, meetings.data, window],
  );
  const locations = useMemo(() => locationSuggestions(events.data ?? []), [events.data]);
  const nextMeetings = useMemo(() => nextMeetingByEvent(meetings.data ?? []), [meetings.data]);

  return {
    items: filtered?.items ?? [],
    /** Next 3 events (today or later) that pass the filters. */
    upcoming,
    templateCounts: filtered?.templateCounts ?? new Map<string, number>(),
    /** All templates (for the filter rail), sorted by name. */
    templates: templates.data ?? [],
    templateSummary: summary.data,
    /** True when some loaded event has no template (shows the "No template" row). */
    hasNoTemplateEvents: (all ?? []).some((c) => !c.template),
    meetings: visibleMeetings,
    meetingsError: meetings.error,
    /** Next scheduled meeting per event id (event popover). */
    nextMeetings,
    /** All loaded tasks (Schedule meeting needs an event's tasks). */
    tasks: tasks.data ?? [],
    locations,
    isManager: user.data?.isManager ?? false,
    isPending: core.some((q) => q.isPending),
    error: core.find((q) => q.isError)?.error ?? null,
    refetch: () => core.forEach((q) => void q.refetch()),
  };
}
