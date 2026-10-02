import { useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, Hand, Play } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { TaskStatusChip } from '@/components/ui/Chip';
import { TaskStatus } from '@/types/schema';
import type { EventTask } from '@/types/entities';
import { formatDateOnly } from '@/utils/dates';
import { taskUiStatus } from '@/utils/format';
import type { TaskGroup } from '@/utils/taskGroups';
import { CheckButton } from './TaskTable';

const SWIPE_COMPLETE_PX = 96;
const SWIPE_MAX_PX = 140;

function SwipeCard({ task, canChange, pending, onSetStatus }: {
  task: EventTask; canChange: boolean; pending: boolean; onSetStatus: (t: EventTask, s: TaskStatus) => void;
}) {
  const ui = taskUiStatus(task);
  const done = task.status === TaskStatus.Completed;
  const swipeable = canChange && !done && !pending;
  const start = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!swipeable || (e.target as HTMLElement).closest('button, a')) return;
    start.current = { x: e.clientX, y: e.clientY };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    if (Math.abs(y) > Math.abs(x) && Math.abs(y) > 10) {
      start.current = null; // vertical scroll wins
      setDx(0);
      return;
    }
    if (x > 6) e.currentTarget.setPointerCapture(e.pointerId);
    setDx(Math.max(0, Math.min(SWIPE_MAX_PX, x)));
  };
  const onUp = () => {
    if (start.current && dx >= SWIPE_COMPLETE_PX) onSetStatus(task, TaskStatus.Completed);
    start.current = null;
    setDx(0);
  };

  return (
    <li className="relative overflow-hidden rounded-3xl">
      {swipeable && (
        <div aria-hidden className="absolute inset-0 flex items-center gap-2 rounded-3xl bg-green-600 pl-6 font-bold text-white">
          <Check className="size-5" /> {dx >= SWIPE_COMPLETE_PX ? 'Release to complete' : 'Complete'}
        </div>
      )}
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ transform: `translateX(${dx}px)`, touchAction: 'pan-y' }}
        className={`relative rounded-3xl border bg-white p-4 ${dx === 0 ? 'transition-transform' : ''} ${ui === 'overdue' ? 'border-red-50' : 'border-line'}`}
      >
        <div className="flex items-start gap-3">
          <CheckButton task={task} disabled={!canChange} pending={pending}
            onToggle={() => onSetStatus(task, done ? TaskStatus.Pending : TaskStatus.Completed)} />
          <div className="min-w-0 flex-1">
            <Link to={`/tasks/${task.id}`} className={`font-semibold hover:underline ${done ? 'text-muted line-through' : ''}`}>{task.title}</Link>
            <p className="truncate text-xs text-muted">{task.eventName}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`tabular ${ui === 'overdue' ? 'font-semibold text-red-700' : 'text-secondary'}`}>Due {formatDateOnly(task.dueDate, 'MMM d')}</span>
              <TaskStatusChip status={ui} />
            </div>
          </div>
          <Avatar person={task.assignee} size="sm" />
        </div>
        {ui === 'overdue' && canChange && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={pending || task.status === TaskStatus.InProgress}
              onClick={() => onSetStatus(task, TaskStatus.InProgress)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-white font-semibold text-ink disabled:opacity-50">
              <Play className="size-4" aria-hidden /> {task.status === TaskStatus.InProgress ? 'Started' : 'Start'}
            </button>
            <button type="button" disabled={pending} onClick={() => onSetStatus(task, TaskStatus.Completed)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-green-600 font-semibold text-white disabled:opacity-60">
              <Check className="size-4" aria-hidden /> Mark complete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

export function TaskCardsMobile({ groups, canChange, pendingIds, onSetStatus }: {
  groups: TaskGroup[];
  canChange: (t: EventTask) => boolean;
  pendingIds: Set<string>;
  onSetStatus: (t: EventTask, s: TaskStatus) => void;
}) {
  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 rounded-2xl bg-navy-50 px-4 py-3 text-sm text-navy-900">
        <Hand className="size-4 shrink-0" aria-hidden /> Tip: swipe a task to the right to mark it complete.
      </p>
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`grp-${g.key}`}>
          <h2 id={`grp-${g.key}`} className="mb-3 flex items-center gap-2 font-bold">
            <span className={`size-2.5 rounded-full ${g.dot}`} aria-hidden /> {g.label}
            <span className="tabular rounded-full bg-white px-2 text-xs text-secondary">{g.tasks.length}</span>
          </h2>
          <ul className="space-y-3">
            {g.tasks.map((t) => (
              <SwipeCard key={t.id} task={t} canChange={canChange(t)} pending={pendingIds.has(t.id)} onSetStatus={onSetStatus} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
