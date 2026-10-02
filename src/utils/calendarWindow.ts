/**
 * Calendar window math. Pure: DateOnly strings in, DateOnly strings out (parsed as LOCAL dates
 * through utils/dates.ts — never `new Date("yyyy-MM-dd")`). Weeks start Monday.
 */
import {
  addDays, addMonths, addYears, differenceInCalendarDays, endOfMonth, endOfQuarter, endOfWeek, endOfYear, format,
  getQuarter, startOfMonth, startOfQuarter, startOfWeek, startOfYear,
} from 'date-fns';
import type { DateOnly } from '@/types/entities';
import { parseDateOnly, toDateOnly } from '@/utils/dates';

export const CALENDAR_VIEWS = ['week', 'month', 'quarter', 'year', 'custom'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export interface CustomRange {
  from: DateOnly;
  to: DateOnly;
}

export interface WindowColumn {
  /** First day of the column (clipped to the window). */
  start: DateOnly;
  /** Last day of the column (clipped to the window). */
  end: DateOnly;
  label: string;
}

export interface CalendarWindow {
  view: CalendarView;
  /** First day shown (inclusive). */
  start: DateOnly;
  /** Last day shown (inclusive). */
  end: DateOnly;
  /** Number of days from start to end, inclusive. */
  days: number;
  columnUnit: 'day' | 'week' | 'month';
  columns: WindowColumn[];
  title: string;
}

const WEEK = { weekStartsOn: 1 } as const;
/** Custom ranges up to ~6 months use week columns; longer ones use month columns. */
const CUSTOM_WEEKS_MAX_DAYS = 184;

const d = parseDateOnly;
const s = toDateOnly;

/** Calendar days from `windowStart` to `date` (0 = first column; negative = before the window). */
export function dayIndex(date: DateOnly, windowStart: DateOnly): number {
  return differenceInCalendarDays(d(date), d(windowStart));
}

/** Inclusive ranges [aStart, aEnd] and [bStart, bEnd] share at least one day. */
export function overlaps(aStart: DateOnly, aEnd: DateOnly, bStart: DateOnly, bEnd: DateOnly): boolean {
  return aStart <= bEnd && bStart <= aEnd; // lexical compare is valid for yyyy-MM-dd
}

function dayColumns(start: DateOnly, end: DateOnly): WindowColumn[] {
  const out: WindowColumn[] = [];
  for (let day = d(start); day <= d(end); day = addDays(day, 1)) {
    out.push({ start: s(day), end: s(day), label: format(day, 'EEE d') });
  }
  return out;
}

/** Monday-based weeks, clipped to [start, end]. */
function weekColumns(start: DateOnly, end: DateOnly): WindowColumn[] {
  const out: WindowColumn[] = [];
  for (let monday = startOfWeek(d(start), WEEK); monday <= d(end); monday = addDays(monday, 7)) {
    const colStart = s(monday) < start ? start : s(monday);
    const sunday = s(endOfWeek(monday, WEEK));
    out.push({ start: colStart, end: sunday > end ? end : sunday, label: format(monday, 'MMM d') });
  }
  return out;
}

/** Calendar months, clipped to [start, end]. */
function monthColumns(start: DateOnly, end: DateOnly): WindowColumn[] {
  const out: WindowColumn[] = [];
  for (let first = startOfMonth(d(start)); first <= d(end); first = addMonths(first, 1)) {
    const colStart = s(first) < start ? start : s(first);
    const last = s(endOfMonth(first));
    out.push({ start: colStart, end: last > end ? end : last, label: format(first, 'MMM') });
  }
  return out;
}

function shortRange(from: DateOnly, to: DateOnly): string {
  const [a, b] = [d(from), d(to)];
  const sameYear = a.getFullYear() === b.getFullYear();
  return sameYear
    ? `${format(a, 'MMM d')} – ${format(b, 'MMM d')}`
    : `${format(a, 'MMM d, yyyy')} – ${format(b, 'MMM d, yyyy')}`;
}

function build(view: CalendarView, start: DateOnly, end: DateOnly, columnUnit: CalendarWindow['columnUnit'], title: string): CalendarWindow {
  const columns = columnUnit === 'day' ? dayColumns(start, end) : columnUnit === 'week' ? weekColumns(start, end) : monthColumns(start, end);
  return { view, start, end, days: dayIndex(end, start) + 1, columnUnit, columns, title };
}

/**
 * The visible window for a view around `anchor`.
 * Week = Mon–Sun · Month = month padded to whole weeks · Quarter = quarter padded to whole weeks ·
 * Year = Jan 1–Dec 31 · Custom = from–to (falls back to Month when the range is missing or reversed).
 */
export function getWindow(view: CalendarView, anchor: DateOnly, custom?: CustomRange | null): CalendarWindow {
  const a = d(anchor);
  switch (view) {
    case 'week': {
      const monday = startOfWeek(a, WEEK);
      return build(view, s(monday), s(endOfWeek(a, WEEK)), 'day', `Week of ${format(monday, 'MMM d')}`);
    }
    case 'quarter':
      return build(view, s(startOfWeek(startOfQuarter(a), WEEK)), s(endOfWeek(endOfQuarter(a), WEEK)), 'week',
        `Q${getQuarter(a)} ${format(a, 'yyyy')}`);
    case 'year':
      return build(view, s(startOfYear(a)), s(endOfYear(a)), 'month', format(a, 'yyyy'));
    case 'custom':
      if (custom && custom.from <= custom.to) {
        const unit = dayIndex(custom.to, custom.from) + 1 <= CUSTOM_WEEKS_MAX_DAYS ? 'week' : 'month';
        return build(view, custom.from, custom.to, unit, `Custom: ${shortRange(custom.from, custom.to)}`);
      }
      return getWindow('month', anchor);
    case 'month':
    default:
      return build('month', s(startOfWeek(startOfMonth(a), WEEK)), s(endOfWeek(endOfMonth(a), WEEK)), 'day', format(a, 'MMMM yyyy'));
  }
}

/** Previous/next window. Custom ranges move by their own length; other views move the anchor. */
export function shiftWindow(view: CalendarView, anchor: DateOnly, step: 1 | -1, custom?: CustomRange | null): { anchor: DateOnly; custom: CustomRange | null } {
  const a = d(anchor);
  switch (view) {
    case 'week':
      return { anchor: s(addDays(a, 7 * step)), custom: null };
    case 'quarter':
      return { anchor: s(addMonths(startOfQuarter(a), 3 * step)), custom: null };
    case 'year':
      return { anchor: s(addYears(startOfYear(a), step)), custom: null };
    case 'custom': {
      if (!custom || custom.from > custom.to) return shiftWindow('month', anchor, step);
      const length = dayIndex(custom.to, custom.from) + 1;
      const from = s(addDays(d(custom.from), length * step));
      const to = s(addDays(d(custom.to), length * step));
      return { anchor: from, custom: { from, to } };
    }
    case 'month':
    default:
      return { anchor: s(addMonths(startOfMonth(a), step)), custom: null };
  }
}
