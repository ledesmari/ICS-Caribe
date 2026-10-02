import { useMemo, useState } from 'react';
import { AlertTriangle, ListChecks, Search, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskCardsMobile } from '@/components/tasks/TaskCardsMobile';
import { TaskQuickEdit } from '@/components/tasks/TaskQuickEdit';
import { TaskTable, type TaskActivity } from '@/components/tasks/TaskTable';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { useSetTaskStatus } from '@/hooks/mutations';
import { useAttachments, useComments, useCurrentUser, useEvents, useTasks } from '@/hooks/queries';
import { TaskStatus } from '@/types/schema';
import type { EventTask, TaskComment } from '@/types/entities';
import { errorMessage, isTaskOverdue } from '@/utils/format';
import { groupTasks, type GroupBy } from '@/utils/taskGroups';

type Scope = 'mine' | 'all';
type StatusFilter = 'open' | 'all' | 'overdue' | 'pending' | 'inProgress' | 'completed';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'pending', label: 'Pending' },
  { value: 'inProgress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All statuses' },
];

function matchesStatus(t: EventTask, f: StatusFilter): boolean {
  switch (f) {
    case 'open': return t.status !== TaskStatus.Completed;
    case 'overdue': return isTaskOverdue(t);
    case 'pending': return t.status === TaskStatus.Pending;
    case 'inProgress': return t.status === TaskStatus.InProgress;
    case 'completed': return t.status === TaskStatus.Completed;
    default: return true;
  }
}

const selectClass = 'min-h-11 rounded-full border border-line bg-white px-4 text-sm font-semibold text-secondary';

