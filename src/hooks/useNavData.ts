/** Derived data for the navigation shell: Tasks badge and "Coming up" events. */
import { useMemo } from 'react';
import { endOfWeek } from 'date-fns';
import { useCurrentUser, useEvents, useTasks } from '@/hooks/queries';
import { EventStatus, TaskStatus } from '@/types/schema';
import { toDateOnly, todayDateOnly } from '@/utils/dates';

/** My open tasks that are overdue or due by the end of this week. */
export function useMyTaskBadge(): number {
  const user = useCurrentUser();
  const tasks = useTasks({ assigneeId: user.data?.id }, Boolean(user.data?.id));
  return useMemo(() => {
    const weekEnd = toDateOnly(endOfWeek(new Date(), { weekStartsOn: 1 }));
    return (tasks.data ?? []).filter((t) => t.status !== TaskStatus.Completed && t.dueDate && t.dueDate <= weekEnd).length;
  }, [tasks.data]);
}

/** Next upcoming or in-progress events (ending today or later, not completed/cancelled), soonest first. */
export function useComingUp(limit = 2) {
  const events = useEvents();
  const items = useMemo(() => {
    const today = todayDateOnly();
    return (events.data ?? [])
      .filter((e) => e.endDate >= today && e.status !== EventStatus.Completed && e.status !== EventStatus.Cancelled)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
      .slice(0, limit);
  }, [events.data, limit]);
  return { items, isPending: events.isPending, isError: events.isError };
}
