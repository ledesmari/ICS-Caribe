/** Display formatting and derived UI state. No Dataverse names here — only domain values. */
import { EventStatus, ExpenseCategory, ExpenseStatus, TaskStatus } from '@/types/schema';
import type { DateOnly, EventTask } from '@/types/entities';
import { isPastDateOnly, todayDateOnly } from '@/utils/dates';

export function formatCurrency(amount: number | null | undefined, currency = 'USD', compact = false): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: compact || Number.isInteger(amount) ? 0 : 2,
    notation: compact ? 'compact' : 'standard',
  }).format(amount);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Stable avatar colour per person. All pairs keep text contrast ≥ 4.5:1. */
const AVATAR_COLORS = [
  'bg-navy-100 text-navy-900',
  'bg-orange-50 text-orange-900',
  'bg-green-50 text-green-700',
  'bg-pending-bg text-secondary',
  'bg-navy-700 text-white',
  'bg-red-50 text-red-700',
] as const;

export function avatarColor(key: string): string {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

/* ---------- status ---------- */

/** UI status for a task. "overdue" is derived, never stored. */
export type TaskUiStatus = 'pending' | 'inProgress' | 'completed' | 'overdue';

export function isTaskOverdue(task: Pick<EventTask, 'status' | 'dueDate'>, today: DateOnly = todayDateOnly()): boolean {
  return task.status !== TaskStatus.Completed && Boolean(task.dueDate) && isPastDateOnly(task.dueDate, today);
}

export function taskUiStatus(task: Pick<EventTask, 'status' | 'dueDate'>, today?: DateOnly): TaskUiStatus {
  if (isTaskOverdue(task, today)) return 'overdue';
  if (task.status === TaskStatus.Completed) return 'completed';
  if (task.status === TaskStatus.InProgress) return 'inProgress';
  return 'pending';
}

export const TASK_STATUS_LABEL: Record<TaskUiStatus, string> = {
  pending: 'Pending',
  inProgress: 'In progress',
  completed: 'Completed',
  overdue: 'Overdue',
};

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: TaskStatus.Pending, label: 'Pending' },
  { value: TaskStatus.InProgress, label: 'In progress' },
  { value: TaskStatus.Completed, label: 'Completed' },
];

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  [EventStatus.Planning]: 'Planning',
  [EventStatus.Active]: 'Active',
  [EventStatus.Completed]: 'Completed',
  [EventStatus.Cancelled]: 'Cancelled',
};

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  [ExpenseCategory.Airfare]: 'Airfare',
  [ExpenseCategory.Lodging]: 'Lodging',
  [ExpenseCategory.Meals]: 'Meals',
  [ExpenseCategory.AvEquipmentRental]: 'AV Equipment Rental',
  [ExpenseCategory.GroundTransportation]: 'Ground Transportation',
  [ExpenseCategory.Venue]: 'Venue',
  [ExpenseCategory.MaterialsAndPrinting]: 'Materials and Printing',
  [ExpenseCategory.Other]: 'Other',
};

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  [ExpenseStatus.Estimated]: 'Estimated',
  [ExpenseStatus.Approved]: 'Approved',
  [ExpenseStatus.Paid]: 'Paid',
  [ExpenseStatus.Cancelled]: 'Cancelled',
};

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Something went wrong.';
}
