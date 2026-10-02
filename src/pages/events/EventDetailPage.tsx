import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CalendarPlus, CheckCircle2, ChevronRight, LayoutTemplate, MapPin, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { AddTaskDialog } from '@/components/events/AddTaskDialog';
import { ChangeTemplateDialog, type TemplateChangeResult } from '@/components/events/ChangeTemplateDialog';
import { DeleteEventDialog } from '@/components/events/DeleteEventDialog';
import { EditEventDialog } from '@/components/events/EditEventDialog';
import { ActivityTab } from '@/components/events/ActivityTab';
import { BudgetTab } from '@/components/events/BudgetTab';
import { MeetingList } from '@/components/meetings/MeetingList';
import { ScheduleMeetingDialog } from '@/components/meetings/ScheduleMeetingDialog';
import { ChecklistTab, type TaskCounts } from '@/components/events/ChecklistTab';
import { BudgetCard, NextMeetingCard, TeamCard } from '@/components/events/EventSideCards';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MenuButton } from '@/components/ui/MenuButton';
import { Chip, EventStatusChip } from '@/components/ui/Chip';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { useCancelMeeting, useSetTaskStatus } from '@/hooks/mutations';
import { useAttachments, useComments, useCurrentUser, useEvent, useExpenses, useMeetings, useTasks } from '@/hooks/queries';
import { EventStatus, TaskStatus } from '@/types/schema';
import type { EventTask, Meeting } from '@/types/entities';
import { addDaysDateOnly, daysUntil, eventLengthDays, formatDateRange, PHASES, phaseFor, todayDateOnly, type PhaseKey } from '@/utils/dates';
import { errorMessage } from '@/utils/format';

type TabKey = 'checklist' | 'budget' | 'meetings' | 'activity';

function templateNoticeText({ mode, templateName, added }: TemplateChangeResult): string {
  const tasks = `${added} task${added === 1 ? '' : 's'} added`;
  if (mode === 'clear') return 'The template was removed from this event. No tasks were added or removed.';
  if (mode === 'addMissing') return `${tasks} from "${templateName ?? ''}".`;
  return `Template changed to "${templateName ?? ''}" — ${tasks}.`;
}

/** Representative "days before" per phase, used to pre-fill a new task's due date. */
const PHASE_DEFAULT_DAYS: Record<PhaseKey, number> = { '8w+': 63, '4-8w': 42, '2-4w': 21, final2w: 7, eventWeek: 0 };

function Countdown({ eventDate, endDate, status }: { eventDate: string; endDate: string; status: EventStatus }) {
  const days = eventDate ? daysUntil(eventDate) : null;
  const daysSinceEnd = endDate ? -daysUntil(endDate) : -(days ?? 0);
  const length = eventLengthDays(eventDate, endDate);
  const [big, small] =
    status === EventStatus.Completed ? ['✓', 'COMPLETED']
      : status === EventStatus.Cancelled ? ['—', 'CANCELLED']
        : days === null ? ['—', 'NO DATE']
          : days > 0 ? [String(days), days === 1 ? 'DAY TO GO' : 'DAYS TO GO']
            : daysSinceEnd <= 0 ? (length > 1 ? [`${1 - days}/${length}`, 'EVENT DAY'] : ['0', 'TODAY'])
              : [String(daysSinceEnd), daysSinceEnd === 1 ? 'DAY AGO' : 'DAYS AGO'];
  return (
    <div className="flex min-w-32 flex-col items-center justify-center rounded-2xl bg-orange-50 px-5 py-4 text-orange-900" role="status" aria-label={`${big} ${small.toLowerCase()}`}>
      <span className="tabular text-4xl leading-none font-extrabold">{big}</span>
      <span className="mt-1 text-xs font-bold tracking-wider">{small}</span>
    </div>
  );
}

