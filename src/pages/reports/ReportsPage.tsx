import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { AtRiskSection, BudgetSection, EventHealthSection, WorkloadSection } from '@/components/reports/ReportSections';
import { Button } from '@/components/ui/Button';
import { Kpi, KpiRing, KpiSkeleton } from '@/components/ui/KpiCard';
import { ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { useEvents, useExpenses, useTasks } from '@/hooks/queries';
import { EventStatus } from '@/types/schema';
import type { Ref } from '@/types/entities';
import { formatDateOnly, todayDateOnly } from '@/utils/dates';
import { EVENT_STATUS_LABEL, formatCurrency } from '@/utils/format';
import { computeReport, DATE_PRESETS, DEFAULT_FILTERS, DUE_SOON_DAYS, ROW_LIMIT, type DatePreset, type ReportFilters } from '@/utils/reports';

const selectClass = 'min-h-11 rounded-full border border-line bg-white px-4 text-sm font-semibold text-secondary';
const EVENT_STATUSES = [EventStatus.Planning, EventStatus.Active, EventStatus.Completed, EventStatus.Cancelled];

export default function ReportsPage() {
  // Same queries (and cache) as the Events page, so totals match its KPI cards.
  const events = useEvents();
  const tasks = useTasks();
  const expenses = useExpenses();
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS);
  const set = (patch: Partial<ReportFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const today = todayDateOnly();

  const report = useMemo(
    () => (events.data && tasks.data && expenses.data ? computeReport(events.data, tasks.data, expenses.data, filters, today) : null),
    [events.data, tasks.data, expenses.data, filters, today],
  );

  const eventOptions = useMemo(() => [...(events.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [events.data]);
  const assigneeOptions = useMemo(() => {
    const people = new Map<string, Ref>();
    for (const t of tasks.data ?? []) if (t.assignee.id) people.set(t.assignee.id, t.assignee);
    return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks.data]);

  const maybeTruncated = [events.data, tasks.data, expenses.data].some((list) => (list?.length ?? 0) >= ROW_LIMIT);
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const error = events.error ?? tasks.error ?? expenses.error;
  const retry = () => { void events.refetch(); void tasks.refetch(); void expenses.refetch(); };

  return (
    <>
      <PageHeader title="Reports" subtitle={`Caribbean Area · as of ${formatDateOnly(today, 'EEEE, MMMM d')}`} />

      <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Report filters">
        <label className="sr-only" htmlFor="rep-dates">Event date</label>
        <select id="rep-dates" className={selectClass} value={filters.preset} onChange={(e) => set({ preset: e.target.value as DatePreset })}>
          {DATE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {filters.preset === 'custom' && (
          <>
            <label className="sr-only" htmlFor="rep-from">From</label>
            <input id="rep-from" type="date" className={selectClass} value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} />
            <span className="text-sm text-muted" aria-hidden>to</span>
            <label className="sr-only" htmlFor="rep-to">To</label>
            <input id="rep-to" type="date" className={selectClass} value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} />
          </>
        )}
        <label className="sr-only" htmlFor="rep-status">Event status</label>
        <select id="rep-status" className={selectClass} value={String(filters.status)}
          onChange={(e) => set({ status: e.target.value === 'all' ? 'all' : (Number(e.target.value) as EventStatus) })}>
          <option value="all">All statuses</option>
          {EVENT_STATUSES.map((s) => <option key={s} value={s}>{EVENT_STATUS_LABEL[s]}</option>)}
        </select>
        <label className="sr-only" htmlFor="rep-event">Event</label>
        <select id="rep-event" className={`${selectClass} max-w-full`} value={filters.eventId} onChange={(e) => set({ eventId: e.target.value })}>
          <option value="">All events</option>
          {eventOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="rep-person">Assignee</label>
        <select id="rep-person" className={selectClass} value={filters.assigneeId} onChange={(e) => set({ assigneeId: e.target.value })}>
          <option value="">Everyone</option>
          {assigneeOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {filtersActive && <Button variant="ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</Button>}
      </div>

      {maybeTruncated && (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-2xl bg-orange-50 p-4 text-sm text-orange-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p>One of the lists reached {ROW_LIMIT.toLocaleString()} rows, so these reports may not include every record. Narrow the date range for exact totals.</p>
        </div>
      )}

      {error ? (
        <ErrorState error={error} title="Couldn't load reports" onRetry={retry} />
      ) : !report ? (
        <LoadingRegion label="Loading reports">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)}</div>
          <Skeleton className="mt-6 h-72 rounded-3xl" />
          <div className="mt-6 grid gap-6 xl:grid-cols-2"><Skeleton className="h-64 rounded-3xl" /><Skeleton className="h-64 rounded-3xl" /></div>
        </LoadingRegion>
      ) : (
        <>
          <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              label="Events"
              value={report.events.length}
              accent="navy"
              icon={<CalendarDays className="size-5" />}
              footer={<p className="tabular text-xs text-muted">{report.summary.byStatus[EventStatus.Active]} active · {report.summary.byStatus[EventStatus.Planning]} planning</p>}
            />
            <Kpi
              label="Tasks completed"
              value={`${report.summary.doneTasks}/${report.summary.totalTasks}`}
              accent="green"
              icon={<CheckCircle2 className="size-5" />}
              corner={<KpiRing ratio={report.summary.totalTasks > 0 ? report.summary.doneTasks / report.summary.totalTasks : 0} label="Tasks completed" />}
            />
            <Kpi
              label="Overdue tasks"
              value={report.summary.overdue}
              valueClass={report.summary.overdue > 0 ? 'text-red-700' : ''}
              accent={report.summary.overdue > 0 ? 'red' : 'green'}
              icon={<AlertTriangle className="size-5" />}
              footer={<p className="tabular text-xs text-muted">{report.summary.dueSoon} more due in the next {DUE_SOON_DAYS} days</p>}
            />
            <Kpi
              label="Budget spent"
              value={formatCurrency(report.summary.spentBase, 'USD', true)}
              accent="orange"
              icon={<Wallet className="size-5" />}
              corner={<KpiRing ratio={report.summary.budgetBase > 0 ? report.summary.spentBase / report.summary.budgetBase : 0} label="Total budget spent" />}
              footer={<p className="tabular text-xs text-muted">of {formatCurrency(report.summary.budgetBase, 'USD', true)}</p>}
            />
          </section>

          <div className="mt-8 space-y-6">
            <EventHealthSection stats={report.eventStats} today={today} />
            <div className="grid items-start gap-6 xl:grid-cols-2">
              <AtRiskSection items={report.atRisk} />
              <BudgetSection budget={report.budget} budgetBase={report.summary.budgetBase} />
            </div>
            <WorkloadSection rows={report.workload} onTime={report.onTime} />
          </div>
        </>
      )}
    </>
  );
}
