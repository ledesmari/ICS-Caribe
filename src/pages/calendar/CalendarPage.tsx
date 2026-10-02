import { lazy, Suspense, useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { CalendarPlus, CheckCircle2, Plus, Search, SearchX, X } from 'lucide-react';
import { CalendarSkeleton } from '@/components/calendar/CalendarSkeleton';
import { CalendarToolbar } from '@/components/calendar/CalendarToolbar';
import { DayPopover } from '@/components/calendar/DayPopover';
import { EventPopover } from '@/components/calendar/EventPopover';
import { MobileMonth } from '@/components/calendar/MobileMonth';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { TimelineView } from '@/components/calendar/TimelineView';
import { WeekAgenda } from '@/components/calendar/WeekAgenda';
import { WeekView } from '@/components/calendar/WeekView';
import { FilterRail } from '@/components/calendar/FilterRail';
import { FilterSheet } from '@/components/calendar/FilterSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useCalendarData, type CalendarEvent } from '@/hooks/useCalendarData';
import { useCalendarParams } from '@/hooks/useCalendarParams';
import { getWindow } from '@/utils/calendarWindow';
import type { DateOnly } from '@/types/entities';

// Teams/Office 365 connector code loads only when a manager schedules a meeting from the calendar.
const ScheduleMeetingDialog = lazy(() =>
  import('@/components/meetings/ScheduleMeetingDialog').then((m) => ({ default: m.ScheduleMeetingDialog })));

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** `windowStart` ties a popover to the period it was opened in (its anchor is gone once the period changes). */
type OpenPopover =
  | { kind: 'event'; item: CalendarEvent; anchor: HTMLElement; windowStart: DateOnly }
  | { kind: 'day'; day: DateOnly; items: CalendarEvent[]; anchor: HTMLElement; windowStart: DateOnly }
  | null;

export default function CalendarPage() {
  const { params, navigate, setFilters, clearFilters, activeFilters } = useCalendarParams();
  const calWindow = useMemo(() => getWindow(params.view, params.date, params.custom), [params.view, params.date, params.custom]);
  const timeline = params.view === 'quarter' || params.view === 'year' || params.view === 'custom';
  const [showPrep, setShowPrep] = useState(true);
  // With prep windows on, the timeline also lists events whose preparation (not only the event) falls in the period.
  const data = useCalendarData(params, calWindow, { usePrep: timeline && showPrep });
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [openPopover, setPopover] = useState<OpenPopover>(null);
  const popover = openPopover?.windowStart === calWindow.start ? openPopover : null;
  const activeId = popover?.kind === 'event' ? popover.item.id : null;
  const [scheduling, setScheduling] = useState<CalendarEvent | null>(null);
  const [scheduled, setScheduled] = useState<{ subject: string; warning: string | null } | null>(null);
  const closePopover = useCallback(() => setPopover(null), []);
  const windowStart = calWindow.start;
  const openEvent = useCallback((item: CalendarEvent, anchor: HTMLElement) => setPopover({ kind: 'event', item, anchor, windowStart }), [windowStart]);
  const openDay = useCallback(
    (day: DateOnly, items: CalendarEvent[], anchor: HTMLElement) => setPopover({ kind: 'day', day, items, anchor, windowStart }), [windowStart]);

  const filterProps = {
    params, templates: data.templates, templateCounts: data.templateCounts, hasNoTemplateEvents: data.hasNoTemplateEvents,
    locations: data.locations, setFilters, navigate, clearFilters, activeFilters,
  };

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="All events across the Caribbean Area"
        actions={
          <>
            <label className="relative block min-w-0 flex-1 sm:w-64 sm:flex-none">
              <span className="sr-only">Search events by name or location</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input type="search" value={params.query} placeholder="Search events"
                onChange={(e) => setFilters({ query: e.target.value }, { replace: true })}
                className="min-h-11 w-full rounded-full border border-line bg-white pr-4 pl-10 text-sm placeholder:text-muted" />
            </label>
            {data.isManager && (
              <ButtonLink to="/events/new" className="hidden lg:inline-flex" icon={<Plus className="size-4" aria-hidden />}>New event</ButtonLink>
            )}
          </>
        }
      />

      <div className="flex gap-6">
        <FilterRail {...filterProps} />
        <div className="min-w-0 flex-1 space-y-4">
          <FilterSheet {...filterProps} />
          <CalendarToolbar params={params} window={calWindow} count={data.items.length} isPending={data.isPending}
            templates={data.templates} navigate={navigate} setFilters={setFilters} />

          {scheduled && (
            <div role="status" className={`flex items-start gap-2 rounded-2xl p-3 text-sm ${scheduled.warning ? 'bg-orange-50 text-orange-900' : 'bg-green-50 text-green-700'}`}>
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="flex-1 font-semibold">"{scheduled.subject}" was scheduled.{scheduled.warning ? ` ${scheduled.warning}` : ''}</p>
              <button type="button" aria-label="Dismiss" onClick={() => setScheduled(null)} className="-m-2 flex size-11 items-center justify-center rounded-full">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          )}

          <section aria-label={`Events: ${calWindow.title}`} className="rounded-3xl border border-line bg-white p-5">
            {data.error ? (
              <ErrorState error={data.error} title="Couldn't load the calendar" onRetry={data.refetch} />
            ) : data.isPending ? (
              <CalendarSkeleton view={params.view} desktop={desktop} />
            ) : data.items.length === 0 ? (
              activeFilters > 0 ? (
                <EmptyState icon={<SearchX className="size-6" />} title="No events match these filters"
                  description="Try another template, status or date range." action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>} />
              ) : (
                <EmptyState icon={<CalendarPlus className="size-6" />} title="No events in this period"
                  description="Move to another period or switch to a longer view."
                  action={data.isManager ? <ButtonLink to="/events/new" icon={<Plus className="size-4" aria-hidden />}>New event</ButtonLink> : undefined} />
              )
            ) : params.view === 'month' ? (
              desktop ? (
                <MonthGrid window={calWindow} anchor={params.date} items={data.items} activeId={activeId}
                  onOpenEvent={openEvent} onOpenDay={openDay} onNavigate={(date) => navigate({ date })} />
              ) : (
                <MobileMonth window={calWindow} anchor={params.date} items={data.items} upcoming={data.upcoming}
                  activeId={activeId} onOpenEvent={openEvent} />
              )
            ) : params.view === 'week' ? (
              desktop ? (
                <WeekView window={calWindow} items={data.items} meetings={data.meetings} meetingsError={data.meetingsError}
                  activeId={activeId} onOpenEvent={openEvent} />
              ) : (
                <WeekAgenda window={calWindow} items={data.items} meetings={data.meetings} activeId={activeId} onOpenEvent={openEvent} />
              )
            ) : (
              <TimelineView window={calWindow} items={data.items} summary={data.templateSummary} showPrep={showPrep} onShowPrepChange={setShowPrep}
                desktop={desktop} activeId={activeId} onOpenEvent={openEvent} />
            )}
          </section>
        </div>
      </div>

      {popover?.kind === 'event' && (
        <EventPopover item={popover.item} anchor={popover.anchor} nextMeeting={data.nextMeetings.get(popover.item.id)}
          canSchedule={data.isManager} onClose={closePopover}
          onSchedule={() => { setScheduling(popover.item); setPopover(null); }} />
      )}
      {popover?.kind === 'day' && (
        <DayPopover day={popover.day} items={popover.items} anchor={popover.anchor} onClose={closePopover}
          onPick={(item) => setPopover({ kind: 'event', item, anchor: popover.anchor, windowStart })} />
      )}
      {scheduling && (
        <Suspense fallback={null}>
          <ScheduleMeetingDialog eventId={scheduling.id} eventName={scheduling.event.name}
            tasks={data.tasks.filter((t) => t.eventId === scheduling.id)}
            onClose={() => setScheduling(null)}
            onScheduled={(r) => { setScheduling(null); setScheduled({ subject: r.subject, warning: r.warning }); }} />
        </Suspense>
      )}

      {data.isManager && (
        <ButtonLink to="/events/new" size="icon" aria-label="New event"
          className="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 size-14 justify-center shadow-lg lg:hidden"
          icon={<Plus className="size-6" aria-hidden />} />
      )}
    </>
  );
}
