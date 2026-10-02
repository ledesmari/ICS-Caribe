/**
 * Date helpers. Date-only values stay "yyyy-MM-dd" strings end to end and are parsed as
 * LOCAL dates, never via `new Date("yyyy-MM-dd")` (that is UTC → off-by-one in UTC-4).
 */
import { addDays, differenceInCalendarDays, format, isValid, parse, parseISO } from 'date-fns';
import type { DateOnly, IsoDateTime } from '@/types/entities';

const DATE_ONLY = 'yyyy-MM-dd';

export function parseDateOnly(value: DateOnly): Date {
  const d = parse(value, DATE_ONLY, new Date());
  if (!isValid(d)) throw new Error(`Invalid date: ${value}`);
  return d;
}

export function toDateOnly(date: Date): DateOnly {
  return format(date, DATE_ONLY);
}

export function todayDateOnly(): DateOnly {
  return toDateOnly(new Date());
}

export function addDaysDateOnly(value: DateOnly, days: number): DateOnly {
  return toDateOnly(addDays(parseDateOnly(value), days));
}

/** Calendar days from today to `value` (negative when in the past). */
export function daysUntil(value: DateOnly, today: DateOnly = todayDateOnly()): number {
  return differenceInCalendarDays(parseDateOnly(value), parseDateOnly(today));
}

/** Days between a task due date and its event date (≥ 0 when due before the event). */
export function daysBeforeEvent(dueDate: DateOnly, eventDate: DateOnly): number {
  return differenceInCalendarDays(parseDateOnly(eventDate), parseDateOnly(dueDate));
}

export function isPastDateOnly(value: DateOnly, today: DateOnly = todayDateOnly()): boolean {
  return value < today; // lexical compare is valid for yyyy-MM-dd
}

/** "Jun 5, 2026" */
export function formatDateOnly(value: DateOnly, pattern = 'MMM d, yyyy'): string {
  return value ? format(parseDateOnly(value), pattern) : '';
}

/**
 * Event date range: "Jun 5, 2026" · "Jun 5 – 7, 2026" · "Jun 30 – Jul 2, 2026" · "Dec 30, 2026 – Jan 2, 2027".
 * `long` uses full month and weekday names.
 */
export function formatDateRange(start: DateOnly, end: DateOnly, long = false): string {
  if (!start) return '';
  if (!end || end === start) return formatDateOnly(start, long ? 'EEEE, MMMM d, yyyy' : 'MMM d, yyyy');
  const [s, e] = [parseDateOnly(start), parseDateOnly(end)];
  const month = long ? 'EEEE, MMMM d' : 'MMM d';
  if (s.getFullYear() !== e.getFullYear()) {
    return `${format(s, `${month}, yyyy`)} – ${format(e, `${month}, yyyy`)}`;
  }
  const sameMonth = !long && s.getMonth() === e.getMonth();
  return `${format(s, month)} – ${format(e, sameMonth ? 'd' : month)}, ${format(e, 'yyyy')}`;
}

/** Number of calendar days an event spans (1 for a one-day event). */
export function eventLengthDays(start: DateOnly, end: DateOnly): number {
  return end && end > start ? differenceInCalendarDays(parseDateOnly(end), parseDateOnly(start)) + 1 : 1;
}

/** UTC ISO → local display, e.g. "Jun 5, 2:30 PM". */
export function formatDateTime(value: IsoDateTime, pattern = 'MMM d, h:mm a'): string {
  if (!value) return '';
  const d = parseISO(value);
  return isValid(d) ? format(d, pattern) : '';
}

/** Local Date → UTC ISO string for date+time columns. */
export function toIsoDateTime(date: Date): IsoDateTime {
  return date.toISOString();
}

export type PhaseKey = '8w+' | '4-8w' | '2-4w' | 'final2w' | 'eventWeek';

export const PHASES: { key: PhaseKey; label: string }[] = [
  { key: '8w+', label: '8+ weeks' },
  { key: '4-8w', label: '4–8 weeks' },
  { key: '2-4w', label: '2–4 weeks' },
  { key: 'final2w', label: 'Final 2 weeks' },
  { key: 'eventWeek', label: 'Event week' },
];

/** Phase from days before the event: ≥56 · 28–55 · 14–27 · 1–13 · ≤0. */
export function phaseFor(daysBefore: number): PhaseKey {
  if (daysBefore >= 56) return '8w+';
  if (daysBefore >= 28) return '4-8w';
  if (daysBefore >= 14) return '2-4w';
  if (daysBefore >= 1) return 'final2w';
  return 'eventWeek';
}
