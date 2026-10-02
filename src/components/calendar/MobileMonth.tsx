/**
 * Month view below 1024px: compact 7-column month with up to 3 template-colored dots per day
 * (multi-day events dot every day they cover), selected-day agenda and "Next up".
 */
import { useState } from 'react';
import type { CalendarEvent } from '@/hooks/useCalendarData';
import type { DateOnly } from '@/types/entities';
import type { CalendarWindow } from '@/utils/calendarWindow';
import { formatDateOnly, todayDateOnly } from '@/utils/dates';
import { AgendaCard } from './WeekAgenda';

const MAX_DOTS = 3;
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function MobileMonth({ window: win, anchor, items, upcoming, activeId, onOpenEvent }: {
  window: CalendarWindow;
  anchor: DateOnly;
  items: CalendarEvent[];
  upcoming: CalendarEvent[];
  activeId: string | null;
  onOpenEvent: (item: CalendarEvent, anchor: HTMLElement) => void;
}) {
  const today = todayDateOnly();
  const month = anchor.slice(0, 7);
  const days = win.columns.map((c) => c.start);
  const [picked, setPicked] = useState<DateOnly | null>(null);
  const selected = picked && picked.slice(0, 7) === month ? picked : today.slice(0, 7) === month ? today : `${month}-01`;
  const on = (day: DateOnly) => items.filter((c) => c.start <= day && c.end >= day);
  const dayItems = on(selected);

  return (
    <div>
      <div className="grid grid-cols-7 text-center" role="group" aria-label={win.title}>
        {WEEKDAYS.map((d, i) => <span key={i} aria-hidden className="pb-1 text-[11px] font-bold text-secondary">{d}</span>)}
        {days.map((d) => {
          const outside = d.slice(0, 7) !== month;
          const list = on(d);
          const isSel = d === selected;
          const isToday = d === today;
          return (
            <button key={d} type="button" aria-pressed={isSel} onClick={() => setPicked(d)} disabled={outside}
              aria-label={`${formatDateOnly(d, 'EEEE, MMMM d')}, ${list.length} event${list.length === 1 ? '' : 's'}`}
              className="flex h-14 flex-col items-center justify-center gap-0.5 disabled:opacity-40">
              <span className={`tabular flex size-11 items-center justify-center rounded-full text-sm ${
                isSel ? 'bg-navy-700 font-bold text-white' : isToday ? 'bg-orange-500 font-extrabold text-ink' : outside ? 'text-muted' : 'font-semibold'
              }`}>
                {Number(d.slice(8))}
              </span>
              <span className="flex h-1.5 gap-0.5" aria-hidden>
                {list.slice(0, MAX_DOTS).map((c) => <span key={c.id} className={`size-1.5 rounded-full ${c.color.solid}`} />)}
              </span>
            </button>
          );
        })}
      </div>

      <h3 className="mt-5 mb-2 text-sm font-bold text-secondary" aria-live="polite">{formatDateOnly(selected, 'EEEE, MMMM d')}</h3>
      {dayItems.length === 0 ? (
        <p className="rounded-2xl bg-page p-4 text-sm text-muted">No events on this day.</p>
      ) : (
        <div className="space-y-2">{dayItems.map((c) => <AgendaCard key={c.id} item={c} active={c.id === activeId} onOpen={onOpenEvent} />)}</div>
      )}

      {upcoming.length > 0 && (
        <section aria-labelledby="next-up" className="mt-6">
          <h3 id="next-up" className="mb-2 text-[11px] font-bold tracking-[0.14em] text-secondary uppercase">Next up</h3>
          <div className="space-y-2">{upcoming.map((c) => <AgendaCard key={c.id} item={c} active={c.id === activeId} onOpen={onOpenEvent} />)}</div>
        </section>
      )}
    </div>
  );
}