export default function TasksPage() {
  const user = useCurrentUser();
  const isManager = user.data?.isManager ?? false;
  const [scope, setScope] = useState<Scope>('mine');
  const effectiveScope: Scope = isManager ? scope : 'mine';
  const tasks = useTasks(effectiveScope === 'mine' ? { assigneeId: user.data?.id } : {}, Boolean(user.data?.id));
  const events = useEvents();
  const [search, setSearch] = useState('');
  const [eventId, setEventId] = useState('');
  const [status, setStatus] = useState<StatusFilter>('open');
  const [groupBy, setGroupBy] = useState<GroupBy>('due');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const setTaskStatus = useSetTaskStatus();

  const all = useMemo(() => tasks.data ?? [], [tasks.data]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((t) =>
      matchesStatus(t, status) &&
      (!eventId || t.eventId === eventId) &&
      (!q || t.title.toLowerCase().includes(q) || t.eventName.toLowerCase().includes(q) || t.assignee.name.toLowerCase().includes(q)));
  }, [all, status, eventId, search]);
  const groups = useMemo(() => groupTasks(visible, groupBy), [visible, groupBy]);

  const taskIds = useMemo(() => visible.map((t) => t.id), [visible]);
  const comments = useComments(taskIds);
  const attachments = useAttachments(taskIds);
  const activity = useMemo(() => {
    const map = new Map<string, TaskActivity>();
    const bump = (id: string, key: keyof TaskActivity) => {
      const row = map.get(id) ?? { comments: 0, attachments: 0 };
      row[key] += 1;
      map.set(id, row);
    };
    comments.data?.forEach((c) => bump(c.eventTaskId, 'comments'));
    attachments.data?.forEach((a) => bump(a.objectId, 'attachments'));
    return map;
  }, [comments.data, attachments.data]);
  const latestComment = (taskId: string): TaskComment | null =>
    [...(comments.data ?? [])].reverse().find((c) => c.eventTaskId === taskId) ?? null;

  const eventDates = useMemo(() => new Map((events.data ?? []).map((e) => [e.id, e.eventDate])), [events.data]);
  const eventOptions = useMemo(() => {
    const ids = new Set(all.map((t) => t.eventId));
    return (events.data ?? []).filter((e) => ids.has(e.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [all, events.data]);

  const selected = visible.find((t) => t.id === selectedId) ?? null;
  const canChange = (t: EventTask) => isManager || t.assignee.id === user.data?.id;

  const changeStatus = (task: EventTask, next: TaskStatus) => {
    if (task.status === next) return;
    setActionError(null);
    setPendingIds((s) => new Set(s).add(task.id));
    setTaskStatus.mutate(
      { task, status: next },
      {
        onError: (e) => setActionError(`"${task.title}" wasn't updated: ${errorMessage(e)}`),
        onSettled: () => setPendingIds((s) => { const n = new Set(s); n.delete(task.id); return n; }),
      },
    );
  };
  const toggle = (t: EventTask) => changeStatus(t, t.status === TaskStatus.Completed ? TaskStatus.Pending : TaskStatus.Completed);
  const filtersActive = Boolean(search || eventId || status !== 'open');

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={effectiveScope === 'mine' ? 'Assigned to you' : 'Every task you can see'}
        actions={isManager ? (
          <SegmentedControl<Scope> label="Which tasks" value={scope} onChange={(v) => { setScope(v); setSelectedId(null); }}
            options={[{ value: 'mine', label: 'Assigned to me' }, { value: 'all', label: 'All tasks' }]} />
        ) : undefined}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        <label className="relative block min-w-0 flex-1 basis-full sm:basis-64 sm:flex-none">
          <span className="sr-only">Search tasks</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks"
            className="min-h-11 w-full rounded-full border border-line bg-white pr-4 pl-10 text-sm placeholder:text-muted" />
        </label>
        <label className="sr-only" htmlFor="filter-event">Event</label>
        <select id="filter-event" className={selectClass} value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">All events</option>
          {eventOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="filter-status">Status</label>
        <select id="filter-status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <label className="sr-only" htmlFor="filter-group">Group by</label>
        <select id="filter-group" className={selectClass} value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)}>
          <option value="due">Group: Due date</option>
          <option value="event">Group: Event</option>
        </select>
        <p className="ml-auto text-sm text-muted" aria-live="polite">{tasks.data ? `${visible.length} shown` : ''}</p>
      </div>

      {actionError && (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="flex-1">{actionError}</p>
          <button type="button" aria-label="Dismiss" onClick={() => setActionError(null)} className="-m-2 flex size-11 items-center justify-center rounded-full">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {user.isError ? (
        <ErrorState error={user.error} onRetry={() => void user.refetch()} />
      ) : tasks.isError ? (
        <ErrorState error={tasks.error} title="Couldn't load tasks" onRetry={() => void tasks.refetch()} />
      ) : !tasks.data ? (
        <LoadingRegion label="Loading tasks">
          <div className="space-y-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        </LoadingRegion>
      ) : all.length === 0 ? (
        <EmptyState icon={<ListChecks className="size-6" />} title={effectiveScope === 'mine' ? 'Nothing assigned to you' : 'No tasks yet'}
          description={effectiveScope === 'mine' ? 'Tasks assigned to you will show up here.' : 'Create an event from a template to generate tasks.'} />
      ) : visible.length === 0 ? (
        <EmptyState icon={<Search className="size-6" />} title="No tasks match"
          description="Try another status, event or search term."
          action={filtersActive ? <Button variant="outline" onClick={() => { setSearch(''); setEventId(''); setStatus('open'); }}>Clear filters</Button> : undefined} />
      ) : (
        <>
          <div className={`hidden gap-6 lg:grid ${selected ? 'lg:grid-cols-[minmax(0,1fr)_400px]' : ''}`}>
            <TaskTable groups={groups} selectedId={selected?.id ?? null} onSelect={(t) => setSelectedId(t.id)} activity={activity}
              canToggle={canChange} pendingIds={pendingIds} onToggle={toggle} />
            {selected && (
              <TaskQuickEdit
                key={`${selected.id}-${selected.status}-${selected.assignee.id}-${selected.dueDate}`}
                task={selected}
                eventDate={eventDates.get(selected.eventId) ?? ''}
                isManager={isManager}
                isOwner={selected.assignee.id === user.data?.id}
                attachmentCount={activity.get(selected.id)?.attachments ?? 0}
                latestComment={latestComment(selected.id)}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
          <div className="lg:hidden">
            <TaskCardsMobile groups={groups} canChange={canChange} pendingIds={pendingIds} onSetStatus={changeStatus} />
          </div>
        </>
      )}
    </>
  );
}