function Tabs({ value, onChange, tabs }: { value: TabKey; onChange: (t: TabKey) => void; tabs: { key: TabKey; label: string; count?: number }[] }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + tabs.length) % tabs.length;
    const tab = tabs[next];
    if (tab) onChange(tab.key);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label="Event sections" className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((t, i) => {
        const selected = t.key === value;
        return (
          <button key={t.key} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`tab-${t.key}`}
            aria-selected={selected} aria-controls={`panel-${t.key}`} tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.key)} onKeyDown={(e) => onKey(e, i)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${
              selected ? 'border-navy-700 bg-navy-700 text-white' : 'border-line bg-white text-secondary hover:bg-navy-50'
            }`}>
            {t.label}
            {t.count !== undefined && <span className={`tabular rounded-full px-2 text-xs ${selected ? 'bg-white/20' : 'bg-pending-bg text-pending'}`}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function EventDetailPage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const event = useEvent(eventId);
  const tasks = useTasks({ eventId }, Boolean(eventId));
  const eventIds = useMemo(() => [eventId], [eventId]);
  const expenses = useExpenses(eventIds);
  const meetings = useMeetings(eventIds);
  const taskIds = useMemo(() => (tasks.data ?? []).map((t) => t.id), [tasks.data]);
  const comments = useComments(taskIds);
  const attachments = useAttachments(taskIds);
  const setStatus = useSetTaskStatus();
  const [tab, setTab] = useState<TabKey>('checklist');
  const [dialogPhase, setDialogPhase] = useState<PhaseKey | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changingTemplate, setChangingTemplate] = useState(false);
  const [templateNotice, setTemplateNotice] = useState<string | null>(null);
  const cancelMeeting = useCancelMeeting();
  const [scheduled, setScheduled] = useState<{ subject: string; warning: string | null } | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [toggleError, setToggleError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, TaskCounts>();
    const bump = (id: string, key: keyof TaskCounts) => {
      const row = map.get(id) ?? { comments: 0, attachments: 0 };
      row[key] += 1;
      map.set(id, row);
    };
    comments.data?.forEach((c) => bump(c.eventTaskId, 'comments'));
    attachments.data?.forEach((a) => bump(a.objectId, 'attachments'));
    return map;
  }, [comments.data, attachments.data]);

  const isManager = user.data?.isManager ?? false;
  const canToggle = (t: EventTask) => isManager || t.assignee.id === user.data?.id;

  const toggle = (task: EventTask) => {
    const next = task.status === TaskStatus.Completed ? TaskStatus.Pending : TaskStatus.Completed;
    setToggleError(null);
    setPendingIds((s) => new Set(s).add(task.id));
    setStatus.mutate(
      { task, status: next },
      {
        onError: (e) => setToggleError(`"${task.title}" wasn't updated: ${errorMessage(e)}`),
        onSettled: () => setPendingIds((s) => { const n = new Set(s); n.delete(task.id); return n; }),
      },
    );
  };

  const onCancelMeeting = (m: Meeting) => {
    const ok = window.confirm(`Mark "${m.subject}" as cancelled?\n\nThis only updates EPM. Cancel the Teams invitation in Outlook or Teams first so attendees are notified.`);
    if (!ok) return;
    setToggleError(null);
    cancelMeeting.mutate(m.id, { onError: (e) => setToggleError(`"${m.subject}" wasn't cancelled: ${errorMessage(e)}`) });
  };

  if (event.isPending) {
    return (
      <LoadingRegion label="Loading event">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-44 rounded-3xl" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"><Skeleton className="h-96 rounded-3xl" /><Skeleton className="h-96 rounded-3xl" /></div>
      </LoadingRegion>
    );
  }
  if (event.isError) {
    const notFound = /404|does not exist|not found/i.test(errorMessage(event.error));
    return notFound ? (
      <EmptyState title="Event not found" description="It may have been deleted." action={<Link to="/events" className="font-semibold text-navy-700 underline">Back to events</Link>} />
    ) : (
      <ErrorState error={event.error} title="Couldn't load this event" onRetry={() => void event.refetch()} />
    );
  }

  const ev = event.data;
  const taskList = tasks.data ?? [];
  const dialogDefaultDue = dialogPhase && ev.eventDate ? addDaysDateOnly(ev.eventDate, -PHASE_DEFAULT_DAYS[dialogPhase]) : todayDateOnly();

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 text-sm">
        <ol className="flex flex-wrap items-center gap-1 text-secondary">
          <li><Link to="/events" className="inline-flex min-h-11 items-center font-semibold text-navy-700 hover:underline">Events</Link></li>
          <li aria-hidden><ChevronRight className="size-4" /></li>
          <li aria-current="page" className="truncate font-semibold text-ink">{ev.name}</li>
        </ol>
      </nav>

      {templateNotice && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-2xl bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="flex-1 font-semibold">{templateNotice}</p>
          <button type="button" aria-label="Dismiss" onClick={() => setTemplateNotice(null)} className="-m-2 flex size-11 items-center justify-center rounded-full">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      <Card className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <EventStatusChip status={ev.status} />
            {ev.template && <Chip tone="outline">Template · {ev.template.name || 'Unnamed'}</Chip>}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight lg:text-4xl">{ev.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-secondary">
            <span className="flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden />{ev.eventDate ? formatDateRange(ev.eventDate, ev.endDate, true) : 'No date'}</span>
            {ev.location && <span className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{ev.location}</span>}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {isManager && (
              <Button onClick={() => setDialogPhase(ev.eventDate ? phaseFor(daysUntil(ev.eventDate)) : 'eventWeek')} icon={<Plus className="size-4" aria-hidden />}>
                Add task
              </Button>
            )}
            <Button variant="outline" onClick={() => setScheduling(true)} icon={<CalendarPlus className="size-4" aria-hidden />}>Schedule meeting</Button>
            {isManager && (
              <Button variant="outline" onClick={() => setEditing(true)} icon={<Pencil className="size-4" aria-hidden />}>Edit event</Button>
            )}
            {isManager && (
              <MenuButton label="More actions" icon={<MoreHorizontal className="size-5" aria-hidden />} align="left" items={[
                { label: 'Change template', icon: <LayoutTemplate className="size-4" aria-hidden />, onSelect: () => setChangingTemplate(true) },
                { label: 'Delete event', danger: true, icon: <Trash2 className="size-4" aria-hidden />, onSelect: () => setDeleting(true) },
              ]} />
            )}
          </div>
        </div>
        <Countdown eventDate={ev.eventDate} endDate={ev.endDate} status={ev.status} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <Tabs value={tab} onChange={setTab} tabs={[
            { key: 'checklist', label: 'Checklist', count: taskList.length },
            { key: 'budget', label: 'Budget' },
            { key: 'meetings', label: 'Meetings', count: meetings.data?.length },
            { key: 'activity', label: 'Activity' },
          ]} />
          <Card as="div" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-4">
            {scheduled && (
              <div role="status" className={`mb-4 flex items-start gap-2 rounded-2xl p-3 text-sm ${scheduled.warning ? 'bg-orange-50 text-orange-900' : 'bg-green-50 text-green-700'}`}>
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p className="flex-1 font-semibold">"{scheduled.subject}" was scheduled.{scheduled.warning ? ` ${scheduled.warning}` : ''}</p>
                <button type="button" aria-label="Dismiss" onClick={() => setScheduled(null)} className="-m-2 flex size-11 items-center justify-center rounded-full">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            )}
            {toggleError && (
              <div role="alert" className="mb-4 flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p className="flex-1">{toggleError}</p>
                <button type="button" aria-label="Dismiss" onClick={() => setToggleError(null)} className="-m-2 flex size-11 items-center justify-center rounded-full">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            )}
            {tab === 'checklist' ? (
              tasks.isPending ? (
                <LoadingRegion label="Loading tasks">
                  <Skeleton className="h-4 w-40" /><Skeleton className="mt-3 h-2" /><Skeleton className="mt-5 h-11 w-3/4 rounded-full" />
                  {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="mt-3 h-14" />)}
                </LoadingRegion>
              ) : tasks.isError ? (
                <ErrorState error={tasks.error} title="Couldn't load tasks" onRetry={() => void tasks.refetch()} />
              ) : (
                <ChecklistTab tasks={taskList} eventDate={ev.eventDate} counts={counts} canToggle={canToggle} pendingIds={pendingIds}
                  onToggle={toggle} canAdd={isManager} onAdd={setDialogPhase} />
              )
            ) : tab === 'budget' ? (
              <BudgetTab eventId={ev.id} budgetBase={ev.budgetBase ?? 0} tasks={taskList} canEdit={isManager} />
            ) : tab === 'meetings' ? (
              meetings.isPending ? (
                <LoadingRegion label="Loading meetings">{[0, 1].map((i) => <Skeleton key={i} className="mt-3 h-20" />)}</LoadingRegion>
              ) : meetings.isError ? (
                <ErrorState error={meetings.error} title="Couldn't load meetings" onRetry={() => void meetings.refetch()} />
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="font-bold">Meetings</h3>
                    <Button onClick={() => setScheduling(true)} icon={<CalendarPlus className="size-4" aria-hidden />}>Schedule meeting</Button>
                  </div>
                  {meetings.data.length === 0 ? (
                    <EmptyState icon={<CalendarPlus className="size-6" />} title="No meetings yet"
                      description="Schedule a Teams meeting to review tasks with your team." />
                  ) : <MeetingList meetings={meetings.data} onCancel={isManager ? onCancelMeeting : undefined}
                    cancellingId={cancelMeeting.isPending ? cancelMeeting.variables : null} />}
                </>
              )
            ) : (
              <ActivityTab tasks={taskList} />
            )}
          </Card>
        </div>

        <aside className="space-y-6" aria-label="Event summary">
          <BudgetCard budgetBase={ev.budgetBase ?? 0} expenses={expenses.data} isPending={expenses.isPending} error={expenses.error} onRetry={() => void expenses.refetch()} />
          <NextMeetingCard meetings={meetings.data} isPending={meetings.isPending} error={meetings.error} onRetry={() => void meetings.refetch()} />
          <TeamCard tasks={taskList} />
        </aside>
      </div>

      {editing && <EditEventDialog event={ev} onClose={() => setEditing(false)} />}
      {changingTemplate && (
        <ChangeTemplateDialog event={ev} onClose={() => setChangingTemplate(false)}
          onChanged={(r) => { setChangingTemplate(false); setTemplateNotice(templateNoticeText(r)); setTab('checklist'); }} />
      )}
      {deleting && (
        <DeleteEventDialog event={ev} onClose={() => setDeleting(false)}
          onGoToMeetings={() => { setDeleting(false); setTab('meetings'); }}
          onDeleted={(name) => navigate('/events', { state: { deleted: { name } } })} />
      )}

      {scheduling && (
        <ScheduleMeetingDialog
          eventId={ev.id}
          eventName={ev.name}
          tasks={taskList}
          onClose={() => setScheduling(false)}
          onScheduled={(r) => {
            setScheduling(false);
            setScheduled({ subject: r.subject, warning: r.warning });
            setTab('meetings');
          }}
        />
      )}

      {dialogPhase && (
        <AddTaskDialog
          open
          onClose={() => setDialogPhase(null)}
          eventId={ev.id}
          eventDate={ev.eventDate}
          defaultDueDate={dialogDefaultDue}
          phaseLabel={PHASES.find((p) => p.key === dialogPhase)?.label}
        />
      )}
    </>
  );
}
