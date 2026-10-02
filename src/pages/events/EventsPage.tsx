import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, CalendarCheck, CalendarPlus, CheckCircle2, Clock, Plus, Search, Wallet, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EventCard, EventCardSkeleton } from '@/components/events/EventCard';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Kpi, KpiRing, KpiSkeleton } from '@/components/ui/KpiCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { useCurrentUser } from '@/hooks/queries';
import { useEventsOverview } from '@/hooks/useEventsOverview';
import { EventStatus } from '@/types/schema';
import { formatDateOnly, todayDateOnly } from '@/utils/dates';
import { formatCurrency } from '@/utils/format';

type Filter = 'all' | EventStatus;

function readCreated(state: unknown): { name: string; taskCount: number } | null {
  if (typeof state !== 'object' || state === null || !('created' in state)) return null;
  const c = state.created;
  if (typeof c !== 'object' || c === null || !('name' in c) || !('taskCount' in c)) return null;
  return typeof c.name === 'string' && typeof c.taskCount === 'number' ? { name: c.name, taskCount: c.taskCount } : null;
}

function readDeleted(state: unknown): { name: string } | null {
  if (typeof state !== 'object' || state === null || !('deleted' in state)) return null;
  const d = state.deleted;
  return typeof d === 'object' && d !== null && 'name' in d && typeof d.name === 'string' ? { name: d.name } : null;
}

/** Confirmation after creating or deleting an event (passed via navigation state). */
function CreatedBanner() {
  const location = useLocation();
  const navigate = useNavigate();
  const created = readCreated(location.state);
  const deleted = readDeleted(location.state);
  if (!created && !deleted) return null;
  return (
    <div role="status" className="mb-6 flex items-start gap-3 rounded-2xl bg-green-50 p-4 text-green-700">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="flex-1 text-sm font-semibold">
        {created
          ? <>"{created.name}" was created with {created.taskCount} task{created.taskCount === 1 ? '' : 's'}.</>
          : <>"{deleted?.name}" was deleted.</>}
      </p>
      <button type="button" aria-label="Dismiss" onClick={() => navigate('.', { replace: true, state: null })}
        className="-m-2 flex size-11 items-center justify-center rounded-full hover:bg-green-300/40">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export default function EventsPage() {
  const user = useCurrentUser();
  const overview = useEventsOverview();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const isManager = user.data?.isManager ?? false;

  const allStats = useMemo(() => overview.data?.stats ?? [], [overview.data]);
  const counts = useMemo(() => {
    const by = (s: EventStatus) => allStats.filter((x) => x.event.status === s).length;
    return { all: allStats.length, planning: by(EventStatus.Planning), active: by(EventStatus.Active), completed: by(EventStatus.Completed) };
  }, [allStats]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allStats
      .filter((x) => filter === 'all' || x.event.status === filter)
      .filter((x) => !q || x.event.name.toLowerCase().includes(q) || x.event.location.toLowerCase().includes(q))
      .sort((a, b) => (a.event.eventDate || '9999').localeCompare(b.event.eventDate || '9999'));
  }, [allStats, filter, search]);

  const kpis = overview.data?.kpis;

  return (
    <>
      <PageHeader
        title="Events"
        subtitle={`Caribbean Area · ${formatDateOnly(todayDateOnly(), 'EEEE, MMMM d')}`}
        actions={
          <>
            <label className="relative block min-w-0 flex-1 sm:w-64 sm:flex-none">
              <span className="sr-only">Search events</span>
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events"
                className="min-h-11 w-full rounded-full border border-line bg-white pr-4 pl-10 text-sm placeholder:text-muted"
              />
            </label>
            <Button variant="outline" size="icon" aria-label="Notifications (coming soon)" title="Notifications (coming soon)" disabled icon={<Bell className="size-5" aria-hidden />} />
            {isManager && (
              <ButtonLink to="/events/new" className="hidden lg:inline-flex" icon={<Plus className="size-4" aria-hidden />}>
                New event
              </ButtonLink>
            )}
          </>
        }
      />

      <CreatedBanner />

      {overview.error ? (
        <ErrorState error={overview.error} title="Couldn't load events" onRetry={overview.refetch} />
      ) : overview.isPending || !kpis ? (
        <LoadingRegion label="Loading events">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)}
          </div>
          <Skeleton className="mt-8 h-11 w-80 max-w-full rounded-full" />
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => <EventCardSkeleton key={i} />)}
          </div>
        </LoadingRegion>
      ) : (
        <>
          <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Active events" value={kpis.activeEvents} accent="navy" icon={<CalendarCheck className="size-5" />} />
            <Kpi label="Tasks due this week" value={kpis.dueThisWeek} accent="orange" icon={<Clock className="size-5" />} />
            <Kpi
              label="Overdue tasks"
              value={kpis.overdue}
              valueClass={kpis.overdue > 0 ? 'text-red-700' : ''}
              accent={kpis.overdue > 0 ? 'red' : 'green'}
              icon={<AlertTriangle className="size-5" />}
            />
            <Kpi
              label="Budget spent"
              value={formatCurrency(kpis.spentBase, 'USD', true)}
              accent="green"
              icon={<Wallet className="size-5" />}
              corner={<KpiRing ratio={kpis.budgetBase > 0 ? kpis.spentBase / kpis.budgetBase : 0} label="Total budget spent" />}
              footer={<p className="tabular text-xs text-muted">of {formatCurrency(kpis.budgetBase, 'USD', true)}</p>}
            />
          </section>

          <div className="mt-8 mb-5 flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl<Filter>
              label="Filter events by status"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All', count: counts.all },
                { value: EventStatus.Planning, label: 'Planning', count: counts.planning },
                { value: EventStatus.Active, label: 'Active', count: counts.active },
                { value: EventStatus.Completed, label: 'Completed', count: counts.completed },
              ]}
            />
            <p className="text-sm text-muted" aria-live="polite">Sorted by event date · {visible.length} shown</p>
          </div>

          {allStats.length === 0 ? (
            <EmptyState
              icon={<CalendarPlus className="size-6" />}
              title="No events yet"
              description={isManager ? 'Create your first event from a template to generate its checklist.' : 'Events you are part of will appear here.'}
              action={isManager ? <ButtonLink to="/events/new" icon={<Plus className="size-4" aria-hidden />}>New event</ButtonLink> : undefined}
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Search className="size-6" />}
              title="No events match"
              description="Try another status or search term."
              action={<Button variant="outline" onClick={() => { setFilter('all'); setSearch(''); }}>Clear filters</Button>}
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((s) => (
                <li key={s.event.id}>
                  <EventCard stats={s} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {isManager && (
        <ButtonLink
          to="/events/new"
          size="icon"
          aria-label="New event"
          className="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 size-14 justify-center shadow-lg lg:hidden"
          icon={<Plus className="size-6" aria-hidden />}
        />
      )}
    </>
  );
}
