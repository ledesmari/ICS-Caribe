/**
 * Month grid (Concept A): Mon–Sun columns, multi-day events as bars packed into lanes per week,
 * max 2 lanes per day then "+N more". Keyboard: roving tabindex over days — arrows move a day/week,
 * PageUp/PageDown change month, Enter opens the day's event (or the day popover when there are several).
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { addMonths } from 'date-fns';
import type { CalendarEvent } from '@/hooks/useCalendarData';
import type { DateOnly } from '@/types/entities';
import { hiddenPerColumn, packLanes, rowSegments, type PlacedSegment } from '@/utils/calendarLayout';
import type { CalendarWindow } from '@/utils/calendarWindow';
import { addDaysDateOnly, formatDateOnly, parseDateOnly, toDateOnly, todayDateOnly } from '@/utils/dates';
import { CalendarChip } from './CalendarChip';

const VISIBLE_LANES = 2;
const DAY_HEADER_PX = 34;
const LANE_PX = 26;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MonthGrid({ window: win, anchor, items, activeId, onOpenEvent, onOpenDay, onNavigate }: {
  window: CalendarWindow;
  /** Anchor date of the month shown (days of other months are muted). */
  anchor: DateOnly;
  items: CalendarEvent[];
  /** Event whose popover is open (gets a navy ring). */
  activeId: string | null;
  onOpenEvent: (item: CalendarEvent, anchor: HTMLElement) => void;
  onOpenDay: (day: DateOnly, items: CalendarEvent[], anchor: HTMLElement) => void;
  /** Keyboard moved focus outside the window: show the month of `date`. */
  onNavigate: (date: DateOnly) => void;
}) {
  const today = todayDateOnly();
  const month = anchor.slice(0, 7);
  const gridRef = useRef<HTMLDivElement>(null);
  const wantFocus = useRef(false);
  const [focusDate, setFocusDate] = useState<DateOnly | null>(null);

  const weeks = useMemo(() => {
    const out: { start: DateOnly; days: DateOnly[]; placed: PlacedSegment<CalendarEvent>[]; hidden: number[] }[] = [];
    for (let i = 0; i < win.columns.length; i += 7) {
      const start = win.columns[i]?.start;
      if (!start) continue;
      const placed = packLanes(rowSegments(items, start));
      out.push({ start, days: win.columns.slice(i, i + 7).map((c) => c.start), placed, hidden: hiddenPerColumn(placed, VISIBLE_LANES) });
    }
    return out;
  }, [win.columns, items]);

  const inWindow = (d: DateOnly) => d >= win.start && d <= win.end;
  const defaultFocus = inWindow(today) && today.slice(0, 7) === month ? today : `${month}-01`;
  const current = focusDate && inWindow(focusDate) ? focusDate : defaultFocus;

  // After keyboard navigation (possibly into another month), move DOM focus to the new day.
  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${current}"]`)?.focus();
  }, [current, weeks]);

  const itemsOn = (day: DateOnly) => items.filter((c) => c.start <= day && c.end >= day);

  const move = (next: DateOnly) => {
    wantFocus.current = true;
    setFocusDate(next);
    if (!inWindow(next)) onNavigate(next);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>, day: DateOnly) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const step = steps[e.key];
    if (step !== undefined) { e.preventDefault(); move(addDaysDateOnly(day, step)); return; }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      // addMonths clamps the day (Jan 31 → Feb 28).
      const next = toDateOnly(addMonths(parseDateOnly(day), e.key === 'PageUp' ? -1 : 1));
      wantFocus.current = true;
      setFocusDate(next);
      onNavigate(next);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const list = itemsOn(day);
      const only = list[0];
      if (list.length === 1 && only) onOpenEvent(only, e.currentTarget);
      else if (list.length > 1) onOpenDay(day, list, e.currentTarget);
    }
  };

  return (
    <div ref={gridRef} role="grid" aria-label={win.title} className="overflow-hidden rounded-2xl border border-line bg-line">
      <div role="row" className="grid grid-cols-7 gap-px">
        {WEEKDAYS.map((d) => (
          <div key={d} role="columnheader" className="bg-page py-2 text-center text-xs font-bold tracking-wider text-secondary uppercase">{d}</div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week.start} role="row" className="mt-px grid grid-cols-7 gap-px">
          {week.days.map((day, col) => {
            const outside = day.slice(0, 7) !== month;
            const weekend = col >= 5;
            const isToday = day === today;
            const starting = week.placed.filter((s) => s.col === col && s.lane < VISIBLE_LANES);
            const hidden = week.hidden[col] ?? 0;
            const count = itemsOn(day).length;
            return (
              <div key={day} role="gridcell" data-date={day} tabIndex={day === current ? 0 : -1}
                aria-label={`${formatDateOnly(day, 'EEEE, MMMM d')}${count ? `, ${count} event${count === 1 ? '' : 's'}` : ', no events'}`}
                aria-current={isToday ? 'date' : undefined}
                onKeyDown={(e) => onKey(e, day)}
                onClick={() => setFocusDate(day)}
                className={`relative min-h-[120px] outline-none focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-navy-700 focus-visible:ring-inset ${
                  outside ? 'bg-page' : weekend ? 'bg-page/40' : 'bg-white'
                }`}>
                <span className={`tabular absolute top-1.5 left-1.5 flex size-7 items-center justify-center rounded-full text-sm ${
                  isToday ? 'bg-orange-500 font-extrabold text-ink' : outside ? 'text-muted' : 'font-semibold text-ink'
                }`}>
                  {Number(day.slice(8))}
                </span>
                {starting.map((s) => (
                  <CalendarChip key={s.item.id} item={s.item} active={s.item.id === activeId} tabIndex={-1}
                    continuesBefore={s.continuesBefore} continuesAfter={s.continuesAfter} onOpen={onOpenEvent}
                    className="absolute z-10"
                    style={{ top: DAY_HEADER_PX + s.lane * LANE_PX, left: 4, width: `calc(${s.span * 100}% + ${s.span - 1}px - 8px)` }} />
                ))}
                {hidden > 0 && (
                  <button type="button" tabIndex={-1}
                    onClick={(e) => { e.stopPropagation(); onOpenDay(day, itemsOn(day), e.currentTarget); }}
                    className="absolute left-1.5 z-10 h-6 rounded-md px-1.5 text-xs font-bold text-navy-700 hover:bg-navy-50"
                    style={{ top: DAY_HEADER_PX + VISIBLE_LANES * LANE_PX }}>
                    +{hidden} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
