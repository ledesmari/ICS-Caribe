/**
 * Reports page calculations. Pure functions over the same lists the Events page loads,
 * so totals match the Events KPIs:
 * - Spent = Σ actualAmountBase of non-cancelled expenses (includes Estimated status); cancelled events count.
 * - Overdue = isTaskOverdue(); due soon = open tasks due today … today + DUE_SOON_DAYS.
 * - On time = completedOn ≤ dueDate (completed tasks without completedOn are excluded and counted).
 */
import { endOfQuarter, startOfQuarter } from 'date-fns';
import { computeEventStats, type EventStats } from '@/hooks/useEventsOverview';
import { EventStatus, ExpenseCategory, ExpenseStatus, TaskStatus } from '@/types/schema';
import type { DateOnly, EpmEvent, EventTask, Expense, Ref } from '@/types/entities';
import { addDaysDateOnly, daysUntil, parseDateOnly, toDateOnly, todayDateOnly } from './dates';
import { isTaskOverdue } from './format';

export const DUE_SOON_DAYS = 3;
/** Dataverse returns at most 5,000 rows per page; a list this long may be incomplete. */
export const ROW_LIMIT = 5000;

export type DatePreset = 'all' | 'next30' | 'next90' | 'thisQuarter' | 'past90' | 'custom';

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'All dates' },
  { value: 'next30', label: 'Next 30 days' },
  { value: 'next90', label: 'Next 90 days' },
  { value: 'thisQuarter', label: 'This quarter' },
  { value: 'past90', label: 'Past 90 days' },
  { value: 'custom', label: 'Custom range' },
];

export interface ReportFilters {
  preset: DatePreset;
  /** Only used when preset is 'custom'. */
  from: DateOnly;
  to: DateOnly;
  status: 'all' | EventStatus;
  eventId: string;
  assigneeId: string;
}

export const DEFAULT_FILTERS: ReportFilters = { preset: 'all', from: '', to: '', status: 'all', eventId: '', assigneeId: '' };

export function presetRange(f: Pick<ReportFilters, 'preset' | 'from' | 'to'>, today: DateOnly): { from: DateOnly | null; to: DateOnly | null } {
  switch (f.preset) {
    case 'next30': return { from: today, to: addDaysDateOnly(today, 30) };
    case 'next90': return { from: today, to: addDaysDateOnly(today, 90) };
    case 'past90': return { from: addDaysDateOnly(today, -90), to: today };
    case 'thisQuarter': {
      const d = parseDateOnly(today);
      return { from: toDateOnly(startOfQuarter(d)), to: toDateOnly(endOfQuarter(d)) };
    }
    case 'custom': return { from: f.from || null, to: f.to || null };
    default: return { from: null, to: null };
  }
}

function inRange(date: DateOnly, from: DateOnly | null, to: DateOnly | null): boolean {
  if (from && (!date || date < from)) return false;
  if (to && (!date || date > to)) return false;
  return true;
}

export interface AtRiskTask {
  task: EventTask;
  /** Days from today to the due date; negative = days late. */
  days: number;
}

export interface CategoryRow {
  category: ExpenseCategory;
  estimatedBase: number;
  actualBase: number;
}

export interface WorkloadRow {
  person: Ref;
  open: number;
  dueSoon: number;
  overdue: number;
  completed: number;
  /** Completed tasks that have both completedOn and dueDate. */
  onTimeEligible: number;
  onTime: number;
}

export interface Report {
  events: EpmEvent[];
  eventStats: EventStats[];
  summary: {
    totalTasks: number;
    doneTasks: number;
    overdue: number;
    dueSoon: number;
    spentBase: number;
    budgetBase: number;
    byStatus: Record<EventStatus, number>;
  };
  atRisk: AtRiskTask[];
  budget: {
    categories: CategoryRow[];
    estimatedBase: number;
    actualBase: number;
    /** Actual amounts split by expense status (Cancelled excluded). */
    actualByStatus: { status: ExpenseStatus; actualBase: number }[];
  };
  workload: WorkloadRow[];
  onTime: { eligible: number; onTime: number; missingDates: number };
}

const UNASSIGNED: Ref = { id: '', name: 'Unassigned' };

