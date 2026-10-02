/** Grouping for the Tasks page: by due-date bucket (default) or by event. */
import { addWeeks, endOfWeek } from 'date-fns';
import type { DateOnly, EventTask } from '@/types/entities';
import { toDateOnly, todayDateOnly } from '@/utils/dates';
import { isTaskOverdue } from '@/utils/format';

export type GroupBy = 'due' | 'event';
export type DueBucket = 'overdue' | 'thisWeek' | 'nextWeek' | 'later' | 'earlier';

export interface TaskGroup {
  key: string;
  label: string;
  /** Tailwind bg-* class for the group's colored dot. */
  dot: string;
  tasks: EventTask[];
}

const BUCKETS: { key: DueBucket; label: string; dot: string }[] = [
  { key: 'overdue', label: 'Overdue', dot: 'bg-red-600' },
  { key: 'thisWeek', label: 'This week', dot: 'bg-orange-500' },
  { key: 'nextWeek', label: 'Next week', dot: 'bg-navy-700' },
  { key: 'later', label: 'Later', dot: 'bg-navy-300' },
  { key: 'earlier', label: 'Earlier (done)', dot: 'bg-green-600' },
];

export function dueBucket(task: EventTask, today: DateOnly = todayDateOnly(), now = new Date()): DueBucket {
  if (isTaskOverdue(task, today)) return 'overdue';
  if (task.dueDate && task.dueDate < today) return 'earlier';
  const weekEnd = toDateOnly(endOfWeek(now, { weekStartsOn: 1 }));
  const nextWeekEnd = toDateOnly(endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 }));
  if (!task.dueDate || task.dueDate <= weekEnd) return 'thisWeek';
  if (task.dueDate <= nextWeekEnd) return 'nextWeek';
  return 'later';
}

const byDue = (a: EventTask, b: EventTask) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title);

/** Non-empty groups in display order. */
export function groupTasks(tasks: EventTask[], by: GroupBy): TaskGroup[] {
  if (by === 'event') {
    const map = new Map<string, TaskGroup>();
    for (const t of tasks) {
      const g = map.get(t.eventId) ?? { key: t.eventId, label: t.eventName || 'No event', dot: 'bg-navy-700', tasks: [] };
      g.tasks.push(t);
      map.set(t.eventId, g);
    }
    return [...map.values()].map((g) => ({ ...g, tasks: g.tasks.sort(byDue) })).sort((a, b) => a.label.localeCompare(b.label));
  }
  const today = todayDateOnly();
  const now = new Date();
  return BUCKETS.map((b) => ({ ...b, tasks: tasks.filter((t) => dueBucket(t, today, now) === b.key).sort(byDue) })).filter((g) => g.tasks.length > 0);
}
