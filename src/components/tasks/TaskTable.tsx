import { Check, MessageSquare, Paperclip } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { TaskStatusChip } from '@/components/ui/Chip';
import { TaskStatus } from '@/types/schema';
import type { EventTask } from '@/types/entities';
import { formatDateOnly } from '@/utils/dates';
import { taskUiStatus } from '@/utils/format';
import type { TaskGroup } from '@/utils/taskGroups';

export interface TaskActivity {
  comments: number;
  attachments: number;
}

export function CheckButton({ task, disabled, pending, onToggle, size = 'md' }: {
  task: EventTask; disabled: boolean; pending: boolean; onToggle: () => void; size?: 'md' | 'lg';
}) {
  const done = task.status === TaskStatus.Completed;
  const overdue = taskUiStatus(task) === 'overdue';
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      disabled={disabled || pending}
      aria-pressed={done}
      aria-label={done ? `Mark "${task.title}" as not complete` : `Mark "${task.title}" complete`}
      title={disabled ? 'Only the assignee or a manager can change this task' : undefined}
      className={`flex shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed ${size === 'lg' ? 'size-12' : 'size-11'} ${
        done ? 'bg-green-600 text-white' : overdue ? 'border-2 border-red-600 bg-white text-red-600' : 'border-2 border-line bg-white text-transparent hover:text-muted'
      } ${pending ? 'opacity-60' : ''}`}
    >
      <Check className="size-5" aria-hidden />
    </button>
  );
}

export function TaskTable({ groups, selectedId, onSelect, activity, canToggle, pendingIds, onToggle }: {
  groups: TaskGroup[];
  selectedId: string | null;
  onSelect: (task: EventTask) => void;
  activity: Map<string, TaskActivity>;
  canToggle: (t: EventTask) => boolean;
  pendingIds: Set<string>;
  onToggle: (t: EventTask) => void;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white">
      <table className="w-full text-sm">
        <thead className="sr-only">
          <tr><th>Done</th><th>Task</th><th>Assignee</th><th>Due</th><th>Status</th><th>Activity</th></tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.key}>
            <tr className="bg-page">
              <th colSpan={6} scope="colgroup" className="px-5 py-2.5 text-left">
                <span className="flex items-center gap-2 font-bold">
                  <span className={`size-2.5 rounded-full ${g.dot}`} aria-hidden />
                  {g.label}
                  <span className="tabular rounded-full bg-white px-2 text-xs text-secondary">{g.tasks.length}</span>
                </span>
              </th>
            </tr>
            {g.tasks.map((t) => {
              const ui = taskUiStatus(t);
              const selected = t.id === selectedId;
              const act = activity.get(t.id) ?? { comments: 0, attachments: 0 };
              return (
                <tr
                  key={t.id}
                  onClick={() => onSelect(t)}
                  aria-selected={selected}
                  className={`cursor-pointer border-t border-line ${selected ? 'bg-navy-50 shadow-[inset_3px_0_0_var(--color-navy-700)]' : ui === 'overdue' ? 'bg-red-50/40 hover:bg-navy-50/60' : 'hover:bg-navy-50/60'}`}
                >
                  <td className="w-16 py-2 pl-4"><CheckButton task={t} disabled={!canToggle(t)} pending={pendingIds.has(t.id)} onToggle={() => onToggle(t)} /></td>
                  <td className="max-w-0 py-2 pr-3">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onSelect(t); }}
                      className={`block w-full truncate text-left font-semibold hover:underline ${t.status === TaskStatus.Completed ? 'text-muted line-through' : ''}`}>
                      {t.title}
                    </button>
                    <span className="block truncate text-xs text-muted">{t.eventName}</span>
                  </td>
                  <td className="w-44 py-2 pr-3">
                    <span className="flex items-center gap-2"><Avatar person={t.assignee} size="sm" /><span className="truncate">{t.assignee.name}</span></span>
                  </td>
                  <td className={`tabular w-20 py-2 pr-3 ${ui === 'overdue' ? 'font-semibold text-red-700' : 'text-secondary'}`}>{formatDateOnly(t.dueDate, 'MMM d')}</td>
                  <td className="w-28 py-2 pr-3"><TaskStatusChip status={ui} /></td>
                  <td className="w-24 py-2 pr-5 text-muted">
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1" aria-label={`${act.comments} comments`}><MessageSquare className="size-4" aria-hidden /><span className="tabular">{act.comments}</span></span>
                      <span className="flex items-center gap-1" aria-label={`${act.attachments} attachments`}><Paperclip className="size-4" aria-hidden /><span className="tabular">{act.attachments}</span></span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
