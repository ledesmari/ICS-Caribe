/**
 * Week view (desktop): 7 day columns. Top = all-day event bars (same lane packing as the month,
 * taller: name, location, tasks mini bar). Below = 07:00–20:00 hourly grid with the week's meetings
 * as blocks tinted by their event's template color, plus a navy "now" line on today. The time grid
 * is hidden when the week has no meetings.
 */
import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Video } from 'lucide-react';
import type { CalendarEvent, CalendarMeeting } from '@/hooks/useCalendarData';
import { EventStatus } from '@/types/schema';
import { packLanes, packTimedBlocks, rowSegments } from '@/utils/calendarLayout';
import type { CalendarWindow } from '@/utils/calendarWindow';
import { formatDateOnly, formatDateRange, toDateOnly, todayDateOnly } from '@/utils/dates';

const HOUR_START = 7;
const HOUR_END = 20;
const HOUR_PX = 48;
const LANE_PX = 66;
const MIN_BLOCK_PX = 20;
const GRID_COLS = 'grid grid-cols-[56px_repeat(7,minmax(0,1fr))]';

interface MeetingBlock {
  id: string;
  startMin: number;
  endMin: number;
  m: CalendarMeeting;
  column: number;
  columns: number;
}

const minutesOf = (iso: string) => { const d = parseISO(iso); return d.getHours() * 60 + d.getMinutes(); };
const clampMin = (m: number) => Math.min(HOUR_END * 60, Math.max(HOUR_START * 60, m));

function useNowMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function WeekView({ window: win, items, meetings, meetingsError, activeId, onOpenEvent }: {
  window: CalendarWindow;
  items: CalendarEvent[];
  meetings: CalendarMeeting[];
  meetingsError: unknown;
  activeId: string | null;
  onOpenEvent: (item: CalendarEvent, anchor: HTMLElement) => void;
}) {
  const today = todayDateOnly();
  const now = useNowMinute();
  const days = useMemo(() => win.columns.map((c) => c.start), [win.columns]);
  const placed = useMemo(() => packLanes(rowSegments(items, win.start)), [items, win.start]);
  const lanes = Math.max(1, ...placed.map((p) => p.lane + 1));

  const blocksByDay = useMemo(() => {
    const map = new Map<string, MeetingBlock[]>();
    for (const day of days) {
      const list = meetings.filter((m) => m.day === day).map((m) => {
        const startMin = minutesOf(m.meeting.start);
        // A meeting ending on a later day runs to the bottom of this day's grid.
        const endsSameDay = !!m.meeting.end && toDateOnly(parseISO(m.meeting.end)) === day;
        const endMin = endsSameDay ? minutesOf(m.meeting.end) : HOUR_END * 60;
        return { id: m.meeting.id, startMin, endMin: Math.max(endMin, startMin + 15), m };
      });
      map.set(day, packTimedBlocks(list));
    }
    return map;
  }, [days, meetings]);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const gridHeight = (HOUR_END - HOUR_START) * HOUR_PX;

  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      {/* Day headers */}
      <div className={`${GRID_COLS} border-b border-line bg-page`}>
        <span aria-hidden />
        {days.map((d) => (
          <div key={d} className="flex flex-col items-center py-2">
            <span className="text-xs font-bold tracking-wider text-secondary uppercase">{formatDateOnly(d, 'EEE')}</span>
            <span className={`tabular mt-0.5 flex size-8 items-center justify-center rounded-full text-sm ${d === today ? 'bg-orange-500 font-extrabold text-ink' : 'font-semibold'}`}>
              {Number(d.slice(8))}
            </span>
          </div>
        ))}
      </div>

      {/* All-day events */}
      <div className={`${GRID_COLS} border-b border-line`}>
        <span className="px-2 pt-2 text-[11px] font-semibold text-muted">All day</span>
        <div className="relative col-span-7" style={{ height: lanes * LANE_PX + 8 }}>
          <div className="absolute inset-0 grid grid-cols-7" aria-hidden>
            {days.map((d, i) => <div key={d} className={`${i ? 'border-l border-line' : ''} ${i >= 5 ? 'bg-page/40' : ''}`} />)}
          </div>
          {placed.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">No events this week</p>}
          {placed.map((s) => {
            const { item } = s;
            const cancelled = item.event.status === EventStatus.Cancelled;
            const radius = `${s.continuesBefore ? '' : 'rounded-l-xl'} ${s.continuesAfter ? '' : 'rounded-r-xl'}`;
            return (
              <button key={item.id} type="button" onClick={(e) => onOpenEvent(item, e.currentTarget)}
                aria-label={`${item.event.name}, ${formatDateRange(item.start, item.end)}${item.event.location ? `, ${item.event.location}` : ''}, ${item.stats.doneTasks} of ${item.stats.totalTasks} tasks done`}
                className={`absolute flex flex-col justify-center gap-0.5 overflow-hidden px-2.5 text-left ${radius} ${item.color.bg} ${item.color.text} ${
                  item.id === activeId ? 'ring-2 ring-navy-700' : ''} ${cancelled ? 'opacity-60' : ''} hover:brightness-95`}
                style={{ top: 4 + s.lane * LANE_PX, height: LANE_PX - 6, left: `calc(${(s.col / 7) * 100}% + 3px)`, width: `calc(${(s.span / 7) * 100}% - 6px)` }}>
                <span className={`flex items-center gap-1.5 truncate text-sm font-bold ${cancelled ? 'line-through' : ''}`}>
                  {s.continuesBefore && <span aria-hidden>◂</span>}
                  <span className={`size-1.5 shrink-0 rounded-full ${item.color.solid}`} aria-hidden />
                  <span className="truncate">{item.event.name}</span>
                  {s.continuesAfter && <span aria-hidden className="ml-auto">▸</span>}
                </span>
                {item.event.location && <span className="truncate text-xs opacity-90">{item.event.location}</span>}
                <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <span className="tabular shrink-0">Tasks {item.stats.doneTasks}/{item.stats.totalTasks}</span>
                  <span className="h-1 w-full max-w-24 overflow-hidden rounded-full bg-white/70" aria-hidden>
                    <span className={`block h-full ${item.color.solid}`} style={{ width: `${item.stats.totalTasks ? (item.stats.doneTasks / item.stats.totalTasks) * 100 : 0}%` }} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {meetingsError ? (
        <p className="p-3 text-sm text-red-700">Meetings couldn't be loaded, so the time grid isn't shown.</p>
      ) : meetings.length > 0 && (
        <div className={`${GRID_COLS} max-h-[560px] overflow-y-auto`}>
          <div className="relative" style={{ height: gridHeight }} aria-hidden>
            {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
              <span key={i} className="tabular absolute right-2 -translate-y-1/2 text-[11px] text-muted" style={{ top: i * HOUR_PX }}>
                {i === 0 ? '' : `${String(HOUR_START + i).padStart(2, '0')}:00`}
              </span>
            ))}
          </div>
          {days.map((d, i) => (
            <div key={d} role="group" aria-label={`Meetings on ${formatDateOnly(d, 'EEEE, MMMM d')}`}
              className={`relative border-l border-line ${i >= 5 ? 'bg-page/40' : ''}`} style={{ height: gridHeight }}>
              {Array.from({ length: HOUR_END - HOUR_START - 1 }, (_, h) => (
                <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: (h + 1) * HOUR_PX }} aria-hidden />
              ))}
              {(blocksByDay.get(d) ?? []).map((b) => {
                const top = Math.min(gridHeight - MIN_BLOCK_PX, ((clampMin(b.startMin) - HOUR_START * 60) / 60) * HOUR_PX);
                const height = Math.max(MIN_BLOCK_PX, ((clampMin(b.endMin) - clampMin(b.startMin)) / 60) * HOUR_PX - 2);
                const { meeting, item } = b.m;
                const time = `${format(parseISO(meeting.start), 'h:mm a')}${meeting.end ? ` – ${format(parseISO(meeting.end), 'h:mm a')}` : ''}`;
                return (
                  <button key={b.id} type="button" onClick={(e) => onOpenEvent(item, e.currentTarget)}
                    aria-label={`${meeting.subject}, ${time}, ${item.event.name}${meeting.isOnline ? ', Teams meeting' : ''}`}
                    className={`absolute overflow-hidden rounded-lg border-l-4 border-current px-1.5 py-1 text-left text-[11px] leading-tight ${item.color.bg} ${item.color.text} hover:brightness-95`}
                    style={{ top, height, left: `calc(${(b.column / b.columns) * 100}% + 2px)`, width: `calc(${100 / b.columns}% - 4px)` }}>
                    <span className="flex items-center gap-1 truncate font-bold">
                      {meeting.isOnline && <Video className="size-3 shrink-0" aria-hidden />}
                      <span className="truncate">{meeting.subject}</span>
                    </span>
                    <span className="block truncate">{time}</span>
                  </button>
                );
              })}
              {d === today && nowMin >= HOUR_START * 60 && nowMin <= HOUR_END * 60 && (
                <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: ((nowMin - HOUR_START * 60) / 60) * HOUR_PX }} aria-hidden>
                  <span className="-ml-1 size-2 rounded-full bg-navy-700" />
                  <span className="h-0.5 flex-1 bg-navy-700" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
