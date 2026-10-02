import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { isToday, isYesterday, parseISO } from 'date-fns';
import { ArrowRight, History } from 'lucide-react';
import { ACTION_ICON, showsChange } from '@/components/tasks/historyIcons';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { useActivity } from '@/hooks/queries';
import { HistoryAction } from '@/types/schema';
import type { EventTask, TaskHistoryEntry } from '@/types/entities';
import { formatDateTime } from '@/utils/dates';

type Filter = 'all' | 'status' | 'comments' | 'files' | 'assignments' | 'meetings' | 'expenses' | 'edits';

const FILTERS: { value: Filter; label: string; actions: HistoryAction[] }[] = [
  { value: 'all', label: 'All', actions: [] },
  { value: 'status', label: 'Status', actions: [HistoryAction.StatusChanged] },
  { value: 'comments', label: 'Comments', actions: [HistoryAction.CommentAdded] },
  { value: 'files', label: 'Files', actions: [HistoryAction.FileAttached, HistoryAction.FileRemoved] },
  { value: 'assignments', label: 'Assignments', actions: [HistoryAction.Assigned] },
  { value: 'meetings', label: 'Meetings', actions: [HistoryAction.MeetingScheduled] },
  { value: 'expenses', label: 'Expenses', actions: [HistoryAction.ExpenseLinked] },
  { value: 'edits', label: 'Created & edits', actions: [HistoryAction.Created, HistoryAction.Updated] },
];

const PAGE = 40;

function dayLabel(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return formatDateTime(iso, 'EEEE, MMM d, yyyy');
}

function Entry({ h, taskTitle }: { h: TaskHistoryEntry; taskTitle: string }) {
  const { icon: Icon, tone } = ACTION_ICON[h.action];
  const chips = showsChange(h.action, h.fieldName) && (h.oldValue || h.newValue);
  return (
    <li className="relative flex gap-3">
      <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${tone}`} aria-hidden>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p>
          <span className="font-semibold">{h.actor.name || 'Someone'}</span>{' '}
          <span className="text-secondary">{h.summary || h.fieldName}</span>{' '}
          <span className="text-muted">on</span>{' '}
          <Link to={`/tasks/${h.eventTaskId}`} className="font-semibold text-navy-700 hover:underline">{taskTitle}</Link>
        </p>
        {chips && (
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            {h.oldValue && <Chip tone="pending">{h.oldValue}</Chip>}
            {h.oldValue && h.newValue && <ArrowRight className="size-3.5 text-muted" aria-label="to" />}
            {h.newValue && <Chip tone="navy">{h.newValue}</Chip>}
          </p>
        )}
      </div>
      <time dateTime={h.createdOn} title={formatDateTime(h.createdOn, 'PPpp')} className="tabular shrink-0 pt-1 text-xs text-muted">
        {formatDateTime(h.createdOn, 'h:mm a')}
      </time>
    </li>
  );
}

export function ActivityTab({ tasks }: { tasks: EventTask[] }) {
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const titles = useMemo(() => new Map(tasks.map((t) => [t.id, t.title])), [tasks]);
  const activity = useActivity(taskIds);
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);

  const all = useMemo(() => activity.data ?? [], [activity.data]);
  const counts = useMemo(() => {
    const m = new Map<Filter, number>();
    for (const f of FILTERS) m.set(f.value, f.value === 'all' ? all.length : all.filter((h) => f.actions.includes(h.action)).length);
    return m;
  }, [all]);
  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.value === filter);
    return filter === 'all' || !f ? all : all.filter((h) => f.actions.includes(h.action));
  }, [all, filter]);

  if (tasks.length === 0) {
    return <EmptyState icon={<History className="size-6" />} title="No activity yet" description="Activity appears once the event has tasks." />;
  }
  if (activity.isPending) {
    return <LoadingRegion label="Loading activity">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="mt-3 h-12" />)}</LoadingRegion>;
  }
  if (activity.isError) return <ErrorState error={activity.error} title="Couldn't load activity" onRetry={() => void activity.refetch()} />;

  const shown = visible.slice(0, limit);
  const days: { label: string; items: TaskHistoryEntry[] }[] = [];
  for (const h of shown) {
    const label = dayLabel(h.createdOn);
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(h);
    else days.push({ label, items: [h] });
  }

  return (
    <div>
      <SegmentedControl<Filter>
        label="Filter activity"
        value={filter}
        onChange={(v) => { setFilter(v); setLimit(PAGE); }}
        options={FILTERS.filter((f) => f.value === 'all' || (counts.get(f.value) ?? 0) > 0).map((f) => ({ value: f.value, label: f.label, count: counts.get(f.value) }))}
      />
      {visible.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-page px-4 py-6 text-center text-sm text-muted">Nothing here yet.</p>
      ) : (
        <div className="mt-5 space-y-6">
          {days.map((d) => (
            <section key={d.label} aria-label={d.label}>
              <h3 className="mb-3 text-xs font-bold tracking-wider text-secondary uppercase">{d.label}</h3>
              <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-line">
                {d.items.map((h) => <Entry key={h.id} h={h} taskTitle={titles.get(h.eventTaskId) ?? 'a task'} />)}
              </ol>
            </section>
          ))}
          {visible.length > limit && (
            <Button variant="outline" onClick={() => setLimit((n) => n + PAGE)}>
              Show more ({visible.length - limit} older)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
