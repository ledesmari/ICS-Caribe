import { useId, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Check, ChevronRight, Copy, ExternalLink, MoreHorizontal, RotateCcw, Users } from 'lucide-react';
import { AttachmentsSection } from '@/components/tasks/AttachmentsSection';
import { CommentsSection, HistoryTimeline } from '@/components/tasks/TaskActivity';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip, TaskStatusChip } from '@/components/ui/Chip';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { useSaveTask, useSetTaskStatus } from '@/hooks/mutations';
import { useAssignableUsers, useAttachments, useComments, useCurrentUser, useEvent, useMeetings, useTask, useTaskExpenses, useTaskHistory } from '@/hooks/queries';
import { HistoryAction, TaskStatus } from '@/types/schema';
import { daysBeforeEvent, formatDateOnly, formatDateRange, formatDateTime, PHASES, phaseFor } from '@/utils/dates';
import { EXPENSE_CATEGORY_LABEL, EXPENSE_STATUS_LABEL, errorMessage, formatCurrency, TASK_STATUS_OPTIONS, taskUiStatus } from '@/utils/format';

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-page p-4">
      <p className="text-xs font-semibold tracking-wide text-secondary uppercase">{label}</p>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}

function MoreMenu({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuId = useId();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setOpen(false);
    }
  };
  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      <Button variant="outline" size="icon" aria-label="More actions" aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}
        onClick={() => setOpen((v) => !v)} icon={<MoreHorizontal className="size-5" aria-hidden />} />
      {open && (
        <div id={menuId} role="menu" className="absolute right-0 z-20 mt-2 w-52 rounded-2xl border border-line bg-white p-1.5 shadow-lg">
          <button type="button" role="menuitem" autoFocus onClick={() => void copy()} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm hover:bg-navy-50">
            <Copy className="size-4" aria-hidden /> Copy link
          </button>
          <Link role="menuitem" to={`/events/${eventId}`} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm hover:bg-navy-50">
            <ExternalLink className="size-4" aria-hidden /> Open event
          </Link>
        </div>
      )}
      <span role="status" className="sr-only">{copied ? 'Link copied' : ''}</span>
    </div>
  );
}

