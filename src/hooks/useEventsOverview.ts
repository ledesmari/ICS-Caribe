/** Events + tasks + expenses → per-event stats and the Events page KPIs. */
import { useMemo } from 'react';
import { endOfWeek } from 'date-fns';
import { useEvents, useExpenses, useTasks } from '@/hooks/queries';
import { EventStatus, ExpenseStatus, TaskStatus } from '@/types/schema';
import type { DateOnly, EpmEvent, EventTask, Expense, Ref } from '@/types/entities';
import { toDateOnly, todayDateOnly } from '@/utils/dates';
import { isTaskOverdue } from '@/utils/format';

export interface EventStats {
  event: EpmEvent;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  /** Sum of actual amounts (base currency), cancelled expenses excluded. */
  spentBase: number;
  budgetBase: number;
  assignees: Ref[];
}

export interface EventsKpis {
  activeEvents: number;
  dueThisWeek: number;
  overdue: number;
  spentBase: number;
  budgetBase: number;
}

export function computeEventStats(events: EpmEvent[], tasks: EventTask[], expenses: Expense[], today: DateOnly = todayDateOnly()) {
  const weekEnd = toDateOnly(endOfWeek(new Date(), { weekStartsOn: 1 }));
  const tasksByEvent = new Map<string, EventTask[]>();
  for (const t of tasks) tasksByEvent.set(t.eventId, [...(tasksByEvent.get(t.eventId) ?? []), t]);
  const spentByEvent = new Map<string, number>();
  for (const x of expenses) {
    if (x.status === ExpenseStatus.Cancelled) continue;
    spentByEvent.set(x.eventId, (spentByEvent.get(x.eventId) ?? 0) + (x.actualAmountBase ?? 0));
  }

  const stats: EventStats[] = events.map((event) => {
    const list = tasksByEvent.get(event.id) ?? [];
    const people = new Map<string, Ref>();
    for (const t of list) if (t.assignee.id) people.set(t.assignee.id, t.assignee);
    return {
      event,
      totalTasks: list.length,
      doneTasks: list.filter((t) => t.status === TaskStatus.Completed).length,
      overdueTasks: list.filter((t) => isTaskOverdue(t, today)).length,
      spentBase: spentByEvent.get(event.id) ?? 0,
      budgetBase: event.budgetBase ?? 0,
      assignees: [...people.values()],
    };
  });

  const openTasks = tasks.filter((t) => t.status !== TaskStatus.Completed);
  const kpis: EventsKpis = {
    activeEvents: events.filter((e) => e.status === EventStatus.Active).length,
    dueThisWeek: openTasks.filter((t) => t.dueDate >= today && t.dueDate <= weekEnd).length,
    overdue: openTasks.filter((t) => isTaskOverdue(t, today)).length,
    spentBase: stats.reduce((s, x) => s + x.spentBase, 0),
    budgetBase: stats.reduce((s, x) => s + x.budgetBase, 0),
  };
  return { stats, kpis };
}

export function useEventsOverview() {
  const events = useEvents();
  const tasks = useTasks();
  const expenses = useExpenses();
  const queries = [events, tasks, expenses];

  const data = useMemo(
    () => (events.data && tasks.data && expenses.data ? computeEventStats(events.data, tasks.data, expenses.data) : null),
    [events.data, tasks.data, expenses.data],
  );

  return {
    data,
    isPending: queries.some((q) => q.isPending),
    error: queries.find((q) => q.isError)?.error ?? null,
    refetch: () => queries.forEach((q) => void q.refetch()),
  };
}
