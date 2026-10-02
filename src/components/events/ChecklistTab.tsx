import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ListChecks, MessageSquare, Paperclip, Plus } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Chip, TaskStatusChip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/States';
import { TaskStatus } from '@/types/schema';
import type { EventTask } from '@/types/entities';
import { daysBeforeEvent, daysUntil, formatDateOnly, PHASES, phaseFor, type PhaseKey } from '@/utils/dates';
import { taskUiStatus } from '@/utils/format';

export interface TaskCounts {
  comments: number;
  attachments: number;
}

function TaskRow({ task, counts, canToggle, pending, onToggle }: {
  task: EventTask; counts: TaskCounts; canToggle: boolean; pending: boolean; onToggle: () => void;
}) {
  const ui = taskUiStatus(task);
  const done = task.status === TaskStatus.Completed;
  const overdue = ui === 'overdue';
  return (
    <li className={`flex items-start gap-3 rounded-2xl px-3 py-3 sm:items-center ${overdue ? 'bg-red-50/50' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={!canToggle || pending}
        aria-pressed={done}
        aria-label={done ? `Mark "${task.title}" as not complete` : `Mark "${task.title}" complete`}
        title={canToggle ? undefined : 'Only the assignee or a manager can change this task'}
        className={`flex size-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed ${
          done ? 'bg-green-600 text-white' : overdue ? 'border-2 border-red-600 bg-white text-red-600' : 'border-2 border-line bg-white text-transparent hover:text-muted'
        } ${pending ? 'opacity-60' : ''}`}
      >
        <Check className="size-5" aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <Link to={`/tasks/${task.id}`} className={`font-semibold hover:underline ${done ? 'text-muted line-through' : ''}`}>
          {task.title}
        </Link>
        {task.description && <p className="truncate text-sm text-muted">{task.description}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary sm:hidden">
          <span className={overdue ? 'font-semibold text-red-700' : ''}>Due {formatDateOnly(task.dueDate, 'MMM d')}</span>
          <TaskStatusChip status={ui} />
        </div>
      </div>

      <div className="hidden items-center gap-4 text-sm sm:flex">
        <span className="flex items-center gap-3 text-muted">
          <span className="flex items-center gap-1" aria-label={`${counts.comments} comments`}>
            <MessageSquare className="size-4" aria-hidden /> <span className="tabular">{counts.comments}</span>
          </span>
          <span className="flex items-center gap-1" aria-label={`${counts.attachments} attachments`}>
            <Paperclip className="size-4" aria-hidden /> <span className="tabular">{counts.attachments}</span>
          </span>
        </span>
        <Avatar person={task.assignee} size="sm" />
        <span className={`tabular w-14 text-right ${overdue ? 'font-semibold text-red-700' : 'text-secondary'}`}>{formatDateOnly(task.dueDate, 'MMM d')}</span>
        <span className="w-24 text-right"><TaskStatusChip status={ui} /></span>
      </div>
      <Avatar person={task.assignee} size="sm" className="sm:hidden" />
    </li>
  );
}

export function ChecklistTab({ tasks, eventDate, counts, canToggle, pendingIds, onToggle, canAdd, onAdd }: {
  tasks: EventTask[];
  eventDate: string;
  counts: Map<string, TaskCounts>;
  canToggle: (task: EventTask) => boolean;
  pendingIds: Set<string>;
  onToggle: (task: EventTask) => void;
  canAdd: boolean;
  onAdd: (phase: PhaseKey) => void;
}) {
  const byPhase = useMemo(() => {
    const map = new Map<PhaseKey, EventTask[]>(PHASES.map((p) => [p.key, []]));
    for (const t of tasks) {
      const key = eventDate && t.dueDate ? phaseFor(daysBeforeEvent(t.dueDate, eventDate)) : 'eventWeek';
      map.get(key)?.push(t);
    }
    for (const list of map.values()) list.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title));
    return map;
  }, [tasks, eventDate]);

  const todayPhase: PhaseKey = eventDate ? phaseFor(daysUntil(eventDate)) : 'eventWeek';
  const [phase, setPhase] = useState<PhaseKey>(todayPhase);

  const done = tasks.filter((t) => t.status === TaskStatus.Completed).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const visible = byPhase.get(phase) ?? [];
  const phaseLabel = PHASES.find((p) => p.key === phase)?.label ?? '';

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-semibold">
          <span className="tabular">{done} of {tasks.length}</span> complete
        </p>
        <Chip tone="navy">{pct}%</Chip>
      </div>
      <ProgressBar value={done} max={tasks.length} label={`${done} of ${tasks.length} tasks complete`} />

      <SegmentedControl<PhaseKey>
        className="mt-5"
        label="Checklist phase"
        value={phase}
        onChange={setPhase}
        options={PHASES.map((p) => {
          const list = byPhase.get(p.key) ?? [];
          const doneInPhase = list.filter((t) => t.status === TaskStatus.Completed).length;
          return {
            value: p.key,
            label: (
              <>
                {p.label}
                <span className="tabular text-xs opacity-80">{doneInPhase}/{list.length}</span>
                {p.key === todayPhase && <span className="sr-only">(current phase)</span>}
              </>
            ),
          };
        })}
      />

      <div className="mt-4">
        {tasks.length === 0 ? (
          <EmptyState icon={<ListChecks className="size-6" />} title="No tasks yet" description={canAdd ? 'Add the first task to start the checklist.' : 'Tasks will appear here once a manager adds them.'} />
        ) : visible.length === 0 ? (
          <p className="rounded-2xl bg-page px-4 py-6 text-center text-sm text-muted">No tasks in “{phaseLabel}”.</p>
        ) : (
          <ul className="divide-y divide-line" aria-label={`${phaseLabel} tasks`}>
            {visible.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                counts={counts.get(t.id) ?? { comments: 0, attachments: 0 }}
                canToggle={canToggle(t)}
                pending={pendingIds.has(t.id)}
                onToggle={() => onToggle(t)}
              />
            ))}
          </ul>
        )}
        {canAdd && (
          <button
            type="button"
            onClick={() => onAdd(phase)}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line font-semibold text-secondary hover:border-navy-300 hover:bg-navy-50"
          >
            <Plus className="size-4" aria-hidden /> Add task to this phase
          </button>
        )}
      </div>
    </div>
  );
}