export default function TaskDetailPage() {
  const { taskId = '' } = useParams();
  const descId = useId();
  const user = useCurrentUser();
  const task = useTask(taskId);
  const event = useEvent(task.data?.eventId);
  const ids = [taskId];
  const comments = useComments(ids);
  const attachments = useAttachments(ids);
  const history = useTaskHistory(taskId);
  const expenses = useTaskExpenses(taskId);
  const users = useAssignableUsers();
  const eventMeetings = useMeetings(task.data?.eventId ? [task.data.eventId] : undefined);
  const setStatus = useSetTaskStatus();
  const save = useSaveTask();
  const [descDraft, setDescDraft] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  if (task.isPending) {
    return (
      <LoadingRegion label="Loading task">
        <Skeleton className="h-4 w-56" /><Skeleton className="mt-4 h-40 rounded-3xl" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"><Skeleton className="h-80 rounded-3xl" /><Skeleton className="h-80 rounded-3xl" /></div>
      </LoadingRegion>
    );
  }
  if (task.isError) {
    return /404|does not exist|not found/i.test(errorMessage(task.error))
      ? <EmptyState title="Task not found" description="It may have been deleted." action={<Link to="/tasks" className="font-semibold text-navy-700 underline">Back to tasks</Link>} />
      : <ErrorState error={task.error} title="Couldn't load this task" onRetry={() => void task.refetch()} />;
  }

  const t = task.data;
  const isManager = user.data?.isManager ?? false;
  const canEdit = isManager || t.assignee.id === user.data?.id;
  const ui = taskUiStatus(t);
  const done = t.status === TaskStatus.Completed;
  const eventDate = event.data?.eventDate ?? '';
  const offset = eventDate && t.dueDate ? daysBeforeEvent(t.dueDate, eventDate) : null;
  const phaseLabel = offset === null ? null : PHASES.find((p) => p.key === phaseFor(offset))?.label;
  const expense = expenses.data?.[0];
  // Meetings that listed this task for review (recorded as "Meeting Scheduled" history; newValue = meeting id).
  const scheduledIds = new Set((history.data ?? []).filter((h) => h.action === HistoryAction.MeetingScheduled).map((h) => h.newValue));
  const nowIso = new Date().toISOString();
  const reviewedIn = (eventMeetings.data ?? []).filter((m) => scheduledIds.has(m.id)).sort((a, b) => b.start.localeCompare(a.start));
  const description = descDraft ?? t.description;

  const changeStatus = (next: TaskStatus) => {
    setProblem(null);
    setStatus.mutate({ task: t, status: next }, { onError: (e) => setProblem(`Status not changed: ${errorMessage(e)}`) });
  };
  const saveField = (changes: Parameters<typeof save.mutate>[0]['changes'], onDone?: () => void) => {
    setProblem(null);
    save.mutate({ task: t, changes }, { onSuccess: onDone, onError: (e) => setProblem(`Not saved: ${errorMessage(e)}`) });
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm">
        <ol className="flex flex-wrap items-center gap-1 text-secondary">
          <li><Link to="/events" className="inline-flex min-h-11 items-center font-semibold text-navy-700 hover:underline">Events</Link></li>
          <li aria-hidden><ChevronRight className="size-4" /></li>
          <li><Link to={`/events/${t.eventId}`} className="inline-flex min-h-11 max-w-56 items-center truncate font-semibold text-navy-700 hover:underline">{t.eventName || 'Event'}</Link></li>
          <li aria-hidden><ChevronRight className="size-4" /></li>
          <li aria-current="page" className="max-w-64 truncate font-semibold text-ink">{t.title}</li>
        </ol>
      </nav>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <TaskStatusChip status={ui} />
              {phaseLabel && <Chip tone="outline">{phaseLabel}</Chip>}
            </div>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight break-words sm:text-3xl">{t.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <MoreMenu eventId={t.eventId} />
            {canEdit && (done ? (
              <Button variant="outline" disabled={setStatus.isPending} onClick={() => changeStatus(TaskStatus.Pending)} icon={<RotateCcw className="size-4" aria-hidden />}>Reopen</Button>
            ) : (
              <Button variant="success" disabled={setStatus.isPending} onClick={() => changeStatus(TaskStatus.Completed)} icon={<Check className="size-4" aria-hidden />}>Mark complete</Button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <SegmentedControl<TaskStatus> label="Task status" value={t.status} onChange={changeStatus} size="lg"
            options={TASK_STATUS_OPTIONS.map((o) => ({ ...o, disabled: !canEdit || setStatus.isPending }))} />
        </div>

        {problem && (
          <p role="alert" className="mt-4 flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="size-4 shrink-0" aria-hidden /> {problem}
          </p>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="Assignee">
            {isManager ? (
              <label className="flex items-center gap-2">
                <Avatar person={t.assignee} size="sm" />
                <span className="sr-only">Reassign task</span>
                <select className="min-h-11 w-full min-w-0 rounded-xl border border-line bg-white px-2 text-sm" value={t.assignee.id}
                  disabled={save.isPending || users.isPending}
                  onChange={(e) => { const u = users.data?.find((x) => x.id === e.target.value); if (u) saveField({ assignee: u }); }}>
                  {!users.data?.some((u) => u.id === t.assignee.id) && <option value={t.assignee.id}>{t.assignee.name || 'Unknown'}</option>}
                  {users.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
            ) : (
              <span className="flex items-center gap-2 font-semibold"><Avatar person={t.assignee} size="sm" /><span className="truncate">{t.assignee.name}</span></span>
            )}
          </Tile>
          <Tile label="Due date">
            {isManager ? (
              <input type="date" aria-label="Due date" className="min-h-11 w-full rounded-xl border border-line bg-white px-2 text-sm" value={t.dueDate}
                disabled={save.isPending} onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) saveField({ dueDate: e.target.value }); }} />
            ) : (
              <p className={`font-semibold ${ui === 'overdue' ? 'text-red-700' : ''}`}>{formatDateOnly(t.dueDate)}</p>
            )}
            <p className="mt-1 text-xs text-muted">
              {offset === null ? '' : offset > 0 ? `${offset} days before the event` : offset === 0 ? 'On the event day' : `${-offset} days after the event`}
            </p>
          </Tile>
          <Tile label="Event">
            <Link to={`/events/${t.eventId}`} className="block truncate font-semibold text-navy-700 hover:underline">{t.eventName || 'Event'}</Link>
            {eventDate && <p className="mt-1 text-xs text-muted">{formatDateRange(eventDate, event.data?.endDate ?? '')}</p>}
          </Tile>
          <Tile label="Linked expense">
            {expenses.isPending ? <Skeleton className="h-5 w-20" /> : expense ? (
              <>
                <p className="tabular font-semibold">{formatCurrency(expense.actualAmount ?? expense.estimatedAmount)}</p>
                <p className="mt-1 truncate text-xs text-muted">{EXPENSE_CATEGORY_LABEL[expense.category]} · {EXPENSE_STATUS_LABEL[expense.status]}</p>
              </>
            ) : <p className="text-muted">None</p>}
          </Tile>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Card aria-labelledby={`${descId}-h`}>
            <CardHeader id={`${descId}-h`} title="Description" />
            {canEdit ? (
              <>
                <label htmlFor={descId} className="sr-only">Description</label>
                <textarea id={descId} rows={4} maxLength={4000} value={description} placeholder="Add details for this task…"
                  disabled={save.isPending} onChange={(e) => setDescDraft(e.target.value)}
                  className="w-full resize-y rounded-xl border border-line px-4 py-2 text-sm" />
                {descDraft !== null && descDraft !== t.description && (
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDescDraft(null)} disabled={save.isPending}>Cancel</Button>
                    <Button variant="secondary" disabled={save.isPending} onClick={() => saveField({ description: descDraft }, () => setDescDraft(null))}>
                      {save.isPending ? 'Saving…' : 'Save description'}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm whitespace-pre-wrap text-secondary">{t.description || 'No description.'}</p>
            )}
          </Card>

          <AttachmentsSection taskId={t.id} attachments={attachments.data} isPending={attachments.isPending} error={attachments.error}
            onRetry={() => void attachments.refetch()} canEdit={canEdit} />

          <CommentsSection taskId={t.id} assigneeId={t.assignee.id} comments={comments.data} isPending={comments.isPending}
            error={comments.error} onRetry={() => void comments.refetch()} canComment={canEdit} />
        </div>

        <aside className="space-y-6" aria-label="Task activity">
          <Card aria-labelledby="reviewed-h">
            <CardHeader id="reviewed-h" title="Reviewed in" />
            {reviewedIn.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Users className="size-4" aria-hidden /> Not on any meeting agenda yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {reviewedIn.map((m) => (
                  <li key={m.id} className="text-sm">
                    <p className="font-semibold">{m.subject}</p>
                    <p className="text-secondary">{formatDateTime(m.start, 'EEE, MMM d · h:mm a')}</p>
                    {m.joinUrl && m.end >= nowIso && (
                      <a href={m.joinUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-1 font-semibold text-navy-700 hover:underline">
                        Join on Teams <ExternalLink className="size-3.5" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <HistoryTimeline history={history.data} isPending={history.isPending} error={history.error} onRetry={() => void history.refetch()} />
        </aside>
      </div>
    </>
  );
}