export function computeReport(events: EpmEvent[], tasks: EventTask[], expenses: Expense[], f: ReportFilters, today: DateOnly = todayDateOnly()): Report {
  const { from, to } = presetRange(f, today);
  const scopedEvents = events.filter((e) =>
    (f.status === 'all' || e.status === f.status) && (!f.eventId || e.id === f.eventId) && inRange(e.eventDate, from, to));
  const ids = new Set(scopedEvents.map((e) => e.id));
  const scopedTasks = tasks.filter((t) => ids.has(t.eventId) && (!f.assigneeId || t.assignee.id === f.assigneeId));
  const scopedExpenses = expenses.filter((x) => ids.has(x.eventId));

  const eventStats = computeEventStats(scopedEvents, scopedTasks, scopedExpenses, today).stats
    .sort((a, b) => (a.event.eventDate || '9999').localeCompare(b.event.eventDate || '9999'));

  const soonEnd = addDaysDateOnly(today, DUE_SOON_DAYS);
  const isOpen = (t: EventTask) => t.status !== TaskStatus.Completed;
  const isDueSoon = (t: EventTask) => isOpen(t) && Boolean(t.dueDate) && t.dueDate >= today && t.dueDate <= soonEnd;

  const byStatus = { [EventStatus.Planning]: 0, [EventStatus.Active]: 0, [EventStatus.Completed]: 0, [EventStatus.Cancelled]: 0 } as Record<EventStatus, number>;
  for (const e of scopedEvents) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;

  const atRisk = scopedTasks
    .filter((t) => isTaskOverdue(t, today) || isDueSoon(t))
    .map((task) => ({ task, days: daysUntil(task.dueDate, today) }))
    .sort((a, b) => a.days - b.days);

  // Budget: same rule as the Events KPI and BudgetTab — every non-cancelled expense.
  const live = scopedExpenses.filter((x) => x.status !== ExpenseStatus.Cancelled);
  const categories = Object.values(ExpenseCategory)
    .map((category) => {
      const rows = live.filter((x) => x.category === category);
      return {
        category,
        estimatedBase: rows.reduce((s, x) => s + (x.estimatedAmountBase ?? 0), 0),
        actualBase: rows.reduce((s, x) => s + (x.actualAmountBase ?? 0), 0),
      };
    })
    .filter((r) => r.estimatedBase > 0 || r.actualBase > 0)
    .sort((a, b) => b.actualBase - a.actualBase);
  const actualByStatus = [ExpenseStatus.Estimated, ExpenseStatus.Approved, ExpenseStatus.Paid].map((status) => ({
    status,
    actualBase: live.filter((x) => x.status === status).reduce((s, x) => s + (x.actualAmountBase ?? 0), 0),
  }));

  // Workload and on-time completion, per assignee (record owner).
  const people = new Map<string, WorkloadRow>();
  let missingDates = 0;
  for (const t of scopedTasks) {
    const person = t.assignee.id ? t.assignee : UNASSIGNED;
    const row = people.get(person.id) ?? { person, open: 0, dueSoon: 0, overdue: 0, completed: 0, onTimeEligible: 0, onTime: 0 };
    if (isOpen(t)) {
      row.open += 1;
      if (isTaskOverdue(t, today)) row.overdue += 1;
      else if (isDueSoon(t)) row.dueSoon += 1;
    } else {
      row.completed += 1;
      if (t.completedOn && t.dueDate) {
        row.onTimeEligible += 1;
        if (t.completedOn <= t.dueDate) row.onTime += 1;
      } else {
        missingDates += 1;
      }
    }
    people.set(person.id, row);
  }
  const workload = [...people.values()].sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.person.name.localeCompare(b.person.name));

  return {
    events: scopedEvents,
    eventStats,
    summary: {
      totalTasks: scopedTasks.length,
      doneTasks: scopedTasks.length - scopedTasks.filter(isOpen).length,
      overdue: scopedTasks.filter((t) => isTaskOverdue(t, today)).length,
      dueSoon: scopedTasks.filter(isDueSoon).length,
      spentBase: eventStats.reduce((s, x) => s + x.spentBase, 0),
      budgetBase: eventStats.reduce((s, x) => s + x.budgetBase, 0),
      byStatus,
    },
    atRisk,
    budget: {
      categories,
      estimatedBase: categories.reduce((s, r) => s + r.estimatedBase, 0),
      actualBase: categories.reduce((s, r) => s + r.actualBase, 0),
      actualByStatus,
    },
    workload,
    onTime: {
      eligible: workload.reduce((s, r) => s + r.onTimeEligible, 0),
      onTime: workload.reduce((s, r) => s + r.onTime, 0),
      missingDates,
    },
  };
}
